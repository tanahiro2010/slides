import { exchange } from "./client.mjs";

const base = process.env.CF_API_BASE ?? "https://api.cloudflare.com/client/v4";
const zone = process.env.CF_ZONE_ID;
const token = process.env.CF_API_TOKEN;
if (!zone || !token) {
  console.error("CF_ZONE_ID and CF_API_TOKEN are required.");
  process.exit(2);
}

const url = `${base}/zones/${zone}/rulesets/phases/http_request_firewall_managed/entrypoint`;
await exchange({
  label: "config-entrypoint-read",
  url,
  headers: { authorization: `Bearer ${token}`, accept: "application/json" },
});
