/**
 * C15: 15 分を超えるモデルストリームは切られるか。
 *
 * 公式ドキュメントの Limitations より。
 *   > The wake-up job waits inside an alarm invocation, and an alarm invocation
 *   > runs for up to 15 minutes. The harness hands off to a new alarm every
 *   > 10 minutes, but one model request that streams for more than 15 minutes
 *   > can be cut off.
 *
 * faux の `tokensPerSecond: 1` で、実際に時間のかかるストリームを作る。
 * `estimateTokens` は ceil(文字数 / 4) なので、4 文字で 1 秒。
 *
 * **中断・再開できる。** 状態を 1 プローブごとに保存し、
 * 再開時は保存した開始時刻から経過を計算する。
 *
 *   node drive/exp15-longstream.mjs <baseUrl> <chars> [--new]
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const BASE = process.argv[2];
if (!BASE) throw new Error("baseUrl が要る");
const CHARS = Number(process.argv[3] ?? 4400);
const FRESH = process.argv.includes("--new");
const STATE = `data/c15-state-${CHARS}.json`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(path, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    return await res.json();
  } catch (error) {
    return { _failed: true, message: String(error?.message ?? error) };
  }
}

mkdirSync("data", { recursive: true });

/** 状態を読む。無ければ新しい run を始める。 */
async function loadOrStart() {
  if (!FRESH && existsSync(STATE)) {
    const saved = JSON.parse(readFileSync(STATE, "utf8"));
    console.log(`再開: lab=${saved.lab} 開始から ${Math.round((Date.now() - saved.startedAt) / 1000)}s`);
    return saved;
  }
  const lab = `c15-${Date.now().toString(36)}-${CHARS}`;
  await call(`/reset?lab=${lab}`, {});
  await call(`/settings?lab=${lab}`, { slowChars: String(CHARS) });
  const model = await call(`/slow-model?lab=${lab}`, {});
  const info = await call(`/info?lab=${lab}`);
  await call(`/submit?lab=${lab}`, { text: "stream slowly", operationId: "op-1" });

  const run = {
    lab,
    chars: CHARS,
    予想秒数: Math.round(CHARS / 4),
    startedAt: Date.now(),
    instanceAtStart: info.instanceId,
    model,
    probes: [],
  };
  writeFileSync(STATE, JSON.stringify(run, null, 2));
  console.log(`開始: lab=${lab} 文字数=${CHARS} 予想=${run.予想秒数}s（約 ${(run.予想秒数 / 60).toFixed(1)} 分）`);
  return run;
}

const run = await loadOrStart();

// 60 秒ごとに様子を見る。間隔が短いとオブジェクトを起こし続けてしまう。
const PROBE_INTERVAL_MS = 60_000;
const MAX_MS = (run.予想秒数 + 420) * 1000;

for (;;) {
  const elapsed = Date.now() - run.startedAt;
  if (elapsed > MAX_MS) {
    console.log("上限に達した。打ち切る。");
    break;
  }

  const pending = await call(`/pending?lab=${run.lab}`);
  const counters = await call(`/counters?lab=${run.lab}`);
  const info = await call(`/info?lab=${run.lab}`);

  const probe = {
    elapsedSeconds: Math.round(elapsed / 1000),
    pending: Array.isArray(pending) ? pending.map((p) => p.status) : pending,
    modelRequests: counters["model:requests"] ?? 0,
    instanceId: info.instanceId,
    instanceChanged: info.instanceId !== run.instanceAtStart,
  };
  run.probes.push(probe);
  writeFileSync(STATE, JSON.stringify(run, null, 2));   // 1 プローブごとに保存
  console.log(
    `  ${String(probe.elapsedSeconds).padStart(4)}s  pending=${JSON.stringify(probe.pending)} ` +
    `モデル呼び出し=${probe.modelRequests} インスタンス変化=${probe.instanceChanged}`,
  );

  if (Array.isArray(pending) && pending.length === 0) {
    const result = await call(`/wait?lab=${run.lab}&op=op-1`);
    run.result = result;
    run.finishedSeconds = probe.elapsedSeconds;
    writeFileSync(STATE, JSON.stringify(run, null, 2));
    console.log(`\n決着: ${JSON.stringify(result)} （${probe.elapsedSeconds}s）`);
    console.log(`モデル呼び出し合計: ${probe.modelRequests}`);
    break;
  }
  await sleep(PROBE_INTERVAL_MS);
}

console.log(`\n状態: ${STATE}`);
console.log("完了");
