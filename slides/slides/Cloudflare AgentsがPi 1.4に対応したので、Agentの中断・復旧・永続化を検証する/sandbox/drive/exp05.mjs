/**
 * EXP-05: Parked Tasks と手動復旧。C23 / C24 / C25 / C26 / C27 / C29。
 *
 * 対照は「何が再起動として数えられるか」。
 *   - `ctx.abort()`（本物のリセット）→ 数えられるはず
 *   - 例外送出               → 数えられないはず（README「a close is not counted」）
 *
 * `restartLimit` は 2 に下げる。既定の 5 だと heartbeat 30 秒 × 5 で待ち時間が伸びる。
 *
 *   node drive/exp05.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:8799";
const RUN = process.env.RUN_ID ?? Date.now().toString(36);
console.log(`run=${RUN} base=${BASE}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 呼ぶ。クラッシュ中はリクエスト自体が落ちるので、失敗を結果として返す。
 * 通信層は例外を投げない。
 */
async function call(path, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    return await res.json();
  } catch (error) {
    return { _failed: true, message: String(error?.message ?? error) };
  }
}

/** `pending()` に `parked` が出るまで待つ。出なければ時間切れとして返す。 */
async function waitForParked(lab, timeoutMs = 150_000) {
  const deadline = Date.now() + timeoutMs;
  const seen = [];
  let polls = 0;
  while (Date.now() < deadline) {
    polls += 1;
    const pending = await call(`/pending?lab=${lab}`);
    if (Array.isArray(pending)) {
      const statuses = pending.map((p) => p.status).join(",") || "(空)";
      if (seen.at(-1) !== statuses) seen.push(statuses);
      if (pending.some((p) => p.status === "parked")) {
        return { parked: true, waitedMs: timeoutMs - (deadline - Date.now()), seen };
      }
      if (pending.length === 0 && polls > 8) {
        return { parked: false, settled: true, waitedMs: timeoutMs - (deadline - Date.now()), seen };
      }
    }
    await sleep(2000);
  }
  return { parked: false, timedOut: true, seen };
}

async function scenario(name, { mode, times, restartLimit }) {
  const lab = `exp05-${RUN}-${name}`;
  console.log(`\n######## ${name}  mode=${mode} times=${times} restartLimit=${restartLimit}`);

  await call(`/reset?lab=${lab}`, {});
  await call(`/settings?lab=${lab}`, { restartLimit: String(restartLimit) });
  // **safe なツールを使う。**
  // unsafe なツールは中断後に再実行されないので、そもそもクラッシュループにならない。
  // 進捗を出さないまま毎回同じ場所で落とすには、再実行される側でなければ届かない。
  await call(`/scenario?lab=${lab}`, {
    kind: "call_tool", tool: "bump_safe_unguarded", key: "k1", then: "done",
  });
  await call(`/arm?lab=${lab}`, {
    id: "loop", at: "bump_safe_unguarded:before_commit", mode, times,
  });

  await call(`/submit?lab=${lab}`, { text: "go", operationId: "op-1" });
  const result = await waitForParked(lab);

  const counters = await call(`/counters?lab=${lab}`);
  const events = await call(`/events?lab=${lab}`);
  const info = await call(`/info?lab=${lab}`);
  const faults = events.filter?.((e) => e.event === "fault_injected").length ?? 0;
  const restarts = events.filter?.((e) => e.event === "instance_started").length ?? 0;
  const reports = events.filter?.((e) => e.event === "report") ?? [];

  console.log(`  parked=${result.parked} 経過=${Math.round((result.waitedMs ?? 0) / 1000)}s`);
  console.log(`  pending の遷移: ${result.seen.join("  →  ")}`);
  console.log(`  障害発火=${faults} インスタンス生成=${restarts} 実行開始=${counters["bump_safe_unguarded:started"] ?? 0}`);
  console.log(`  onReport: ${reports.map((r) => r.metadata.type).join(",") || "(なし)"}`);
  console.log(`  次の alarm: ${info.nextAlarm ?? "なし"}`);

  return { lab, name, mode, restartLimit, result, faults, restarts, reports, info, counters };
}

const out = [];

// 本命: 本物のリセットを繰り返す → parked になるはず
out.push(await scenario("abort-loop", { mode: "abort", times: 10, restartLimit: 2 }));

// 対照: 例外送出を繰り返す → parked にならないはず（数えられない）
out.push(await scenario("throw-loop", { mode: "throw", times: 10, restartLimit: 2 }));

// --- C27 / C29: 障害を解除して retry ---
const parkedRun = out.find((o) => o.result.parked);
if (parkedRun) {
  console.log(`\n######## C27: 障害を解除して retry（${parkedRun.lab}）`);
  const beforeAlarm = (await call(`/info?lab=${parkedRun.lab}`)).nextAlarm;
  await call(`/disarm?lab=${parkedRun.lab}`, {});
  const retried = await call(`/retry?lab=${parkedRun.lab}`, {});
  console.log(`  retry() = ${JSON.stringify(retried)}`);

  const deadline = Date.now() + 120_000;
  let pending = null;
  while (Date.now() < deadline) {
    pending = await call(`/pending?lab=${parkedRun.lab}`);
    if (Array.isArray(pending) && pending.length === 0) break;
    await sleep(2000);
  }
  const counters = await call(`/counters?lab=${parkedRun.lab}`);
  console.log(`  retry 後の pending: ${JSON.stringify(pending)}`);
  console.log(`  副作用: ${counters["side_effect:bump_safe_unguarded"] ?? 0}`);
  console.log(`  parked 中の alarm: ${beforeAlarm ?? "なし"}（C26: 起こし続けないこと）`);

  // C27 の対照: 何も parked されていない状態で retry すると false
  const again = await call(`/retry?lab=${parkedRun.lab}`, {});
  console.log(`  対照 — 何も parked でないときの retry() = ${JSON.stringify(again)}`);
}

const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("data", { recursive: true });
writeFileSync(
  `data/exp05-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  JSON.stringify(out, null, 2),
);
console.log("\n完了");
