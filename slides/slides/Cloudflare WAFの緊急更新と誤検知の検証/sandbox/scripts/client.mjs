import { appendFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

mkdirSync(new URL("../data/", import.meta.url), { recursive: true });
const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
const evidencePath = new URL(`../data/evidence-${stamp}.jsonl`, import.meta.url);
let seq = 0;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fingerprint = (value) => ({
  _redacted_len: value.length,
  _sha256_16: sha256(value).slice(0, 16),
});

function redactHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) =>
      /authorization|cookie|api-token/i.test(key)
        ? [key, fingerprint(String(value))]
        : [key, String(value)],
    ),
  );
}

export async function exchange({ label, method = "GET", url, headers = {}, body }) {
  const started = Date.now();
  let response;
  let responseText = "";
  let error = null;
  try {
    response = await fetch(url, { method, headers, body });
    responseText = await response.text();
  } catch (cause) {
    error = String(cause?.stack ?? cause);
  }

  const record = {
    seq: ++seq,
    timestamp: new Date(started).toISOString(),
    label,
    request: {
      method,
      url,
      headers: redactHeaders(headers),
      body: body == null ? null : {
        bytes: Buffer.byteLength(body),
        sha256_16: sha256(body).slice(0, 16),
      },
    },
    response: response
      ? {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseText,
        }
      : null,
    durationMs: Date.now() - started,
    error,
  };
  appendFileSync(evidencePath, `${JSON.stringify(record)}\n`);
  console.log(JSON.stringify({
    seq: record.seq,
    label,
    status: record.response?.status ?? null,
    durationMs: record.durationMs,
    error,
  }));
  return { ...record, responseText };
}

export { evidencePath };
