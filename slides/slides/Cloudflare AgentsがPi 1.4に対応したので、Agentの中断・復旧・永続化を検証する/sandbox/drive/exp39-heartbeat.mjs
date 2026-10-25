/**
 * C39: 処理中の alarm は 30 秒ごとに再設定されるか。
 *
 * backoff を heartbeat（30 秒）より**長く**する。
 * 短いと `min(heartbeat, wake.at)` が常に wake.at になり、両者が区別できない。
 * 前回 20 秒で測って判別しなかったのはこれが理由。
 *
 * 予想:
 *   onWake なし → 30 秒で頭打ちのノコギリ波（heartbeat が再設定する）
 *   onWake あり → wake 時刻まで単調に減る
 *
 * 注意: 5 秒ごとに /info を叩くのでオブジェクトは起き続ける。
 *       ここで測っているのは alarm の予定であって、Hibernation ではない。
 *
 *   node drive/exp39-heartbeat.mjs [baseUrl] [backoffMs]
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:8799";
const BACKOFF = Number(process.argv[3] ?? 100_000);
const RUN = process.env.RUN_ID ?? Date.now().toString(36);
console.log(`run=${RUN} base=${BASE} ツール滞留=${BACKOFF}ms heartbeat=30000ms`);

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

const out = [];
for (const onWake of ["off", "on"]) {
  const lab = `hb-${RUN}-${onWake}`;
  await call(`/reset?lab=${lab}`, {});
  // **スリープ中ではなく「処理中」を測る。**
  // リトライ backoff は sleeping であって work ではないので、
  // 前回はそこを測ってしまい C39 の条件を外した。
  // ここでは長く走るツールを使って、Pi が実際に work を持っている間を測る。
  await call(`/settings?lab=${lab}`, { onWake, toolSleepMs: String(BACKOFF) });
  await call(`/scenario?lab=${lab}`, {
    kind: "call_tool", tool: "write_record", key: "hb", then: "done",
  });
  await call(`/submit?lab=${lab}`, { text: "go", operationId: "op-1" });

  const samples = [];
  const until = Date.now() + BACKOFF - 8000;
  while (Date.now() < until) {
    await sleep(5000);
    const info = await call(`/info?lab=${lab}`);
    samples.push(info.nextAlarm ? Math.round((info.nextAlarm - Date.now()) / 1000) : null);
  }
  const result = await call(`/wait?lab=${lab}&op=op-1`);
  const row = { onWake, samples, status: result.status };
  out.push(row);
  console.log(
    `  onWake=${onWake.padEnd(3)} alarm(秒): ` +
    `${samples.map((v) => (v === null ? "なし" : String(v).padStart(3))).join(" ")}  → ${result.status}`,
  );
  console.log(`           最大値=${Math.max(...samples.filter((v) => v !== null))}`);
}

const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("data", { recursive: true });
writeFileSync(
  `data/heartbeat-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  JSON.stringify(out, null, 2),
);
console.log("\n完了");
