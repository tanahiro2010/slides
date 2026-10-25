/**
 * C40 / C37: 実デプロイでの Hibernation。
 *
 * 観測するのは alarm の時刻ではなく、**待機明けにコンストラクタが再実行されるか**。
 * オブジェクトがメモリから落ちていれば、新しいインスタンスが生まれる。
 *
 * 対照は `onWake` の有無。
 *   渡す   → Pi はタイマーを張らない → 退避できる → 新インスタンス
 *   渡さない → Pi のインメモリタイマーがオブジェクトを固定する → 同一インスタンス
 *
 * **待機中は一切触らない。** 1 回でもリクエストするとオブジェクトが起きて、
 * 測りたい現象が消える。
 *
 *   node drive/deploy-hibernation.mjs <baseUrl> [backoffMs]
 */

const BASE = process.argv[2];
if (!BASE) throw new Error("baseUrl が要る");
const BACKOFF_MS = Number(process.argv[3] ?? 90_000);
const RUN = process.env.RUN_ID ?? Date.now().toString(36);
console.log(`run=${RUN} base=${BASE} backoff=${BACKOFF_MS}ms`);

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

const labs = [];
for (const onWake of ["on", "off"]) {
  const lab = `hib-${RUN}-${onWake}`;
  await call(`/reset?lab=${lab}`, {});
  await call(`/settings?lab=${lab}`, {
    onWake, baseDelayMs: String(BACKOFF_MS), maxRetries: "3",
  });
  await call(`/scenario?lab=${lab}`, {
    kind: "stream_error",
    errorMessage: "The stream ended without the model finishing its answer.",
    failures: 1,
    then: "woke up",
  });
  await call(`/submit?lab=${lab}`, { text: "go", operationId: "op-1" });
  const info = await call(`/info?lab=${lab}`);
  labs.push({
    onWake, lab,
    instanceAtSubmit: info.instanceId,
    alarmAtSubmit: info.nextAlarm ? Math.round((info.nextAlarm - Date.now()) / 1000) : null,
    onWakeWired: info.onWakeWired,
  });
  console.log(`  ${lab}: 配線=${info.onWakeWired} alarm=${info.nextAlarm ? Math.round((info.nextAlarm - Date.now()) / 1000) + "s" : "なし"}`);
}

// --- ここから待機。一切触らない ---
const waitMs = BACKOFF_MS + 45_000;
console.log(`\n待機 ${Math.round(waitMs / 1000)}s（この間は 1 回もリクエストしない）`);
await sleep(waitMs);

console.log("\n######## 結果");
const out = [];
for (const l of labs) {
  const events = await call(`/events?lab=${l.lab}`);
  const list = Array.isArray(events) ? events : [];
  const starts = list.filter((e) => e.event === "instance_started");
  const instances = [...new Set(list.map((e) => e.instanceId))];
  const result = await call(`/wait?lab=${l.lab}&op=op-1`);
  const counters = await call(`/counters?lab=${l.lab}`);

  const row = {
    ...l,
    instanceStarted: starts.length,
    distinctInstances: instances.length,
    newInstanceDuringSleep: instances.length > 1,
    status: result.status,
    modelRequests: counters["model:requests"] ?? 0,
    timeline: list.map((e) => `${e.event}@${e.instanceId.slice(0, 8)}`),
  };
  out.push(row);
  console.log(`\n  onWake=${l.onWake}（配線=${l.onWakeWired}）`);
  console.log(`    instance_started の回数: ${row.instanceStarted}`);
  console.log(`    別インスタンスが生まれたか: ${row.newInstanceDuringSleep}`);
  console.log(`    結果: ${row.status}  モデル呼び出し=${row.modelRequests}`);
  console.log(`    時系列: ${row.timeline.join(" → ")}`);
}

const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("data", { recursive: true });
writeFileSync(
  `data/hibernation-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  JSON.stringify(out, null, 2),
);
console.log("\n完了");
