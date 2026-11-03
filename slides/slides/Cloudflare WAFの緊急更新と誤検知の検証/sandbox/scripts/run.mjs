import { brotliCompressSync, gzipSync } from "node:zlib";
import { exchange } from "./client.mjs";

const target = process.env.TARGET_URL ?? "";
if (!target) {
  console.error("TARGET_URL is required. Copy .env.example to .env and load it before running.");
  process.exit(2);
}

const base = target.replace(/\/$/, "");
const payload = JSON.stringify({ probe: "cloudflare-waf-emergency", safe: true, value: "control" });
const br = brotliCompressSync(Buffer.from(payload));
const gzip = gzipSync(Buffer.from(payload));
const only = new Set(
  process.argv
    .filter((arg) => arg.startsWith("--only="))
    .flatMap((arg) => arg.slice(7).split(",")),
);
const wanted = (name) => only.size === 0 || only.has(name);

async function send(label, path, options = {}) {
  return exchange({ label, url: `${base}${path}`, ...options });
}

if (wanted("B01")) await send("B01-json-control", "/compressed", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: payload,
});
if (wanted("B02")) await send("B02-brotli-request-body", "/compressed", {
  method: "POST",
  headers: { "content-type": "application/json", "content-encoding": "br" },
  body: br,
});
if (wanted("B03")) await send("B03-brotli-accept-only", "/compressed", {
  method: "POST",
  headers: { "content-type": "application/json", "accept-encoding": "br" },
  body: payload,
});
if (wanted("B04")) await send("B04-gzip-request-body", "/compressed", {
  method: "POST",
  headers: { "content-type": "application/json", "content-encoding": "gzip" },
  body: gzip,
});
if (wanted("N01")) await send("N01-health-control", "/health");
if (wanted("N02")) await send("N02-normal-image", "/images/sample.png");
if (wanted("N03")) await send("N03-next-image-path", "/_next/image?url=%2Fimages%2Fsample.png&w=640&q=75");
