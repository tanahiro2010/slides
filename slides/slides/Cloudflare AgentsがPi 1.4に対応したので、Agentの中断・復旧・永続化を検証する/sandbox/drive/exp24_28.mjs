/**
 * C24: タスクが新しい状態をコミットすると再起動カウントが戻るか。
 * C28: parked になったタスクを session.abort() で放棄できるか。
 *
 * C24 の前回の失敗:
 *   「進捗」として自前カウンタの更新を使ってしまった。
 *   Pi から見ればそれは進捗ではない。今回は `api.output()` を刻んで
 *   タスク自身に進捗をコミットさせる。
 *
 *   node drive/exp24_28.mjs [baseUrl]
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
      signal: AbortSignal.timeout(60_000),
    });
    return await res.json();
  } catch (error) {
    return { _failed: true, message: String(error?.message ?? error) };
  }
}

async function runUntilSettledOrParked(lab, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let pending = [];
  while (Date.now() < deadline) {
    pending = await call(`/pending?lab=${lab}`);
    if (Array.isArray(pending)) {
      if (pending.some((p) => p.status === "parked")) return { parked: true, pending };
      if (pending.length === 0) return { parked: false, settled: true, pending };
    }
    await sleep(2000);
  }
  return { parked: false, timedOut: true, pending };
}

const out = {};

// --- C24 ---
console.log("\n######## C24: 進捗のコミットで再起動カウントが戻るか");
for (const [name, progress] of [["進捗なし", 0], ["進捗あり", 4]]) {
  const lab = `c24-${RUN}-${progress}`;
  await call(`/reset?lab=${lab}`, {});
  await call(`/settings?lab=${lab}`, {
    restartLimit: "2",
    toolProgress: String(progress),
    toolSleepMs: progress ? "2400" : "0",
  });
  await call(`/scenario?lab=${lab}`, {
    kind: "call_tool", tool: "bump_safe_unguarded", key: "c24", then: "done",
  });
  await call(`/arm?lab=${lab}`, {
    id: "loop", at: "bump_safe_unguarded:before_commit", mode: "abort", times: 20,
  });
  await call(`/submit?lab=${lab}`, { text: "go", operationId: "op-1" });

  const r = await runUntilSettledOrParked(lab, 150_000);
  const counters = await call(`/counters?lab=${lab}`);
  const events = await call(`/events?lab=${lab}`);
  const list = Array.isArray(events) ? events : [];
  const row = {
    name, progress,
    parked: r.parked,
    timedOut: !!r.timedOut,
    faults: list.filter((e) => e.event === "fault_injected").length,
    restarts: list.filter((e) => e.event === "instance_started").length,
    progressCommits: counters["tool:progress"] ?? 0,
  };
  out[`c24_${progress}`] = row;
  console.log(
    `  ${name}（output ${progress} 回）: parked=${row.parked} timedOut=${row.timedOut} ` +
    `障害発火=${row.faults} 再起動=${row.restarts} 進捗=${row.progressCommits}`,
  );
}

// --- C28 ---
console.log("\n######## C28: parked を session.abort() で放棄できるか");
{
  const lab = `c28-${RUN}`;
  await call(`/reset?lab=${lab}`, {});
  await call(`/settings?lab=${lab}`, { restartLimit: "2" });
  await call(`/scenario?lab=${lab}`, {
    kind: "call_tool", tool: "bump_safe_unguarded", key: "c28", then: "done",
  });
  await call(`/arm?lab=${lab}`, {
    id: "loop", at: "bump_safe_unguarded:before_commit", mode: "abort", times: 20,
  });
  await call(`/submit?lab=${lab}`, { text: "go", operationId: "op-1" });

  const r = await runUntilSettledOrParked(lab, 150_000);
  console.log(`  parked になったか: ${r.parked}`);

  // 障害は armed のまま。retry ではなく abort で片付くかを見る。
  const aborted = await call(`/abort?lab=${lab}`, {});
  await sleep(4000);
  const after = await call(`/pending?lab=${lab}`);
  const waited = await Promise.race([
    call(`/wait?lab=${lab}&op=op-1`),
    sleep(20_000).then(() => ({ _stillWaiting: true })),
  ]);
  out.c28 = {
    parkedBefore: r.parked,
    abort: aborted,
    pendingAfter: after,
    waitAfter: waited,
  };
  console.log(`  abort(): ${JSON.stringify(aborted)}`);
  console.log(`  abort 後の pending: ${JSON.stringify(after)}`);
  console.log(`  abort 後の wait(): ${JSON.stringify(waited)}`);
}

const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("data", { recursive: true });
writeFileSync(
  `data/c24_28-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  JSON.stringify(out, null, 2),
);
console.log("\n完了");
