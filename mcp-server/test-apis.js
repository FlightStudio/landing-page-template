/**
 * API Integration Test Script
 * ────────────────────────────
 * Tests each external API call independently before running end-to-end.
 * Run with: node test-apis.js [test-name]
 *
 * Tests:
 *   node test-apis.js auth       — GCP service account authentication
 *   node test-apis.js gcs        — Upload a small file to Cloud Storage
 *   node test-apis.js build      — Trigger + poll a minimal Cloud Build
 *   node test-apis.js cloudrun   — Get/list Cloud Run services
 *   node test-apis.js godaddy    — List DNS records (read-only, safe)
 *   node test-apis.js dns        — Resolve a CNAME via Node DNS
 *   node test-apis.js all        — Run all tests in sequence
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { GoogleAuth } from "google-auth-library";
import dns from "dns/promises";

const CONFIG_PATH = join(dirname(decodeURIComponent(new URL(import.meta.url).pathname)), "credentials", "config.json");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

const GCP_PROJECT = config.gcp.buildProject;
const GCP_REGION = config.gcp.region;
const GCP_SA_PATH = config.gcp.serviceAccountPath;
const GODADDY_KEY = config.godaddy.key;
const GODADDY_SECRET = config.godaddy.secret;
const DOMAINS = config.domains;

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getAccessToken() {
  const auth = new GoogleAuth({
    keyFile: GCP_SA_PATH,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

function pass(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg) { console.log(`  ✗ ${msg}`); }
function info(msg) { console.log(`  → ${msg}`); }

// ── Test: GCP Auth ──────────────────────────────────────────────────────────

async function testAuth() {
  console.log("\n── Test: GCP Authentication ──");
  try {
    info(`Service account: ${GCP_SA_PATH}`);
    const token = await getAccessToken();
    if (!token) throw new Error("Token is null");
    pass(`Got access token (${token.substring(0, 20)}...)`);
    return true;
  } catch (err) {
    fail(`Auth failed: ${err.message}`);
    return false;
  }
}

// ── Test: GCS Upload ────────────────────────────────────────────────────────

async function testGcs() {
  console.log("\n── Test: Cloud Storage Upload ──");
  try {
    const token = await getAccessToken();
    const bucket = `${GCP_PROJECT}_cloudbuild`;
    const objectName = `test/mcp-test-${Date.now()}.txt`;
    const body = Buffer.from("MCP server test file — safe to delete");

    info(`Uploading to gs://${bucket}/${objectName}`);

    const res = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(objectName)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "text/plain",
          "Content-Length": String(body.length),
        },
        body,
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }

    const data = await res.json();
    pass(`Uploaded: ${data.name} (${data.size} bytes)`);

    // Clean up
    const delRes = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectName)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    if (delRes.ok) pass("Cleaned up test file");

    return true;
  } catch (err) {
    fail(`GCS upload failed: ${err.message}`);
    return false;
  }
}

// ── Test: Cloud Build ───────────────────────────────────────────────────────

async function testBuild() {
  console.log("\n── Test: Cloud Build (minimal build) ──");
  try {
    const token = await getAccessToken();

    // Trigger a minimal build that just echoes — no source upload needed
    info("Triggering a no-op build (echo test)...");
    const res = await fetch(
      `https://cloudbuild.googleapis.com/v1/projects/${GCP_PROJECT}/builds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          steps: [
            {
              name: "gcr.io/cloud-builders/docker",
              args: ["version"],
            },
          ],
          timeout: "60s",
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }

    const data = await res.json();
    const opName = data.name;
    info(`Build operation: ${opName}`);

    // Poll for completion (should be fast — just runs docker version)
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(
        `https://cloudbuild.googleapis.com/v1/${opName}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const pollData = await pollRes.json();
      if (pollData.done) {
        const build = pollData.metadata?.build;
        if (build?.status === "SUCCESS") {
          pass(`Build completed: ${build.status}`);
          if (build.logUrl) info(`Logs: ${build.logUrl}`);
          return true;
        } else {
          throw new Error(`Build status: ${build?.status}. Logs: ${build?.logUrl || "unavailable"}`);
        }
      }
      info(`Build status: ${pollData.metadata?.build?.status || "WORKING"}...`);
    }

    throw new Error("Build timed out");
  } catch (err) {
    fail(`Cloud Build failed: ${err.message}`);
    return false;
  }
}

// ── Test: Cloud Run ─────────────────────────────────────────────────────────

async function testCloudRun() {
  console.log("\n── Test: Cloud Run (list services) ──");
  try {
    const token = await getAccessToken();
    const parent = `projects/${GCP_PROJECT}/locations/${GCP_REGION}`;

    info(`Listing services in ${parent}...`);
    const res = await fetch(
      `https://run.googleapis.com/v2/${parent}/services`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }

    const data = await res.json();
    const services = data.services || [];
    pass(`Found ${services.length} Cloud Run service(s)`);
    for (const svc of services.slice(0, 5)) {
      info(`  ${svc.name.split("/").pop()} → ${svc.uri || "no URL"}`);
    }
    return true;
  } catch (err) {
    fail(`Cloud Run test failed: ${err.message}`);
    return false;
  }
}

// ── Test: GoDaddy DNS ───────────────────────────────────────────────────────

async function testGoDaddy() {
  console.log("\n── Test: GoDaddy DNS (read-only) ──");
  try {
    const domain = Object.values(DOMAINS)[0];
    if (!domain) throw new Error("No domains configured");

    info(`Listing DNS records for ${domain}...`);
    const res = await fetch(
      `https://api.godaddy.com/v1/domains/${domain}/records?limit=10`,
      {
        headers: {
          Authorization: `sso-key ${GODADDY_KEY}:${GODADDY_SECRET}`,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }

    const records = await res.json();
    pass(`Got ${records.length} DNS record(s) for ${domain}`);
    for (const r of records.slice(0, 5)) {
      info(`  ${r.type} ${r.name} → ${r.data}`);
    }
    return true;
  } catch (err) {
    fail(`GoDaddy test failed: ${err.message}`);
    return false;
  }
}

// ── Test: DNS Resolution ────────────────────────────────────────────────────

async function testDns() {
  console.log("\n── Test: Node DNS Resolution ──");
  try {
    const domain = Object.values(DOMAINS)[0];
    info(`Resolving A records for ${domain}...`);
    const addresses = await dns.resolve4(domain);
    pass(`Resolved ${domain}: ${addresses.join(", ")}`);
    return true;
  } catch (err) {
    fail(`DNS test failed: ${err.message}`);
    return false;
  }
}

// ── Runner ──────────────────────────────────────────────────────────────────

const tests = {
  auth: testAuth,
  gcs: testGcs,
  build: testBuild,
  cloudrun: testCloudRun,
  godaddy: testGoDaddy,
  dns: testDns,
};

const requested = process.argv[2] || "all";

console.log("Landing Pages MCP — API Integration Tests");
console.log("==========================================");

if (requested === "all") {
  const results = {};
  for (const [name, fn] of Object.entries(tests)) {
    results[name] = await fn();
  }
  console.log("\n── Summary ──");
  for (const [name, ok] of Object.entries(results)) {
    console.log(`  ${ok ? "✓" : "✗"} ${name}`);
  }
  const passed = Object.values(results).filter(Boolean).length;
  console.log(`\n${passed}/${Object.keys(results).length} tests passed`);
  process.exit(passed === Object.keys(results).length ? 0 : 1);
} else if (tests[requested]) {
  const ok = await tests[requested]();
  process.exit(ok ? 0 : 1);
} else {
  console.error(`Unknown test: ${requested}. Available: ${Object.keys(tests).join(", ")}, all`);
  process.exit(1);
}
