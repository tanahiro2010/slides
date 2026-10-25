/**
 * C20: 中断された unsafe ツールを、モデルが呼び直すか。
 *
 * **偽モデルでは測れない。** 応答を自分で書く以上、モデルの判断は観測できない。
 * ここだけ Workers AI の実モデルを使う。
 *
 * 対照は「中断しない同じプロンプト」。
 * これが無いと、「中断されたから呼び直した」と
 * 「このモデルはもともと 2 回呼ぶ」が区別できない。
 *
 *   node drive/exp04-c20.mjs <baseUrl> [trials]
 */

const BASE = process.argv[2];
if (!BASE) throw new Error("baseUrl が要る");
const TRIALS = Number(process.argv[3] ?? 4);
const RUN = process.env.RUN_ID ?? Date.now().toString(36);
console.log(`run=${RUN} base=${BASE} trials=${TRIALS}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(path, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    return await res.json();
  } catch (error) {
    return { _failed: true, message: String(error?.message ?? error) };
  }
}

const PROMPT =
  "Call the bump_unsafe tool exactly once with key \"c20\". " +
  "After the tool returns, reply with the final counter value and stop.";

async function trial(i, { interrupt }) {
  const lab = `c20-${RUN}-${interrupt ? "cut" : "clean"}-${i}`;
  await call(`/reset?lab=${lab}`, {});
  await call(`/real-model?lab=${lab}`, {});
  if (interrupt) {
    // 副作用が確定した直後に 1 回だけ落とす
    await call(`/arm?lab=${lab}`, {
      id: "f1", at: "bump_unsafe:after_commit", mode: "abort", times: 1,
    });
  }

  await call(`/submit?lab=${lab}`, { text: PROMPT, operationId: "op-1" });

  // 決着するまで待つ
  const deadline = Date.now() + 150_000;
  let pending = null;
  while (Date.now() < deadline) {
    pending = await call(`/pending?lab=${lab}`);
    if (Array.isArray(pending) && pending.length === 0) break;
    await sleep(3000);
  }
  const counters = await call(`/counters?lab=${lab}`);
  const info = await call(`/info?lab=${lab}`);
  const events = await call(`/events?lab=${lab}`);
  const list = Array.isArray(events) ? events : [];

  const row = {
    lab,
    interrupt,
    realModel: info.realModel,
    toolStarted: counters["bump_unsafe:started"] ?? 0,
    sideEffects: counters["side_effect:bump_unsafe"] ?? 0,
    toolFinished: counters["bump_unsafe:finished"] ?? 0,
    restarts: list.filter((e) => e.event === "instance_started").length,
    faults: list.filter((e) => e.event === "fault_injected").length,
    settled: Array.isArray(pending) && pending.length === 0,
  };
  console.log(
    `  ${interrupt ? "中断あり" : "中断なし"} #${i}: ` +
    `実モデル=${row.realModel} 実行=${row.toolStarted} 副作用=${row.sideEffects} ` +
    `完了=${row.toolFinished} 再起動=${row.restarts} 決着=${row.settled}`,
  );
  return row;
}

const rows = [];
console.log("\n######## 対照: 中断しない（このモデルがもともと何回呼ぶか）");
for (let i = 0; i < TRIALS; i += 1) rows.push(await trial(i, { interrupt: false }));

console.log("\n######## 本番: 副作用確定直後に中断する");
for (let i = 0; i < TRIALS; i += 1) rows.push(await trial(i, { interrupt: true }));

const summarize = (flag) => {
  const sub = rows.filter((r) => r.interrupt === flag);
  const dist = {};
  for (const r of sub) dist[r.sideEffects] = (dist[r.sideEffects] ?? 0) + 1;
  return { n: sub.length, dist };
};

console.log("\n=== C20 まとめ（副作用回数の分布）");
console.log(`  中断なし: ${JSON.stringify(summarize(false))}`);
console.log(`  中断あり: ${JSON.stringify(summarize(true))}`);

const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("data", { recursive: true });
writeFileSync(
  `data/c20-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  JSON.stringify(rows, null, 2),
);
console.log("\n完了");
