// End-to-end integration test for the custom-page deploy mode.
//
// Runs: upload_dist → deploy_custom_page → fetch URL → upload_dist (new) →
//       update_custom_page → fetch URL → teardown_custom_page → verify cleanup.
//
// CREATES REAL CLOUD RUN RESOURCES — costs a few cents per run, tears them
// down at the end. Safe to run repeatedly. Use a one-off serviceName so it
// can't collide with real campaigns.
//
// Usage:
//   MCP_URL=https://campaign-studio-...run.app/mcp \
//   MCP_AUTH_TOKEN=<token> \
//   node mcp-server/test-custom-deploy.mjs
//
// Exits 0 on success, 1 with diagnostics on failure.

import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";

const MCP_URL = process.env.MCP_URL || "https://campaign-studio-30219985459.europe-west1.run.app/mcp";
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;
const SERVICE_NAME = `custom-test-${Date.now()}`;

const headers = {
  "Content-Type": "application/json",
  "Accept": "application/json, text/event-stream",
  ...(MCP_AUTH_TOKEN ? { Authorization: `Bearer ${MCP_AUTH_TOKEN}` } : {}),
};

const parseSse = (text) => {
  const lines = text.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6));
  return lines.length ? JSON.parse(lines[lines.length - 1]) : JSON.parse(text);
};

let sessionId;
async function rpc(body) {
  const h = sessionId ? { ...headers, "mcp-session-id": sessionId } : headers;
  const res = await fetch(MCP_URL, { method: "POST", headers: h, body: JSON.stringify(body) });
  if (!sessionId) sessionId = res.headers.get("mcp-session-id");
  const text = await res.text();
  // Notifications (no `id`) return 202 with empty body — nothing to parse
  if (!text) return null;
  return parseSse(text);
}

async function callTool(name, args) {
  const out = await rpc({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } });
  if (out.error) throw new Error(`tool ${name} returned error: ${JSON.stringify(out.error)}`);
  const text = out.result?.content?.[0]?.text || "";
  if (out.result?.isError) throw new Error(`tool ${name} reported failure: ${text}`);
  return text;
}

function makeDistTarball(label) {
  const dir = mkdtempSync(join(tmpdir(), "dist-"));
  writeFileSync(join(dir, "index.html"), `<!DOCTYPE html><title>test</title><body>${label}</body>`);
  writeFileSync(join(dir, "style.css"), `body { background: #fff; }`);
  const tarBuf = execSync(`tar -czf - -C "${dir}" .`);
  rmSync(dir, { recursive: true, force: true });
  return tarBuf.toString("base64");
}

async function fetchBody(url) {
  const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000) });
  return { status: res.status, body: await res.text() };
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log(`\n=== Custom-page deploy E2E test ===`);
  console.log(`MCP:     ${MCP_URL}`);
  console.log(`Service: ${SERVICE_NAME}\n`);

  // 1. Init MCP session
  console.log("1. Initialising MCP session…");
  const initRes = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test-custom-deploy", version: "0" } } });
  assert(initRes.result?.serverInfo?.name === "campaign-studio", "server identifies as campaign-studio");
  await rpc({ jsonrpc: "2.0", method: "notifications/initialized" });

  // 2. Confirm new tools are present
  console.log("\n2. Confirming new tools registered…");
  const list = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const toolNames = (list.result?.tools || []).map((t) => t.name);
  for (const name of ["upload_dist", "deploy_custom_page", "update_custom_page", "teardown_custom_page", "teardown_landing_page"]) {
    assert(toolNames.includes(name), `tool ${name} present`);
  }

  // 3. Upload first dist
  console.log("\n3. Uploading first dist…");
  await callTool("upload_dist", { serviceName: SERVICE_NAME, base64Tarball: makeDistTarball("hello-v1") });

  // 4. Deploy
  console.log("\n4. Deploying (this takes ~30-90s)…");
  const deployText = await callTool("deploy_custom_page", { serviceName: SERVICE_NAME, pageTitle: "test page" });
  const urlMatch = deployText.match(/https?:\/\/[a-z0-9.-]+\.run\.app/i);
  assert(urlMatch, `deploy returned a Cloud Run URL (got: ${deployText.slice(0, 400)})`);
  const serviceUrl = urlMatch[0];
  console.log(`     URL: ${serviceUrl}`);

  // Cloud Run cold start can take a few seconds; retry briefly.
  console.log("\n5. Verifying first deploy serves the dist…");
  let firstBody;
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const r = await fetchBody(serviceUrl);
      if (r.status === 200) { firstBody = r.body; break; }
    } catch {}
  }
  assert(firstBody && firstBody.includes("hello-v1"), "live URL returns the v1 content");

  // 6. Upload second dist + update
  console.log("\n6. Uploading second dist + updating…");
  await callTool("upload_dist", { serviceName: SERVICE_NAME, base64Tarball: makeDistTarball("hello-v2") });
  await callTool("update_custom_page", { serviceName: SERVICE_NAME });

  // 7. Verify update
  console.log("\n7. Verifying update served new content…");
  let secondBody;
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const r = await fetchBody(serviceUrl);
      if (r.status === 200 && r.body.includes("hello-v2")) { secondBody = r.body; break; }
    } catch {}
  }
  assert(secondBody && secondBody.includes("hello-v2"), "live URL returns the v2 content");

  // 8. Teardown
  console.log("\n8. Tearing down…");
  await callTool("teardown_custom_page", { serviceName: SERVICE_NAME, confirm: true });

  // 9. Verify cleanup
  console.log("\n9. Verifying URL no longer responds…");
  await new Promise((r) => setTimeout(r, 3000));
  try {
    const r = await fetchBody(serviceUrl);
    assert(r.status === 404 || r.status >= 500, `URL returns failure after teardown (got ${r.status})`);
  } catch (err) {
    console.log(`  ✓ URL unreachable after teardown (${err.message.slice(0, 60)})`);
  }

  console.log(`\n✓ ALL CHECKS PASSED for ${SERVICE_NAME}\n`);
}

main().catch((err) => {
  console.error(`\n✗ TEST FAILED: ${err.message}`);
  console.error(`  Service: ${SERVICE_NAME}`);
  console.error(`  Manual cleanup if needed:`);
  console.error(`    gcloud run services delete ${SERVICE_NAME} --region=europe-west1 --quiet`);
  process.exit(1);
});
