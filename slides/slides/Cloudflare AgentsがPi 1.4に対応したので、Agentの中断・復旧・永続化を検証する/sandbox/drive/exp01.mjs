/**
 * EXP-01 の残りと、EXP-05 の積み残し。C05 / C06 / C07 / C21 / C24 / C29。
 *
 *   node drive/exp01.mjs [baseUrl]
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

const out = {};

// --- C05 / C06: 再起動を跨いだ永続化と、二重実行されないこと ---
{
  const lab = `exp01-${RUN}-persist`;
  console.log("\n######## C05 / C06: 再起動を跨いだ永続化");
  await call(`/reset?lab=${lab}`, {});
  await call(`/scenario?lab=${lab}`, { kind: "call_tool", tool: "bump_unsafe", key: "k1", then: "done" });

  await call(`/submit?lab=${lab}`, { text: "first", operationId: "op-1" });
  const first = await call(`/wait?lab=${lab}&op=op-1`);
  const before = await call(`/info?lab=${lab}`);
  const msgsBefore = await call(`/messages?lab=${lab}`);
  const countersBefore = await call(`/counters?lab=${lab}`);

  // 完了したあとに本物のリセットを撃つ
  await call(`/c02?lab=${lab}`);
  await sleep(2000);

  const after = await call(`/info?lab=${lab}`);
  const msgsAfter = await call(`/messages?lab=${lab}`);
  const countersAfter = await call(`/counters?lab=${lab}`);

  out.c05 = {
    first,
    instanceChanged: before.instanceId !== after.instanceId,
    entriesBefore: msgsBefore.length,
    entriesAfter: msgsAfter.length,
    toolStartedBefore: countersBefore["bump_unsafe:started"] ?? 0,
    toolStartedAfter: countersAfter["bump_unsafe:started"] ?? 0,
    sideEffectBefore: countersBefore["side_effect:bump_unsafe"] ?? 0,
    sideEffectAfter: countersAfter["side_effect:bump_unsafe"] ?? 0,
  };
  console.log(`  1 回目: ${JSON.stringify(first)}`);
  console.log(`  インスタンス変化: ${out.c05.instanceChanged}（対照。これが false だと C05 は言えない）`);
  console.log(`  transcript のエントリ数: ${out.c05.entriesBefore} → ${out.c05.entriesAfter}`);
  console.log(`  ツール実行開始: ${out.c05.toolStartedBefore} → ${out.c05.toolStartedAfter}（二重実行なら増える）`);
  console.log(`  副作用: ${out.c05.sideEffectBefore} → ${out.c05.sideEffectAfter}`);

  // --- C21: transcript に残るエントリの種別 ---
  out.c21 = { kinds: msgsAfter.map((m) => m.kind) };
  console.log(`  エントリ種別: ${out.c21.kinds.join(", ")}`);
}

// --- C07: operationId による冪等性 ---
{
  const lab = `exp01-${RUN}-idem`;
  console.log("\n######## C07: operationId の冪等性");
  await call(`/reset?lab=${lab}`, {});
  await call(`/scenario?lab=${lab}`, { kind: "answer", text: "ok" });

  const a = await call(`/submit?lab=${lab}`, { text: "x", operationId: "same" });
  await call(`/wait?lab=${lab}&op=same`);
  const b = await call(`/submit?lab=${lab}`, { text: "x", operationId: "same" });
  const c = await call(`/submit?lab=${lab}`, { text: "x", operationId: "different" });
  const counters = await call(`/counters?lab=${lab}`);

  out.c07 = { first: a, repeat: b, control: c, modelRequests: counters["model:requests"] ?? 0 };
  console.log(`  1 回目(same)      : ${JSON.stringify(a)}`);
  console.log(`  2 回目(same)      : ${JSON.stringify(b)}  ← accepted:false のはず`);
  console.log(`  対照(different)   : ${JSON.stringify(c)}  ← accepted:true のはず`);
  console.log(`  モデル呼び出し回数: ${out.c07.modelRequests}`);
}

// --- C24: 進捗をコミットすると再起動カウントが戻る ---
{
  console.log("\n######## C24: 進捗の有無で parked 到達が変わるか");
  for (const [name, at] of [["進捗なし", "before_commit"], ["進捗あり", "after_commit"]]) {
    const lab = `exp01-${RUN}-c24-${at}`;
    await call(`/reset?lab=${lab}`, {});
    await call(`/settings?lab=${lab}`, { restartLimit: "2" });
    await call(`/scenario?lab=${lab}`, {
      kind: "call_tool", tool: "bump_safe_unguarded", key: "k1", then: "done",
    });
    await call(`/arm?lab=${lab}`, {
      id: "loop", at: `bump_safe_unguarded:${at}`, mode: "abort", times: 10,
    });
    await call(`/submit?lab=${lab}`, { text: "go", operationId: "op-1" });

    let pending = [];
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      pending = await call(`/pending?lab=${lab}`);
      if (Array.isArray(pending) && (pending.length === 0 || pending.some((p) => p.status === "parked"))) break;
      await sleep(2000);
    }
    const counters = await call(`/counters?lab=${lab}`);
    const events = await call(`/events?lab=${lab}`);
    const list = Array.isArray(events) ? events : [];
    const row = {
      name, at,
      parked: Array.isArray(pending) && pending.some((p) => p.status === "parked"),
      faults: list.filter((e) => e.event === "fault_injected").length,
      restarts: list.filter((e) => e.event === "instance_started").length,
      sideEffects: counters["side_effect:bump_safe_unguarded"] ?? 0,
    };
    out[`c24_${at}`] = row;
    console.log(`  ${name}（${at}）: parked=${row.parked} 障害発火=${row.faults} 再起動=${row.restarts} 副作用=${row.sideEffects}`);
  }
}

// --- C29: parked の間も wait() は待ち続けるか ---
{
  const lab = `exp01-${RUN}-c29`;
  console.log("\n######## C29: parked 中の wait()");
  await call(`/reset?lab=${lab}`, {});
  await call(`/settings?lab=${lab}`, { restartLimit: "2" });
  await call(`/scenario?lab=${lab}`, {
    kind: "call_tool", tool: "bump_safe_unguarded", key: "k1", then: "done",
  });
  await call(`/arm?lab=${lab}`, {
    id: "loop", at: "bump_safe_unguarded:before_commit", mode: "abort", times: 10,
  });
  await call(`/submit?lab=${lab}`, { text: "go", operationId: "op-1" });

  let pending = [];
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    pending = await call(`/pending?lab=${lab}`);
    if (Array.isArray(pending) && pending.some((p) => p.status === "parked")) break;
    await sleep(2000);
  }

  // parked のまま wait() を張る。短いタイムアウトで戻らないことを見る。
  const waitStarted = Date.now();
  const waitResult = await Promise.race([
    call(`/wait?lab=${lab}&op=op-1`),
    sleep(15_000).then(() => ({ _stillWaiting: true })),
  ]);
  out.c29 = {
    parkedBeforeWait: Array.isArray(pending) && pending.some((p) => p.status === "parked"),
    waitResult,
    waitedMs: Date.now() - waitStarted,
  };
  console.log(`  parked だったか: ${out.c29.parkedBeforeWait}`);
  console.log(`  wait() の結果: ${JSON.stringify(waitResult)}（_stillWaiting なら待ち続けている）`);

  // 対照: 解除して retry すると解決する
  await call(`/disarm?lab=${lab}`, {});
  await call(`/retry?lab=${lab}`, {});
  const resolved = await Promise.race([
    call(`/wait?lab=${lab}&op=op-1`),
    sleep(40_000).then(() => ({ _stillWaiting: true })),
  ]);
  out.c29.afterRetry = resolved;
  console.log(`  対照 — retry 後の wait(): ${JSON.stringify(resolved)}`);
}

const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("data", { recursive: true });
writeFileSync(
  `data/exp01-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  JSON.stringify(out, null, 2),
);
console.log("\n完了");
