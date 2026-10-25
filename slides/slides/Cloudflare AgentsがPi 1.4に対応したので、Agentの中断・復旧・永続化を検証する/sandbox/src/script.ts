/**
 * 偽モデルの応答スクリプト。
 *
 * pi-ai が同梱する `fauxProvider` を使う。
 * 自作の Provider より、ベンダー自身のテスト用実装に乗せた方が主張が強い。
 *
 * 応答は**耐久状態から組み立てる**。
 * メモリ上の位置に依存させると、Durable Object が再起動した時点で
 * スクリプトが頭に戻ってしまい、何を測っているのか分からなくなる。
 */

import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
  type FauxProviderHandle,
  type FauxResponseFactory,
} from "@earendil-works/pi-ai/providers/faux";
import type { Evidence } from "./evidence.ts";
import type { LabState } from "./state.ts";

export const FAUX_MODEL_ID = "faux/recovery-lab";

/** C20 用。Workers AI 経由の実モデル。 */
export const REAL_MODEL_ID = "@cf/zai-org/glm-4.7-flash";

/** C15 用。わざと遅くストリームする偽モデル。 */
export const SLOW_MODEL_ID = "faux/slow-stream";

/**
 * C15: 15 分を超えるストリームを作る。
 *
 * faux は `tokensPerSecond` を `setTimeout` で実際に守る。
 * `estimateTokens` は `ceil(文字数 / 4)` なので、
 * 1 トークン/秒 なら 4 文字で 1 秒かかる。
 */
export function createSlowFaux(deps: { state: LabState; evidence: Evidence }): FauxProviderHandle {
  const faux = fauxProvider({
    provider: "faux-slow",
    api: "faux-slow",
    models: [{ id: SLOW_MODEL_ID, name: "Slow Stream", contextWindow: 128_000, maxTokens: 8192 }],
    tokensPerSecond: 1,
    tokenSize: { min: 4, max: 4 },
  });

  const step = async () => {
    faux.appendResponses([step]);
    // 既定は 18 分ぶん。`/settings` の `slowChars` で変えられる。
    const chars = Number(deps.state.get("slowChars") ?? 4400);
    const turn = await deps.state.bump("model:requests");
    await deps.evidence.record("model_request", {
      turn, scenario: "slow_stream", chars, 予想秒数: Math.round(chars / 4),
    });
    return fauxAssistantMessage("slow ".repeat(Math.ceil(chars / 5)).slice(0, chars));
  };
  faux.setResponses([step]);

  return faux;
}

/**
 * `agents@0.29.0` と `0.30.x` が実際に投げるストリーム断の文言。
 * C11 のバージョン対照は、この 2 つを撃ち分けて作る。
 */
export const STREAM_ERRORS = {
  /** 0.29.0。pi-ai の再試行判定に当たらない */
  old: "The stream ended before the model finished its answer.",
  /** 0.30.x。"ended without" に当たるので再試行される */
  new: "The stream ended without the model finishing its answer.",
  /** 0.29.0 のアイドル検出 */
  oldIdle: "Model stream stalled: no data received for 60s.",
  /** 0.30.x のアイドル検出。"timed? out" に当たる */
  newIdle: "Model stream timed out: no data received for 60s.",
  /** 対照: 明確に再試行対象外のもの */
  terminal: "insufficient_quota: the account has no remaining credit.",
} as const;

export type Scenario =
  | { kind: "answer"; text: string }
  | { kind: "call_tool"; tool: string; key: string; then: string }
  | { kind: "stream_error"; errorMessage: string; failures: number; then: string }
  /**
   * C14: ツール呼び出しを積んだまま、ストリームが切れたことにする。
   * `stopReason: "error"` なので、Pi はツールを走らせずに再試行するはず。
   * 対照は同じ中身で `stopReason: "toolUse"`（= 正常完了）。
   */
  | {
      kind: "tool_then_cut";
      tool: string;
      key: string;
      then: string;
      failures: number;
      /** true にすると対照（切れずに正常なツール呼び出しとして返す） */
      control?: boolean;
    }
  /**
   * C38: 1 つのハーネスで 2 本を並行させる。
   * 応答はプロンプトの目印で振り分けるので、セッションごとの scenario を持たずに済む。
   *   "LONGRUN" → 長く走るツールを呼ぶ（= work がある状態を作る）
   *   "RETRYME" → 再試行対象のエラーを返す（= sleeping なタスクを作る）
   */
  | { kind: "c38" };

export function createFaux(deps: { state: LabState; evidence: Evidence }): FauxProviderHandle {
  const faux = fauxProvider({
    provider: "faux",
    api: "faux",
    models: [{ id: FAUX_MODEL_ID, name: "Recovery Lab", contextWindow: 128_000, maxTokens: 4096 }],
  });

  // 応答を 1 本の関数で決める。呼ばれるたびに耐久状態を読み直す。
  //
  // `setResponses` はキューなので、1 回呼ばれると空になる。
  // 1 ターンで終わらないシナリオ（ツール呼び出し → 結果 → 締め）を回すため、
  // 毎回自分を積み直して尽きないようにする。
  const step = async (
    _context: Parameters<FauxResponseFactory>[0],
    _options: Parameters<FauxResponseFactory>[1],
    state: Parameters<FauxResponseFactory>[2],
  ) => {
    faux.appendResponses([step]);
    {
      const raw = deps.state.get("scenario");
      const scenario: Scenario = raw ? JSON.parse(raw) : { kind: "answer", text: "ok" };
      const turn = await deps.state.bump("model:requests");

      await deps.evidence.record("model_request", {
        turn,
        fauxCallCount: state.callCount,
        scenario: scenario.kind,
      });

      switch (scenario.kind) {
        case "answer":
          return fauxAssistantMessage(scenario.text);

        case "call_tool": {
          // 1 回目はツールを呼び、ツール結果が戻ったら締める
          const calls = deps.state.counter(`model:called:${scenario.tool}`);
          if (calls === 0) {
            await deps.state.bump(`model:called:${scenario.tool}`);
            return fauxAssistantMessage(
              [fauxToolCall(scenario.tool, { key: scenario.key }, { id: `call-${scenario.key}` })],
              // `fauxAssistantMessage` の既定は "stop"。
              // ツール呼び出しブロックを積んでも、"toolUse" にしないと Pi は実行せずにターンを終える。
              { stopReason: "toolUse" },
            );
          }
          return fauxAssistantMessage(scenario.then);
        }

        case "c38": {
          const prompt = JSON.stringify(_context ?? "");
          if (prompt.includes("LONGRUN")) {
            const calls = deps.state.counter("model:called:longrun");
            if (calls === 0) {
              await deps.state.bump("model:called:longrun");
              return fauxAssistantMessage(
                [fauxToolCall("write_record", { key: "longrun" }, { id: "call-longrun" })],
                { stopReason: "toolUse" },
              );
            }
            return fauxAssistantMessage("long run done");
          }
          if (prompt.includes("RETRYME")) {
            const failed = deps.state.counter("model:failures");
            if (failed < 1) {
              await deps.state.bump("model:failures");
              deps.state.put("retry:scheduledAt", String(Date.now()));
              await deps.evidence.record("model_error", {
                turn, note: "RETRYME: 再試行待機に入る",
              });
              return fauxAssistantMessage("", {
                stopReason: "error",
                errorMessage: "The stream ended without the model finishing its answer.",
              });
            }
            deps.state.put("retry:resumedAt", String(Date.now()));
            await deps.evidence.record("observed", {
              probe: "retry_resumed",
              待機ミリ秒: Date.now() - Number(deps.state.get("retry:scheduledAt") ?? Date.now()),
            });
            return fauxAssistantMessage("retried");
          }
          return fauxAssistantMessage("no marker");
        }

        case "tool_then_cut": {
          const failed = deps.state.counter("model:failures");
          const call = fauxToolCall(scenario.tool, { key: scenario.key }, {
            id: `call-${scenario.key}-${failed}`,
          });
          if (!scenario.control && failed < scenario.failures) {
            await deps.state.bump("model:failures");
            await deps.evidence.record("model_error", {
              turn, failed: failed + 1, note: "ツール呼び出しを積んだままストリームが切れた",
            });
            // 途中まで流れたツール呼び出しを持ったまま、error で終わる
            return fauxAssistantMessage([call], {
              stopReason: "error",
              errorMessage: "The stream ended without the model finishing its answer.",
            });
          }
          const calls = deps.state.counter(`model:called:${scenario.tool}`);
          if (calls === 0) {
            await deps.state.bump(`model:called:${scenario.tool}`);
            return fauxAssistantMessage([call], { stopReason: "toolUse" });
          }
          return fauxAssistantMessage(scenario.then);
        }

        case "stream_error": {
          const failed = deps.state.counter("model:failures");
          if (failed < scenario.failures) {
            await deps.state.bump("model:failures");
            await deps.evidence.record("model_error", {
              turn, failed: failed + 1, errorMessage: scenario.errorMessage,
            });
            return fauxAssistantMessage("", {
              stopReason: "error",
              errorMessage: scenario.errorMessage,
            });
          }
          return fauxAssistantMessage(scenario.then);
        }
      }
    }
  };

  faux.setResponses([step]);

  return faux;
}
