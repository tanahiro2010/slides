/**
 * EXP-03 と EXP-07。C11 / C12 / C13 / C37。
 *
 * A. ストリーム断の文言だけを変えて、再試行されるかを見る（C11 / C12）。
 *    pi-ai の判定はエラー本文に対する正規表現なので、
 *    `agents` のバージョンを入れ替えなくても、投げる文言で撃ち分けられる。
 *    対照は「明確に再試行対象外の文言」。
 *
 * B. `onWake` の有無で、リトライ待機中の alarm がどこに置かれるかを見る（C37）。
 *    PR #2619 の表（4 分の backoff で「約 4 分」対「数秒」）を、alarm の時刻で再現する。
 *
 *   node drive/exp03_07.mjs [baseUrl]
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

// `agents` が実際に投げる文言。配布物から取ったもの。
const WORDINGS = [
  { label: "0.29.0 の文言", text: "The stream ended before the model finished its answer." },
  { label: "0.30.x の文言", text: "The stream ended without the model finishing its answer." },
  { label: "0.29.0 アイドル", text: "Model stream stalled: no data received for 60s." },
  { label: "0.30.x アイドル", text: "Model stream timed out: no data received for 60s." },
  { label: "対照: 明確に非再試行", text: "insufficient_quota: the account has no remaining credit." },
];

console.log("\n######## A. ストリーム断の文言で再試行されるか（C11 / C12）");
const aRows = [];
for (const w of WORDINGS) {
  const lab = `exp03-${RUN}-${aRows.length}`;
  await call(`/reset?lab=${lab}`, {});
  // 速く回すため backoff を詰める。リトライ回数の既定（3）は変えない。
  await call(`/settings?lab=${lab}`, { baseDelayMs: "300", maxRetries: "3" });
  // 2 回失敗してから成功する。再試行されれば届き、されなければ 1 回目で落ちる。
  await call(`/scenario?lab=${lab}`, {
    kind: "stream_error", errorMessage: w.text, failures: 2, then: "recovered",
  });

  await call(`/submit?lab=${lab}`, { text: "go", operationId: "op-1" });
  const result = await call(`/wait?lab=${lab}&op=op-1`);
  const counters = await call(`/counters?lab=${lab}`);
  const info = await call(`/info?lab=${lab}`);

  const row = {
    label: w.label,
    text: w.text,
    status: result.status,
    reason: result.reason ?? "-",
    modelRequests: counters["model:requests"] ?? 0,
    failuresEmitted: counters["model:failures"] ?? 0,
    fauxCallCount: info.fauxCallCount,
  };
  aRows.push(row);
  console.log(
    `  ${w.label.padEnd(18)} status=${row.status.padEnd(10)} reason=${String(row.reason).padEnd(12)} ` +
    `モデル呼び出し=${row.modelRequests}`,
  );
}

console.log("\n  | 文言 | 結果 | 理由 | モデル呼び出し回数 |");
console.log("  | --- | --- | --- | ---: |");
for (const r of aRows) {
  console.log(`  | ${r.label} | \`${r.status}\` | ${r.reason} | ${r.modelRequests} |`);
}

console.log("\n######## B. onWake の有無とリトライ待機中の alarm（C37）");
const bRows = [];
for (const onWake of ["on", "off"]) {
  const lab = `exp07-${RUN}-${onWake}`;
  await call(`/reset?lab=${lab}`, {});
  // 待機を観測できる長さにする
  await call(`/settings?lab=${lab}`, { onWake, baseDelayMs: "20000", maxRetries: "3" });
  await call(`/scenario?lab=${lab}`, {
    kind: "stream_error",
    errorMessage: "The stream ended without the model finishing its answer.",
    failures: 1,
    then: "recovered",
  });

  await call(`/submit?lab=${lab}`, { text: "go", operationId: "op-1" });

  // backoff に入ったころを狙って alarm を何度か見る
  const samples = [];
  for (let i = 0; i < 6; i += 1) {
    await sleep(2500);
    const info = await call(`/info?lab=${lab}`);
    if (info.nextAlarm) {
      samples.push({
        atSec: Math.round((info.nextAlarm - Date.now()) / 1000),
        onWakeWired: info.onWakeWired,
      });
    } else {
      samples.push({ atSec: null, onWakeWired: info.onWakeWired });
    }
  }
  const result = await call(`/wait?lab=${lab}&op=op-1`);
  const counters = await call(`/counters?lab=${lab}`);

  const row = {
    onWake,
    samples,
    status: result.status,
    modelRequests: counters["model:requests"] ?? 0,
  };
  bRows.push(row);
  console.log(
    `  onWake=${onWake}  alarm までの秒数: ` +
    `${samples.map((s) => (s.atSec === null ? "なし" : `${s.atSec}s`)).join(" ")}  ` +
    `status=${row.status} モデル呼び出し=${row.modelRequests}`,
  );
}

const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("data", { recursive: true });
writeFileSync(
  `data/exp03_07-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  JSON.stringify({ a: aRows, b: bRows }, null, 2),
);
console.log("\n完了");
