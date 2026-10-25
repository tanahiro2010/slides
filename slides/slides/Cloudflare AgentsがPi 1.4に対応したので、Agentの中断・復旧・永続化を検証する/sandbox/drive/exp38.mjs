/**
 * C38: 他タスクの実行中でも、期限の来たスリープが再開されるか。
 *
 * issue #2683 の条件を作る。
 *   セッション A: 長く走るツール（= work がある）
 *   セッション B: 再試行待機に入る（= sleeping なタスク）
 *
 * 対照は「A を走らせない」場合。
 * B 単独なら、どのバージョンでも backoff ちょうどで再開するはず。
 *
 *   node drive/exp38.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:8799";
const RUN = process.env.RUN_ID ?? Date.now().toString(36);
const BACKOFF = Number(process.env.BACKOFF ?? 12_000);
const LONG = Number(process.env.LONG ?? 60_000);
console.log(`run=${RUN} base=${BASE} backoff=${BACKOFF}ms 長いツール=${LONG}ms`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(path, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    return await res.json();
  } catch (error) {
    return { _failed: true, message: String(error?.message ?? error) };
  }
}

async function scenario(name, { withLongTask }) {
  const lab = `c38-${RUN}-${name}`;
  console.log(`\n######## ${name}（並行する work: ${withLongTask ? "あり" : "なし"}）`);

  await call(`/reset?lab=${lab}`, {});
  await call(`/settings?lab=${lab}`, {
    onWake: "on",
    baseDelayMs: String(BACKOFF),
    maxRetries: "3",
    toolSleepMs: String(LONG),
  });
  await call(`/scenario?lab=${lab}`, { kind: "c38" });

  if (withLongTask) {
    // 先に長いタスクを起こす。これが走っている間に B を眠らせる。
    const sessionA = await call(`/session/create?lab=${lab}`, {});
    await call(`/submit?lab=${lab}`, {
      text: "LONGRUN please", operationId: "op-a", session: sessionA.id,
    });
    await sleep(3000);
  }

  // B は root セッション
  const started = Date.now();
  await call(`/submit?lab=${lab}`, { text: "RETRYME please", operationId: "op-b" });

  const result = await call(`/wait?lab=${lab}&op=op-b`);
  const elapsed = Date.now() - started;
  const counters = await call(`/counters?lab=${lab}`);
  const kv = await call(`/events?lab=${lab}`);
  const list = Array.isArray(kv) ? kv : [];
  const resumed = list.find((e) => e.metadata?.probe === "retry_resumed");

  const row = {
    name,
    withLongTask,
    status: result.status,
    reason: result.reason ?? "-",
    elapsedMs: elapsed,
    待機ミリ秒: resumed?.metadata?.待機ミリ秒 ?? null,
    modelRequests: counters["model:requests"] ?? 0,
  };
  console.log(
    `  B の結果: ${row.status} / 所要 ${Math.round(elapsed / 1000)}s / ` +
    `実測の待機 ${row.待機ミリ秒 === null ? "不明" : Math.round(row.待機ミリ秒 / 1000) + "s"}`,
  );
  console.log(`  期待する待機: ${Math.round(BACKOFF / 1000)}s（backoff ちょうど）`);
  return row;
}

const out = [];
out.push(await scenario("control-alone", { withLongTask: false }));
out.push(await scenario("with-running-task", { withLongTask: true }));

console.log("\n=== C38 まとめ");
console.log("| 条件 | B の待機（実測） | B の所要 | 結果 |");
console.log("| --- | ---: | ---: | --- |");
for (const r of out) {
  console.log(
    `| ${r.withLongTask ? "並行する work あり" : "B 単独（対照）"} ` +
    `| ${r.待機ミリ秒 === null ? "不明" : Math.round(r.待機ミリ秒 / 1000) + "s"} ` +
    `| ${Math.round(r.elapsedMs / 1000)}s | \`${r.status}\` |`,
  );
}

const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("data", { recursive: true });
writeFileSync(
  `data/c38-${process.env.LABEL ?? "run"}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  JSON.stringify(out, null, 2),
);
console.log("\n完了");
