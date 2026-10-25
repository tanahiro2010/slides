/**
 * EXP-04: ツール実行中の中断と Replay。C17 / C18 / C19。
 *
 * 4 本のツールを**同じ条件**で中断させて、実行回数と副作用回数を並べる。
 * 対照を別々に走らせると条件が揃わないので、1 本のスクリプトに入れている。
 *
 *   node drive/exp04.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:8799";

// Durable Object は実行ごとに新しい名前を使う。
// 名前を使い回すと、前回の失敗した run に積まれた submission が先に走ってしまい、
// 今回測りたい条件が揃わない（`settings.afterFailedRun` の既定が `keep` のため）。
// C41（Pi 1.4 のマイグレーションは一方向）の観点でも、使い回しは避ける。
const RUN = process.env.RUN_ID ?? Date.now().toString(36);
console.log(`run=${RUN} base=${BASE}`);

const call = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.json();
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 再起動を待つ。instanceId が変わるまで、または諦めるまで。 */
async function waitForRestart(lab, before, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const info = await call(`/info?lab=${lab}`).catch(() => null);
    if (info?.instanceId && info.instanceId !== before) {
      return { restarted: true, waitedMs: timeoutMs - (deadline - Date.now()), info };
    }
    await sleep(1000);
  }
  return { restarted: false, waitedMs: timeoutMs, info: await call(`/info?lab=${lab}`) };
}

/** タスクが落ち着くまで待つ。pending が空になるか、時間切れ。 */
async function settle(lab, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let last = [];
  while (Date.now() < deadline) {
    last = await call(`/pending?lab=${lab}`).catch(() => []);
    if (Array.isArray(last) && last.length === 0) return { settled: true, pending: last };
    await sleep(1000);
  }
  return { settled: false, pending: last };
}

const TOOLS = [
  { tool: "write_record", replay: "safe", idempotent: true },
  { tool: "bump_unsafe", replay: "(未指定=unsafe)", idempotent: false },
  { tool: "bump_safe_unguarded", replay: "safe", idempotent: false },
  { tool: "bump_safe_guarded", replay: "safe", idempotent: true },
];

/** 中断の位置。PRD の「副作用確定前 / 確定直後」に対応する。 */
const POINTS = ["before_commit", "after_commit"];

const rows = [];

for (const t of TOOLS) {
  for (const point of POINTS) {
    const lab = `exp04-${RUN}-${t.tool}-${point}`;
    await call(`/reset?lab=${lab}`, {});
    await call(`/scenario?lab=${lab}`, {
      kind: "call_tool", tool: t.tool, key: "k1", then: "done",
    });
    // 中断は 1 回だけ。2 回目以降は素通りさせる。
    await call(`/arm?lab=${lab}`, {
      id: "f1", at: `${t.tool}:${point}`, mode: "abort", times: 1,
    });

    const before = (await call(`/info?lab=${lab}`)).instanceId;
    await call(`/submit?lab=${lab}`, { text: `use ${t.tool}`, operationId: "op-1" });

    const restart = await waitForRestart(lab, before);
    const after = await settle(lab);
    const counters = await call(`/counters?lab=${lab}`);
    const events = await call(`/events?lab=${lab}`);

    const sideEffectKey = t.tool === "write_record"
      ? "write_record:committed"
      : `side_effect:${t.tool}`;

    rows.push({
      tool: t.tool,
      replay: t.replay,
      point,
      restarted: restart.restarted,
      started: counters[`${t.tool}:started`] ?? 0,
      sideEffects: counters[sideEffectKey] ?? 0,
      finished: counters[`${t.tool}:finished`] ?? 0,
      modelRequests: counters["model:requests"] ?? 0,
      settled: after.settled,
      pending: after.pending,
      interrupted: events.filter((e) => e.event === "fault_injected").length,
    });

    console.log(
      `${t.tool.padEnd(20)} ${point.padEnd(14)} restart=${restart.restarted} ` +
      `started=${rows.at(-1).started} side=${rows.at(-1).sideEffects} finished=${rows.at(-1).finished}`,
    );
  }
}

console.log("\n=== EXP-04 結果 ===");
console.log(
  "| ツール | replay | 中断位置 | 再起動 | 実行開始 | 副作用 | 完了 | 決着 |",
);
console.log("| --- | --- | --- | --- | ---: | ---: | ---: | --- |");
for (const r of rows) {
  console.log(
    `| \`${r.tool}\` | ${r.replay} | ${r.point} | ${r.restarted ? "した" : "しない"} ` +
    `| ${r.started} | ${r.sideEffects} | ${r.finished} | ${r.settled ? "ついた" : "つかない"} |`,
  );
}

const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("data", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(`data/exp04-${stamp}.json`, JSON.stringify(rows, null, 2));
console.log(`\n書き出し: data/exp04-${stamp}.json`);
