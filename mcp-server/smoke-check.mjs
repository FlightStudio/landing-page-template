// Post-deploy smoke check for Campaign Studio MCP.
// Compares the live server's version + key schema fields against mcp-server/server.js at HEAD.
// Exits 1 with diagnostics if they don't match — catches "I built but it didn't ship" silently.

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MCP_URL = process.env.MCP_URL || "https://campaign-studio-30219985459.europe-west1.run.app/mcp";

const serverSrc = readFileSync(join(__dirname, "server.js"), "utf-8");
const versionMatch = serverSrc.match(/name:\s*"campaign-studio",\s*version:\s*"([^"]+)"/);
const expectedVersion = versionMatch?.[1];
if (!expectedVersion) {
  console.error("smoke-check: could not parse version from server.js");
  process.exit(1);
}

const headers = { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" };
const parseSse = (text) => {
  const lines = text.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6));
  return lines.length ? JSON.parse(lines[lines.length - 1]) : JSON.parse(text);
};
const rpc = async (sid, body) => {
  const h = sid ? { ...headers, "mcp-session-id": sid } : headers;
  return fetch(MCP_URL, { method: "POST", headers: h, body: JSON.stringify(body) });
};

const initRes = await rpc(null, {
  jsonrpc: "2.0", id: 1, method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0.0.1" } },
});
const sid = initRes.headers.get("mcp-session-id");
const initPayload = parseSse(await initRes.text());
const liveVersion = initPayload.result?.serverInfo?.version;

await rpc(sid, { jsonrpc: "2.0", method: "notifications/initialized" });
const listPayload = parseSse(await (await rpc(sid, { jsonrpc: "2.0", id: 2, method: "tools/list" })).text());
const tools = listPayload.result?.tools || [];

const failures = [];
if (liveVersion !== expectedVersion) {
  failures.push(`Version mismatch: source=${expectedVersion} live=${liveVersion}. Deploy did not ship the latest build.`);
}

const expectedSchema = {
  deploy_landing_page: ["brand", "serviceName", "ogDescription", "ogImagePath", "ogUrl"],
  update_landing_page: ["serviceName", "ogDescription", "ogImagePath", "ogUrl"],
  list_brands: [],
  upload_asset: ["serviceName", "fileName", "base64Content"],
  setup_domain: ["serviceName", "subdomain", "brand"],
  check_ssl_status: ["subdomain", "brand"],
};
for (const [name, fields] of Object.entries(expectedSchema)) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) { failures.push(`Missing tool: ${name}`); continue; }
  const props = Object.keys(tool.inputSchema?.properties || {});
  const missing = fields.filter((f) => !props.includes(f));
  if (missing.length) failures.push(`${name} missing fields: ${missing.join(", ")}`);
}

if (failures.length) {
  console.error("SMOKE CHECK FAILED:");
  for (const f of failures) console.error("  -", f);
  process.exit(1);
}
console.log(`SMOKE CHECK OK — server v${liveVersion}, ${tools.length} tools, all expected schema fields present.`);
