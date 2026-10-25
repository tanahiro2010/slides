/**
 * 検証対象の Durable Object。
 *
 * 公式ドキュメントの最小構成に、観測と障害注入だけを足した形にしている。
 * 構成そのものを変えてしまうと、測ったものが公式の挙動だと言えなくなる。
 */

import { DurableObject } from "cloudflare:workers";
import { createModels } from "@earendil-works/pi-ai/models";
import { createAI } from "agents/models/pi-ai";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { PiHarness } from "agents/harness/pi";
import { Lifecycle } from "agents/lifecycle";

import { Evidence } from "./evidence.ts";
import { LabState } from "./state.ts";
import { createLabTools } from "./tools.ts";
import { createFaux, FAUX_MODEL_ID, REAL_MODEL_ID } from "./script.ts";
import { wrapStorage } from "./storage.ts";

export class RecoveryLab extends DurableObject<Env> {
  /**
   * レジストリはクラスフィールドに置く。
   * モジュールスコープに置くと、退避したオブジェクトのハーネスがメモリに残る（C42）。
   */
  registry = createRegistry();

  #instanceId = crypto.randomUUID();
  evidence = new Evidence(this.ctx.storage, this.#instanceId);
  state = new LabState(this.ctx.storage);
  #faux = createFaux({ state: this.state, evidence: this.evidence });
  #ai = createAI({ binding: this.env.AI });
  #factoryRuns = 0;

  harness = new PiHarness({
    harness: ({ storage, context, onWake }) => {
      this.#factoryRuns += 1;

      const models = createModels();
      // 両方を登録しておく。`setProvider` は provider.id ごとの upsert。
      // どちらを使うかは、セッション単位の `setModel()` で決める。
      //
      // `defaults` はクラスフィールドなので構築時に 1 度しか評価されない。
      // あとから設定を変えても届かないので、既定は偽モデルに固定し、
      // C20（実モデルが要る 1 本）だけ `useRealModel()` で切り替える。
      models.setProvider(this.#faux.provider);
      models.setProvider(this.#ai.provider);

      this.registry.install({
        name: "recovery-lab",
        sections: [{ key: "preamble", render: () => "You are a test agent.", tag: false }],
        tools: createLabTools({
          state: this.state,
          evidence: this.evidence,
          abort: (reason) => this.ctx.abort(reason),
        }),
      });

      // 記録だけ先に流す。factory は同期的に Harness を返す必要があるので待たない。
      void this.evidence.record("harness_opened", {
        factoryRuns: this.#factoryRuns,
        onWakeWired: this.#onWakeWired,
      });

      return Harness.open(
        // `onWake` を外す実験（C35 / C36 / C37）のためにフラグで切り替える
        wrapStorage(storage, { state: this.state, evidence: this.evidence }),
        {
          models,
          registry: this.registry,
          ...(this.#onWakeWired ? { onWake } : {}),
          // settings は関数で渡せる（Pi 1.4）。実験ごとに耐久状態から読み直す。
          settings: () => ({
            restartLimit: Number(this.state.get("restartLimit") ?? 5),
            retry: {
              enabled: this.state.get("retryEnabled") !== "false",
              maxRetries: Number(this.state.get("maxRetries") ?? 3),
              baseDelayMs: Number(this.state.get("baseDelayMs") ?? 2000),
            },
          }),
          onReport: (error, info) => {
            void this.evidence.record("report", {
              type: info?.type,
              message: error instanceof Error ? error.message : String(error),
              name: error instanceof Error ? error.name : "unknown",
            });
          },
        },
        context,
      );
    },
    defaults: { model: this.#faux.getModel(FAUX_MODEL_ID) },
  });

  lifecycle = Lifecycle.install(this).use(this.harness);

  /** `onWake` を渡すかどうか。既定は渡す（公式が推す構成）。 */
  get #onWakeWired(): boolean {
    return this.state.get("onWake") !== "off";
  }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // コンストラクタの実行そのものが観測対象。C03 / C05 / C08 / C40 の対照がこれに乗る。
    ctx.blockConcurrencyWhile(async () => {
      await this.evidence.record("instance_started", {
        factoryRuns: this.#factoryRuns,
      });
    });
  }

  get instanceId() {
    return this.#instanceId;
  }

  get factoryRuns() {
    return this.#factoryRuns;
  }

  get fauxCallCount() {
    return this.#faux.state.callCount;
  }

  /** 検証用: 本物のリセットを撃つ。例外送出とは別物（C02）。 */
  crash(reason: string): never {
    this.ctx.abort(reason);
    throw new Error("unreachable");
  }

  /** 次の alarm がいつか。C26 / C37 / C39 の観測に使う。 */
  async nextAlarm(): Promise<number | null> {
    return await this.ctx.storage.getAlarm();
  }

  // --- RPC 境界 ---
  //
  // Durable Object の RPC は、ネストしたプロパティ越しのメソッド呼び出しを通さない。
  // `lab.harness.submit()` は型が通っても実行時に落ちる。
  // 外から触る操作はすべてここに明示的に生やす。

  async info() {
    return {
      instanceId: this.#instanceId,
      factoryRuns: this.#factoryRuns,
      fauxCallCount: this.#faux.state.callCount,
      nextAlarm: await this.ctx.storage.getAlarm(),
      onWakeWired: this.#onWakeWired,
      realModel: this.state.get("realModel") ?? null,
    };
  }

  async readEvents(experimentId?: string) {
    return this.evidence.read(experimentId);
  }

  async readCounters() {
    return this.state.counters();
  }

  async readSchema() {
    return this.state.piSchema();
  }

  async readTables() {
    return this.state.tables();
  }

  async resetLab() {
    this.evidence.reset();
    this.state.reset();
    await this.ctx.storage.sync();
    return { ok: true };
  }

  async armFault(plan: { id: string; at: string; mode: string; times: number }) {
    this.state.arm({ id: plan.id, at: plan.at, mode: plan.mode as never, times: plan.times });
    await this.ctx.storage.sync();
    return this.state.plans();
  }

  async disarmFault(id?: string) {
    this.state.disarm(id);
    await this.ctx.storage.sync();
    return this.state.plans();
  }

  async putSettings(values: Record<string, string>) {
    for (const [k, v] of Object.entries(values)) this.state.put(k, v);
    await this.ctx.storage.sync();
    return { ok: true };
  }

  async setScenario(scenario: unknown) {
    this.state.put("scenario", JSON.stringify(scenario));
    await this.ctx.storage.sync();
    return { ok: true };
  }

  /** C01 の対照。`sync` の有無だけを変えて、直後に本物のリセットを撃つ。 */
  async probeC01(durable: boolean): Promise<never> {
    this.evidence.setExperiment("C01");
    await this.evidence.record("observed", { probe: "c01", durable }, { durable });
    this.ctx.abort(`c01-probe:sync=${durable}`);
    throw new Error("unreachable");
  }

  /** C02 の対照。内側で catch を試みる。 */
  async probeC02(): Promise<{ caught: boolean }> {
    this.evidence.setExperiment("C02");
    try {
      this.ctx.abort("c02-probe");
    } catch {
      // ここに入れば「catch できた」ことになる。仕様上は入らないはず。
      await this.evidence.record("observed", { probe: "c02", caught: true });
      return { caught: true };
    }
    await this.evidence.record("observed", { probe: "c02", caught: false });
    return { caught: false };
  }

  /**
   * このセッションを実モデル（Workers AI）に切り替える。
   *
   * C20 は「モデルが中断されたツールを呼び直すか」なので、
   * 応答を自分で書く偽モデルでは答えにならない。
   */
  async useRealModel(modelId?: string) {
    const id = modelId ?? REAL_MODEL_ID;
    this.state.put("realModel", id);
    await this.ctx.storage.sync();
    await this.harness.session().setModel(this.#ai(id));
    await this.evidence.record("observed", { realModel: id });
    return { ok: true, model: id };
  }

  async piSubmit(text: string, operationId?: string) {
    const receipt = await this.harness.submit(text, operationId ? { operationId } : undefined);
    await this.evidence.record("submitted", { text, accepted: receipt.accepted }, {
      operationId: receipt.operationId,
    });
    return { operationId: receipt.operationId, accepted: receipt.accepted };
  }

  async piWait(operationId: string) {
    const result = await this.harness.wait(operationId);
    await this.evidence.record("completed", { status: result.status, reason: result.reason }, {
      operationId,
    });
    return { status: result.status, reason: result.reason, text: result.text };
  }

  async piPending() {
    return (await this.harness.pending()).map((p) => ({
      operationId: p.operationId,
      status: p.status,
    }));
  }

  async piMessages() {
    const entries = await this.harness.session().messages();
    // transcript をそのまま返すと RPC の型が深くなりすぎるので、観測に要る形に落とす。
    return entries.map((e) => ({ kind: e.kind, id: String(e.id) }));
  }

  /**
   * WebSocket で session.events() を流す。C08 / C10 / C43 用。
   *
   * 切断しても Agent の実行は続くか（C08）、
   * 再接続時に snapshot から現在状態を組み直せるか（C10）、
   * リスナーが遅れるとイベントが snapshot に畳まれるか（C43）を見る。
   */
  /**
   * WebSocket は RPC の戻り値にできない（`DataCloneError`）。
   * Durable Object 自身の `fetch()` で受ける必要がある。
   */
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/stream") return new Response("not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    return await this.#openStream(Number(url.searchParams.get("slow") ?? 0));
  }

  async #openStream(slowMs = 0): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const stream = await this.harness.session().events();
    const send = (payload: unknown) => {
      try {
        server.send(JSON.stringify(payload));
      } catch {
        // 相手が消えていてもここで落とさない。観測は evidence に残る。
      }
    };

    send({ _snapshot: true, entries: stream.snapshot.entries?.length ?? null });
    await this.evidence.record("observed", {
      probe: "stream_open",
      snapshotEntries: stream.snapshot.entries?.length ?? null,
    });

    let batches = 0;
    let events = 0;
    stream.start(async (batch) => {
      batches += 1;
      events += batch.length;
      // 遅いリスナーを作る（C43）
      if (slowMs > 0) await new Promise((r) => setTimeout(r, slowMs));
      for (const e of batch) send({ type: (e as { type?: string }).type ?? "?" });
      await this.evidence.record("observed", {
        probe: "stream_batch", batches, events, batchSize: batch.length,
      });
    });

    server.addEventListener("close", () => {
      void stream.stop();
      void this.evidence.record("observed", { probe: "stream_closed", batches, events });
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  /** transcript の生データ。モデルのエラー文言を取り出すために使う。 */
  async piTranscript() {
    const entries = await this.harness.session().messages();
    return entries.map((e) => {
      const raw = JSON.stringify(e);
      return { kind: e.kind, raw: raw.length > 1200 ? `${raw.slice(0, 1200)}…` : raw };
    });
  }

  async piRetry() {
    const retried = await this.harness.session().retry();
    await this.evidence.record("retried", { retried });
    return { retried };
  }

  async piAbort() {
    await this.harness.session().abort();
    return { ok: true };
  }
}
