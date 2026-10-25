/**
 * EXP-02: クライアント切断と再接続。C08 / C10 / C43。
 *
 * 長めの run（リトライ backoff で稼ぐ）を流しながら WebSocket を切る。
 *
 *   node drive/exp02-ws.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:8799";
const WS_BASE = BASE.replace(/^http/, "ws");
const RUN = process.env.RUN_ID ?? Date.now().toString(36);
console.log(`run=${RUN} base=${BASE}`);

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

/** WebSocket を開いて、受け取ったメッセージを溜める。 */
function connect(lab, slow = 0) {
  const ws = new WebSocket(`${WS_BASE}/stream?lab=${lab}${slow ? `&slow=${slow}` : ""}`);
  const got = [];
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(true), { once: true });
    ws.addEventListener("error", (e) => reject(new Error(String(e?.message ?? "ws error"))), { once: true });
  });
  ws.addEventListener("message", (ev) => {
    try { got.push(JSON.parse(ev.data)); } catch { got.push({ raw: String(ev.data) }); }
  });
  return { ws, got, opened };
}

const out = {};

// --- C08: 切断しても実行が継続するか ---
{
  const lab = `ws-${RUN}-c08`;
  console.log("\n######## C08: 切断しても実行は続くか");
  await call(`/reset?lab=${lab}`, {});
  // backoff で run を長くする
  await call(`/settings?lab=${lab}`, { baseDelayMs: "6000", maxRetries: "3" });
  await call(`/scenario?lab=${lab}`, {
    kind: "stream_error",
    errorMessage: "The stream ended without the model finishing its answer.",
    failures: 2,
    then: "survived the disconnect",
  });

  const before = await call(`/info?lab=${lab}`);
  const a = connect(lab);
  await a.opened;
  console.log(`  接続した。snapshot: ${JSON.stringify(a.got[0] ?? null)}`);

  await call(`/submit?lab=${lab}`, { text: "go", operationId: "op-1" });
  await sleep(3000);

  a.ws.close();
  console.log(`  切断した（受信 ${a.got.length} 件）`);

  const result = await call(`/wait?lab=${lab}&op=op-1`);
  const after = await call(`/info?lab=${lab}`);
  const counters = await call(`/counters?lab=${lab}`);

  out.c08 = {
    status: result.status,
    text: result.text,
    modelRequests: counters["model:requests"] ?? 0,
    instanceSame: before.instanceId === after.instanceId,
    received: a.got.length,
  };
  console.log(`  結果: ${result.status} / ${JSON.stringify(result.text)}`);
  console.log(`  モデル呼び出し=${out.c08.modelRequests}`);
  console.log(`  インスタンス同一: ${out.c08.instanceSame}（対照。false なら再起動と区別できない）`);

  // --- C10: 再接続して snapshot から組み直せるか ---
  const b = connect(lab);
  await b.opened;
  await sleep(1500);
  out.c10 = { snapshot: b.got[0] ?? null, received: b.got.length };
  console.log(`  再接続の snapshot: ${JSON.stringify(out.c10.snapshot)}`);
  b.ws.close();
}

// --- C43: 遅いリスナーでイベントが畳まれるか ---
{
  console.log("\n######## C43: 遅いリスナーとイベントの取りこぼし");
  const rows = [];
  for (const slow of [0, 1500]) {
    const lab = `ws-${RUN}-c43-${slow}`;
    await call(`/reset?lab=${lab}`, {});
    await call(`/settings?lab=${lab}`, { baseDelayMs: "300", maxRetries: "3" });
    await call(`/scenario?lab=${lab}`, {
      kind: "call_tool", tool: "write_record", key: "c43", then: "done",
    });

    const c = connect(lab, slow);
    await c.opened;
    await call(`/submit?lab=${lab}`, { text: "go", operationId: "op-1" });
    await call(`/wait?lab=${lab}&op=op-1`);
    // 遅いリスナーを十分に流し切る。
    // ここを短くすると「畳まれた」と「自分が閉じて途切れた」が区別できない。
    await sleep(slow > 0 ? 30_000 : 4000);
    c.ws.close();
    await sleep(500);

    const events = await call(`/events?lab=${lab}`);
    const list = Array.isArray(events) ? events : [];
    const batches = list.filter((e) => e.metadata?.probe === "stream_batch");
    const last = batches.at(-1)?.metadata ?? {};
    const row = {
      slow,
      clientMessages: c.got.length,
      batches: last.batches ?? 0,
      events: last.events ?? 0,
    };
    rows.push(row);
    console.log(`  リスナー遅延 ${slow}ms: クライアント受信=${row.clientMessages} バッチ=${row.batches} イベント=${row.events}`);
  }
  out.c43 = rows;
}

const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("data", { recursive: true });
writeFileSync(
  `data/ws-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  JSON.stringify(out, null, 2),
);
console.log("\n完了");
