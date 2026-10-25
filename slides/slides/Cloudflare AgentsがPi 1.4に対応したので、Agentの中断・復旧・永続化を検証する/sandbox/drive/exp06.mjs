/**
 * EXP-06: Storage Error Recovery。C31 / C32 / C33 / C34。
 *
 * `Storage` インターフェースの契約が、doc より踏み込んだことを書いている。
 *
 *   「Any error from commit() or mintId() is fatal.」
 *   「Two errors of a read fail only that read: a StorageRequestError ...」
 *
 * 3 つの境界を撃ち分けて、どれが Session を殺すかを見る。
 *
 *   node drive/exp06.mjs [baseUrl]
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
      signal: AbortSignal.timeout(30_000),
    });
    return await res.json();
  } catch (error) {
    return { _failed: true, message: String(error?.message ?? error) };
  }
}

async function scenario(name, { at, mode }) {
  const lab = `exp06-${RUN}-${name}`;
  console.log(`\n######## ${name}  at=${at} mode=${mode}`);

  await call(`/reset?lab=${lab}`, {});
  await call(`/scenario?lab=${lab}`, { kind: "answer", text: "ok" });

  // まず障害なしで 1 往復通す。
  // 検証したい機能を入れる前に、土台が動くことを先に示す。
  const warm = await call(`/submit?lab=${lab}`, { text: "warmup", operationId: "op-warm" });
  const warmResult = await call(`/wait?lab=${lab}&op=op-warm`);
  const before = await call(`/info?lab=${lab}`);
  console.log(`  ウォームアップ: ${JSON.stringify(warmResult)} factoryRuns=${before.factoryRuns}`);

  // 障害を 1 回だけ仕込む
  await call(`/arm?lab=${lab}`, { id: "s1", at, mode, times: 1 });

  const submitted = await call(`/submit?lab=${lab}`, { text: "go", operationId: "op-1" });
  console.log(`  submit: ${JSON.stringify(submitted)}`);

  await sleep(3000);

  // 障害の直後に、もう一度普通に使えるか
  const after1 = await call(`/info?lab=${lab}`);
  const retrySubmit = await call(`/submit?lab=${lab}`, { text: "after", operationId: "op-2" });
  await sleep(3000);
  const after2 = await call(`/info?lab=${lab}`);
  const waited = await call(`/wait?lab=${lab}&op=op-2`);

  const events = await call(`/events?lab=${lab}`);
  const list = Array.isArray(events) ? events : [];
  const storageErrors = list.filter((e) => e.event === "storage_error");
  const reports = list.filter((e) => e.event === "report");
  const opens = list.filter((e) => e.event === "harness_opened");
  const restarts = list.filter((e) => e.event === "instance_started");

  console.log(`  障害後の submit: ${JSON.stringify(retrySubmit)}`);
  console.log(`  op-2 の結果: ${JSON.stringify(waited)}`);
  console.log(`  factoryRuns: ${before.factoryRuns} → ${after1.factoryRuns} → ${after2.factoryRuns}`);
  console.log(`  harness_opened: ${opens.length}  instance_started: ${restarts.length}`);
  console.log(`  storage_error: ${storageErrors.map((e) => `${e.metadata.method}(${e.metadata.name})`).join(", ") || "(なし)"}`);
  console.log(`  onReport: ${reports.map((r) => r.metadata.type).join(", ") || "(なし)"}`);

  return {
    name, at, mode, lab,
    factoryRuns: [before.factoryRuns, after1.factoryRuns, after2.factoryRuns],
    opens: opens.length,
    restarts: restarts.length,
    storageErrors: storageErrors.map((e) => e.metadata),
    reports: reports.map((r) => r.metadata),
    op2: waited,
  };
}

const out = [];
// commit から投げる → 仕様上は致命的（C31）
out.push(await scenario("commit-error", { at: "storage:write", mode: "storage_commit_error" }));
// 読み取りから StorageRequestError → 仕様上はその読みだけ失敗（C34）
out.push(await scenario("read-request-error", { at: "storage:read", mode: "storage_read_error" }));

const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("data", { recursive: true });
writeFileSync(
  `data/exp06-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  JSON.stringify(out, null, 2),
);
console.log("\n完了");
