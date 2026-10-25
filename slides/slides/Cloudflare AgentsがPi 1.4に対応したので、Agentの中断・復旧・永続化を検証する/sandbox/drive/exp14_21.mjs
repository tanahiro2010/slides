/**
 * C14: 途中まで流れたツール呼び出しは、再試行の前に実行されないか。
 * C21: 中断されたツール呼び出しは transcript にどう残るか。
 *
 *   node drive/exp14_21.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:8799";
const RUN = process.env.RUN_ID ?? Date.now().toString(36);
console.log(`run=${RUN} base=${BASE}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(path, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    return await res.json();
  } catch (error) {
    return { _failed: true, message: String(error?.message ?? error) };
  }
}

// --- C14 ---
console.log("\n######## C14: 切れたストリームに積まれたツール呼び出し");
const c14 = [];
for (const control of [true, false]) {
  const lab = `c14-${RUN}-${control ? "control" : "cut"}`;
  await call(`/reset?lab=${lab}`, {});
  await call(`/settings?lab=${lab}`, { baseDelayMs: "300", maxRetries: "3" });
  await call(`/scenario?lab=${lab}`, {
    kind: "tool_then_cut", tool: "bump_unsafe", key: "c14",
    then: "done", failures: 1, control,
  });
  await call(`/submit?lab=${lab}`, { text: "go", operationId: "op-1" });
  const result = await call(`/wait?lab=${lab}&op=op-1`);
  const counters = await call(`/counters?lab=${lab}`);
  const row = {
    control,
    status: result.status,
    modelRequests: counters["model:requests"] ?? 0,
    toolStarted: counters["bump_unsafe:started"] ?? 0,
    sideEffects: counters["side_effect:bump_unsafe"] ?? 0,
  };
  c14.push(row);
  console.log(
    `  ${control ? "対照（切れない）" : "本番（切れる）  "}: status=${row.status} ` +
    `モデル呼び出し=${row.modelRequests} ツール実行=${row.toolStarted} 副作用=${row.sideEffects}`,
  );
}

// --- C21 ---
console.log("\n######## C21: 中断されたツール呼び出しの transcript");
const c21 = {};
for (const interrupt of [false, true]) {
  const lab = `c21-${RUN}-${interrupt ? "cut" : "clean"}`;
  await call(`/reset?lab=${lab}`, {});
  await call(`/scenario?lab=${lab}`, {
    kind: "call_tool", tool: "bump_unsafe", key: "c21", then: "done",
  });
  if (interrupt) {
    await call(`/arm?lab=${lab}`, {
      id: "f1", at: "bump_unsafe:after_commit", mode: "abort", times: 1,
    });
  }
  await call(`/submit?lab=${lab}`, { text: "go", operationId: "op-1" });

  const deadline = Date.now() + 90_000;
  let pending = null;
  while (Date.now() < deadline) {
    pending = await call(`/pending?lab=${lab}`);
    if (Array.isArray(pending) && pending.length === 0) break;
    await sleep(2000);
  }
  const transcript = await call(`/transcript?lab=${lab}`);
  const list = Array.isArray(transcript) ? transcript : [];
  c21[interrupt ? "cut" : "clean"] = list.map((e) => e.kind);
  console.log(`  ${interrupt ? "中断あり" : "中断なし"}: ${list.map((e) => e.kind).join(" → ")}`);

  // tool-result の中身を見る（中断がどう表現されるか）
  for (const e of list) {
    if (e.kind !== "pi.tool-result") continue;
    const m = e.raw.match(/"(isError|interrupted|status|error)"\s*:\s*("[^"]*"|true|false)/g);
    console.log(`    tool-result の手がかり: ${m ? m.join(", ") : "(該当なし)"}`);
    console.log(`    先頭: ${e.raw.slice(0, 260)}`);
  }
}

const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("data", { recursive: true });
writeFileSync(
  `data/c14_21-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  JSON.stringify({ c14, c21 }, null, 2),
);
console.log("\n完了");
