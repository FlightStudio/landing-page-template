import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync, rmSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { GoogleAuth } from "google-auth-library";
import { create as createTar, x as extractTar } from "tar";
import { Writable, Readable } from "stream";
import { pipeline } from "stream/promises";
import dns from "dns/promises";
import express from "express";
import { randomUUID } from "crypto";

const STDIO_MODE = process.argv.includes("--stdio");
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Environment config ──────────────────────────────────────────────────────
const GCP_PROJECT = process.env.GCP_PROJECT;
const GCP_REGION = process.env.GCP_REGION || "europe-west1";
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;
const GODADDY_KEY = process.env.GODADDY_KEY;
const GODADDY_SECRET = process.env.GODADDY_SECRET;
const DOMAINS = JSON.parse(process.env.DOMAINS_JSON || "{}");
const GCS_BUCKET = process.env.GCS_BUCKET || `${GCP_PROJECT}_campaign-studio`;
// In stdio mode, use the repo root; on Cloud Run, use /template
const TEMPLATE_DIR = STDIO_MODE ? resolve(__dirname, "..") : "/template";
const PORT = parseInt(process.env.PORT || "8080", 10);

// Resolve mcp-server-local templates directory (used by buildAndDeployCustom for custom-page mode).
// Reuses __dirname declared above for STDIO_MODE handling.
const TEMPLATES_DIR = join(__dirname, "templates");

// ── GCP Auth (credentials from env, not keyFile) ────────────────────────────
let _gcpCredentials = null;
function getGcpCredentials() {
  if (_gcpCredentials) return _gcpCredentials;
  const raw = process.env.GCP_SA_KEY;
  if (raw) {
    _gcpCredentials = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  }
  return _gcpCredentials;
}

function getGcpAuth() {
  const creds = getGcpCredentials();
  return creds
    ? new GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/cloud-platform"] })
    : new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }); // falls back to ADC
}

async function getGcpAccessToken() {
  const auth = getGcpAuth();
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

// ── Brand loading ───────────────────────────────────────────────────────────
function loadBrands() {
  const brandsDir = join(TEMPLATE_DIR, "src", "brands");
  const brands = {};
  for (const file of readdirSync(brandsDir)) {
    if (!file.endsWith(".js")) continue;
    const name = file.replace(".js", "");
    const content = readFileSync(join(brandsDir, file), "utf-8");
    const get = (key) => {
      const match = content.match(new RegExp(`${key}:\\s*["']([^"']+)["']`));
      return match ? match[1] : null;
    };
    brands[name] = {
      name: get("name"),
      shortName: get("shortName"),
      klaviyoCompanyId: get("klaviyoCompanyId"),
      logo: get("logo"),
      domain: DOMAINS[name] || null,
    };
  }
  return brands;
}

// ── GoDaddy API ─────────────────────────────────────────────────────────────
async function godaddyRequest(method, path, body) {
  const res = await fetch(`https://api.godaddy.com${path}`, {
    method,
    headers: {
      Authorization: `sso-key ${GODADDY_KEY}:${GODADDY_SECRET}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GoDaddy API ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function addDnsRecord(domain, type, name, data, ttl = 600) {
  await godaddyRequest("PATCH", `/v1/domains/${domain}/records`, [{ type, name, data, ttl }]);
}

// ── Google Site Verification API ────────────────────────────────────────────
async function getVerificationToken(domain) {
  const token = await getGcpAccessToken();
  const res = await fetch("https://www.googleapis.com/siteVerification/v1/token", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ site: { type: "INET_DOMAIN", identifier: domain }, verificationMethod: "DNS_TXT" }),
  });
  if (!res.ok) throw new Error(`Verification token error: ${await res.text()}`);
  return (await res.json()).token;
}

async function verifyDomain(domain) {
  const token = await getGcpAccessToken();
  const res = await fetch("https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=DNS_TXT", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ site: { type: "INET_DOMAIN", identifier: domain } }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (text.includes("alreadyVerified")) return { status: "already_verified" };
    throw new Error(`Verification error: ${text}`);
  }
  return await res.json();
}

// ── Cloud Run Domain Mapping API ────────────────────────────────────────────
async function createDomainMapping(serviceName, subdomain, domain) {
  const token = await getGcpAccessToken();
  const fullDomain = `${subdomain}.${domain}`;
  const res = await fetch(
    `https://${GCP_REGION}-run.googleapis.com/apis/domains.cloudrun.com/v1/namespaces/${GCP_PROJECT}/domainmappings`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        apiVersion: "domains.cloudrun.com/v1",
        kind: "DomainMapping",
        metadata: { name: fullDomain, namespace: GCP_PROJECT },
        spec: { routeName: serviceName },
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    if (text.includes("already exists")) return { status: "already_exists", domain: fullDomain };
    throw new Error(`Domain mapping error: ${text}`);
  }
  return await res.json();
}

// ── GCS helpers ─────────────────────────────────────────────────────────────
async function gcsUpload(objectName, buffer, contentType = "application/octet-stream") {
  const token = await getGcpAccessToken();
  const res = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${GCS_BUCKET}/o?uploadType=media&name=${encodeURIComponent(objectName)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType, "Content-Length": String(buffer.length) },
      body: buffer,
    }
  );
  if (!res.ok) throw new Error(`GCS upload failed: ${await res.text()}`);
  return await res.json();
}

async function gcsDownload(objectName) {
  const token = await getGcpAccessToken();
  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${GCS_BUCKET}/o/${encodeURIComponent(objectName)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GCS download failed: ${await res.text()}`);
  return res;
}

async function gcsDownloadJson(objectName) {
  const res = await gcsDownload(objectName);
  if (!res) return null;
  return await res.json();
}

async function gcsList(prefix) {
  const token = await getGcpAccessToken();
  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${GCS_BUCKET}/o?prefix=${encodeURIComponent(prefix)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`GCS list failed: ${await res.text()}`);
  const data = await res.json();
  return (data.items || []).map((i) => i.name);
}

async function gcsDelete(objectName) {
  const token = await getGcpAccessToken();
  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${GCS_BUCKET}/o/${encodeURIComponent(objectName)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  // 404 = already gone; treat as success
  if (!res.ok && res.status !== 404) throw new Error(`GCS delete failed: ${await res.text()}`);
  return res.ok || res.status === 404;
}

// ── Cloud Build + Deploy API (pure REST) ─────────────────────────────────────

async function createSourceTarball(projectPath) {
  const chunks = [];
  const collector = new Writable({
    write(chunk, _enc, cb) { chunks.push(chunk); cb(); },
  });
  await pipeline(
    createTar({ gzip: true, cwd: projectPath, filter: (p) => !p.includes("node_modules") && !p.includes(".git") }, readdirSync(projectPath)),
    collector
  );
  return Buffer.concat(chunks);
}

async function extractTarball(buffer, destDir) {
  await pipeline(
    Readable.from([buffer]),
    extractTar({ cwd: destDir })
  );
}

async function triggerCloudBuild(bucket, objectName, imageTag) {
  const token = await getGcpAccessToken();
  const res = await fetch(`https://cloudbuild.googleapis.com/v1/projects/${GCP_PROJECT}/builds`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      source: { storageSource: { bucket, object: objectName } },
      steps: [{ name: "gcr.io/cloud-builders/docker", args: ["build", "-t", imageTag, "."] }],
      images: [imageTag],
      timeout: "600s",
    }),
  });
  if (!res.ok) throw new Error(`Cloud Build trigger failed: ${await res.text()}`);
  return await res.json();
}

async function waitForBuild(operationName) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const token = await getGcpAccessToken();
    const res = await fetch(`https://cloudbuild.googleapis.com/v1/${operationName}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Build status check failed: ${await res.text()}`);
    const data = await res.json();
    if (data.done) {
      const build = data.metadata?.build || data.response;
      if (build?.status === "SUCCESS") return build;
      throw new Error(`Build failed: ${build?.status}. Logs: ${build?.logUrl || "unavailable"}`);
    }
  }
  throw new Error("Build timed out after 5 minutes");
}

async function deployToCloudRun(serviceName, imageTag) {
  const token = await getGcpAccessToken();
  const parent = `projects/${GCP_PROJECT}/locations/${GCP_REGION}`;
  const servicePath = `${parent}/services/${serviceName}`;
  const serviceBody = {
    template: { containers: [{ image: imageTag, ports: [{ containerPort: 8080 }] }] },
    ingress: "INGRESS_TRAFFIC_ALL",
    traffic: [{ type: "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST", percent: 100 }],
  };

  let res = await fetch(`https://run.googleapis.com/v2/${servicePath}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(serviceBody),
  });

  if (res.status === 404) {
    res = await fetch(`https://run.googleapis.com/v2/${parent}/services?serviceId=${serviceName}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(serviceBody),
    });
  }

  if (!res.ok) throw new Error(`Cloud Run deploy failed: ${await res.text()}`);
  const operation = await res.json();

  if (operation.name && !operation.done) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const opRes = await fetch(`https://run.googleapis.com/v2/${operation.name}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (opRes.ok) { const d = await opRes.json(); if (d.done) break; }
    }
  }
  return servicePath;
}

async function setPublicAccess(servicePath) {
  const token = await getGcpAccessToken();
  const res = await fetch(`https://run.googleapis.com/v2/${servicePath}:setIamPolicy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ policy: { bindings: [{ role: "roles/run.invoker", members: ["allUsers"] }] } }),
  });
  if (!res.ok) throw new Error(`IAM policy update failed: ${await res.text()}`);
  return await res.json();
}

async function getServiceUrl(servicePath) {
  const token = await getGcpAccessToken();
  const res = await fetch(`https://run.googleapis.com/v2/${servicePath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to get service details: ${await res.text()}`);
  return (await res.json()).uri;
}

// ── Campaign config generator ───────────────────────────────────────────────
function generateCampaignConfig(opts) {
  return `/**
 * Campaign Configuration — Generated by Campaign Studio
 */

import brand from "./brands/${opts.brand}";

export const KLAVIYO_COMPANY_ID = brand.klaviyoCompanyId;
export const BRAND_NAME = brand.name;
export const BRAND_SHORT = brand.shortName;
export const BRAND_LOGO = brand.logo;
export const PRIVACY_POLICY_URL = brand.privacyPolicyUrl;
export const COOKIE_POLICY_URL = brand.cookiePolicyUrl;
export const TERMS_URL = brand.termsUrl;
export const BRAND_THEME = brand.theme;
export const META_PIXEL_ID = brand.metaPixelId || "";

export const KLAVIYO_LIST_ID = "${opts.klaviyoListId}";
export const CONSENT_SOURCE = "${opts.consentSource}";

export const CAMPAIGN_SLUG = "${opts.campaignSlug}";
export const CAMPAIGN_NAME = "${opts.campaignName}";
export const PAGE_TITLE = "${opts.pageTitle}";

export const OG_DESCRIPTION = "${opts.ogDescription || ""}";
export const OG_IMAGE_PATH = "${opts.ogImagePath || "/assets/og-image.jpg"}";
export const OG_URL = "${opts.ogUrl || ""}";

export const CONTENT = {
  label: ${JSON.stringify(opts.content.label)},
  headline: ${JSON.stringify(opts.content.headline)},
  headlineAccent: ${JSON.stringify(opts.content.headlineAccent)},
  body: ${JSON.stringify(opts.content.body)},
  postSubmitHeadline: ${JSON.stringify(opts.content.postSubmitHeadline)},
  postSubmitBody: ${JSON.stringify(opts.content.postSubmitBody)},
  submitButton: ${JSON.stringify(opts.content.submitButton)},
};

export const VARIANTS = ${JSON.stringify(opts.variants)};

export const MEDIA = {
  video: "/assets/bg-video.mp4",
  imageWebp: "/assets/bg-image.webp",
  imageJpg: "/assets/bg-image.jpg",
};

export const RUDDERSTACK_WRITE_KEY = "3BDjPVPbfZ0thaBZdJQl9KMQOp2";
export const RUDDERSTACK_DATAPLANE_URL = "https://stevenllumrcor.dataplane.rudderstack.com";
`;
}

// ── Build + deploy helper ───────────────────────────────────────────────────
async function buildAndDeploy(opts) {
  const steps = [];
  const serviceName = opts.serviceName;
  const imageTag = `gcr.io/${GCP_PROJECT}/${serviceName}:${Date.now()}`;
  const buildBucket = `${GCP_PROJECT}_cloudbuild`;
  const objectName = `source/${serviceName}-${Date.now()}.tar.gz`;
  const tmpDir = `/tmp/_build_${serviceName}_${Date.now()}`;
  mkdirSync(tmpDir, { recursive: true });

  try {
    // Assemble project from template + campaign config
    for (const file of ["package.json", "package-lock.json", "vite.config.js", "index.html", "Dockerfile", "nginx.conf"]) {
      const src = join(TEMPLATE_DIR, file);
      if (existsSync(src)) cpSync(src, join(tmpDir, file));
    }
    cpSync(join(TEMPLATE_DIR, "src"), join(tmpDir, "src"), { recursive: true });
    mkdirSync(join(tmpDir, "public", "assets"), { recursive: true });
    const assetsDir = join(TEMPLATE_DIR, "public", "assets");
    if (existsSync(assetsDir)) {
      for (const file of readdirSync(assetsDir)) {
        cpSync(join(assetsDir, file), join(tmpDir, "public", "assets", file));
      }
    }

    // Download uploaded assets from GCS
    const assetPrefix = `assets/${serviceName}/`;
    const assetKeys = await gcsList(assetPrefix);
    for (const key of assetKeys) {
      const fileName = key.replace(assetPrefix, "");
      const assetRes = await gcsDownload(key);
      if (assetRes) {
        const buf = Buffer.from(await assetRes.arrayBuffer());
        writeFileSync(join(tmpDir, "public", "assets", fileName), buf);
        steps.push(`Downloaded asset: ${fileName}`);
      }
    }

    writeFileSync(join(tmpDir, "src", "campaign.config.js"), generateCampaignConfig(opts));
    steps.push("Project assembled.");

    // Tarball → GCS → Cloud Build → Cloud Run
    const tarBuffer = await createSourceTarball(tmpDir);
    steps.push(`Packaged (${(tarBuffer.length / 1024).toFixed(0)} KB).`);
    await gcsUpload(`builds/${objectName}`, tarBuffer, "application/gzip");

    // Upload to the Cloud Build bucket (separate from our GCS_BUCKET)
    const token = await getGcpAccessToken();
    const uploadRes = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${buildBucket}/o?uploadType=media&name=${encodeURIComponent(objectName)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/gzip", "Content-Length": String(tarBuffer.length) },
        body: tarBuffer,
      }
    );
    if (!uploadRes.ok) throw new Error(`GCS upload failed: ${await uploadRes.text()}`);

    steps.push("Uploaded to Cloud Storage.");
    const buildOp = await triggerCloudBuild(buildBucket, objectName, imageTag);
    steps.push("Cloud Build started (1-3 min)...");
    await waitForBuild(buildOp.name);
    steps.push(`Image built: ${imageTag}`);
    const servicePath = await deployToCloudRun(serviceName, imageTag);
    steps.push("Deployed to Cloud Run.");
    await setPublicAccess(servicePath);
    const serviceUrl = await getServiceUrl(servicePath);
    steps.push(`Live at: ${serviceUrl}`);

    return { steps, serviceUrl };
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Custom-page build + deploy helper ───────────────────────────────────────
async function buildAndDeployCustom(opts) {
  const steps = [];
  const serviceName = opts.serviceName;
  const ts = Date.now();
  const imageTag = `gcr.io/${GCP_PROJECT}/${serviceName}:${ts}`;
  const buildBucket = `${GCP_PROJECT}_cloudbuild`;
  const objectName = `source/${serviceName}-custom-${ts}.tar.gz`;
  const tmpDir = `/tmp/_build_custom_${serviceName}_${ts}`;
  mkdirSync(tmpDir, { recursive: true });

  try {
    // 1. Untar uploaded dist into tmpDir/dist/
    const distRes = await gcsDownload(opts.distObjectName);
    if (!distRes) throw new Error(`Dist ${opts.distObjectName} not found in GCS.`);
    const distBuffer = Buffer.from(await distRes.arrayBuffer());
    const distOutDir = join(tmpDir, "dist");
    mkdirSync(distOutDir, { recursive: true });
    await extractTarball(distBuffer, distOutDir);

    // Sanity check — a real frontend dist must have an index.html at the root
    if (!existsSync(join(distOutDir, "index.html"))) {
      throw new Error(`Uploaded dist for '${serviceName}' has no index.html at the root. Did you tar from inside the dist/ directory? Use: tar -czf - -C dist . | base64`);
    }
    steps.push("Dist extracted.");

    // 2. Write the static Dockerfile + nginx.conf from baked templates
    const dockerfileSrc = readFileSync(join(TEMPLATES_DIR, "custom-page", "Dockerfile.template"), "utf-8");
    const nginxSrc = readFileSync(join(TEMPLATES_DIR, "custom-page", "nginx.conf"), "utf-8");
    writeFileSync(join(tmpDir, "Dockerfile"), dockerfileSrc);
    writeFileSync(join(tmpDir, "nginx.conf"), nginxSrc);

    // 3. Tarball, upload, build, deploy — same shape as buildAndDeploy
    const tarBuffer = await createSourceTarball(tmpDir);
    steps.push(`Packaged (${(tarBuffer.length / 1024).toFixed(0)} KB).`);

    const token = await getGcpAccessToken();
    const uploadRes = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${buildBucket}/o?uploadType=media&name=${encodeURIComponent(objectName)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/gzip", "Content-Length": String(tarBuffer.length) },
        body: tarBuffer,
      }
    );
    if (!uploadRes.ok) throw new Error(`GCS upload failed: ${await uploadRes.text()}`);
    steps.push("Uploaded to Cloud Storage.");

    const buildOp = await triggerCloudBuild(buildBucket, objectName, imageTag);
    steps.push("Cloud Build started (~30s)...");
    await waitForBuild(buildOp.name);
    steps.push(`Image built: ${imageTag}`);

    const servicePath = await deployToCloudRun(serviceName, imageTag);
    steps.push("Deployed to Cloud Run.");
    await setPublicAccess(servicePath);
    const serviceUrl = await getServiceUrl(servicePath);
    steps.push(`Live at: ${serviceUrl}`);

    return { steps, serviceUrl };
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ── MCP Server Factory ─────────────────────────────────────────────────────
const SERVER_INSTRUCTIONS = `You help people at Flight Studio create landing pages for their brands (The Diary of a CEO, We Need To Talk, and others).

YOU ARE TALKING TO MARKETING PEOPLE, NOT DEVELOPERS. Never:
- Present multiple technical approaches or architecture options
- Write specs, design docs, or implementation plans
- Ask them to "review" code, specs, or technical documents
- Show code, file paths, or technical details unless asked
- Use terms like "scaffold", "config", "component", "template", "slug", "consent source"
- Ask them to make technical decisions — just make the right choice yourself
- Do a "self-review" or ask for approval before building — just build it

DO:
- Ask simple questions in plain English: "Which brand?", "What's the headline?", "What should the button say?"
- Figure out technical fields yourself (campaign slug, consent source, service name) from what they tell you
- Just build it and show them the result — don't explain how
- When something goes wrong, fix it yourself or explain the problem simply

WORKFLOW — always follow this order:
1. Ask what they need (brand, campaign type, copy, Klaviyo list ID)
2. Use deploy_landing_page to build and deploy a preview — it takes about 2 minutes
3. Share the preview URL: "Here's your page — take a look and tell me what you'd like to change"
4. When they want changes, use update_landing_page — same URL, just refresh after a couple of minutes
5. When they're happy, use setup_domain to give it a proper subdomain

If they want to use a custom image, use upload_asset first, then deploy or update.

KLAVIYO LIST ID — they need to provide this. If they don't know it: "You can find it in Klaviyo > Audience > Lists & Segments — click the list and grab the short code from the URL."

A/B VARIANTS — ask what they want to test, then name the variants yourself with descriptive names. Never use "a"/"b".

META PIXEL — this is already in the brand preset. Don't ask about it unless it's missing.`;

function createMcpServer() {
  const s = new McpServer(
    { name: "campaign-studio", version: "2.2.0" },
    { instructions: SERVER_INSTRUCTIONS }
  );
  registerTools(s);
  return s;
}

function registerTools(server) {

// ── Tool: list_brands ───────────────────────────────────────────────────────
server.tool(
  "list_brands",
  "List available brand presets with their Klaviyo IDs, logos, and associated domains",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(loadBrands(), null, 2) }],
  })
);

// ── Tool: deploy_landing_page ───────────────────────────────────────────────
server.tool(
  "deploy_landing_page",
  `Create and deploy a new landing page to Cloud Run. Returns a live preview URL in about 2 minutes.
The campaign config is stored so you can update it later with update_landing_page.`,
  {
    brand: z.string().describe("Brand preset key: 'doac' or 'wntt'"),
    serviceName: z.string().describe("Cloud Run service name (lowercase, hyphenated), e.g. 'doac-london-meetgreet'"),
    campaignSlug: z.string().describe("Lowercase hyphenated slug for tracking, e.g. 'doac-london-meetgreet'"),
    campaignName: z.string().describe("Campaign name for tracking"),
    pageTitle: z.string().describe("Browser tab title"),
    klaviyoListId: z.string().describe("Existing Klaviyo List ID, e.g. 'VgEHAy'"),
    consentSource: z.string().describe("Format: YYYYMM_BrandCampaign, e.g. '202604_DOACLondonMeetGreet'"),
    ogDescription: z.string().optional().describe("Social-share preview description (og:description). Defaults to empty if omitted."),
    ogImagePath: z.string().optional().describe("Path to OG image, e.g. '/assets/og-image.jpg' (the default). Upload a custom image with upload_asset first."),
    ogUrl: z.string().optional().describe("Canonical URL for og:url. Usually filled in via update_landing_page once the final URL is known."),
    variants: z.array(z.string()).describe("Descriptive A/B variant names, e.g. ['headline-direct', 'headline-question']. Never use 'a'/'b'."),
    content: z.object({
      label: z.string().describe("Label text, e.g. 'LIMITED TIME'"),
      headline: z.string().describe("Main headline text"),
      headlineAccent: z.string().describe("Second line / accent text"),
      body: z.string().describe("Body copy (1-2 sentences)"),
      postSubmitHeadline: z.string().describe("Post-submission headline, e.g. \"You're in!\""),
      postSubmitBody: z.string().describe("Post-submission body text"),
      submitButton: z.string().describe("Submit button text, e.g. 'Enter Now'"),
    }),
  },
  async (params) => {
    const brandFile = join(TEMPLATE_DIR, "src", "brands", `${params.brand}.js`);
    if (!existsSync(brandFile)) {
      const available = readdirSync(join(TEMPLATE_DIR, "src", "brands")).filter(f => f.endsWith(".js")).map(f => f.replace(".js", ""));
      return { content: [{ type: "text", text: `Error: Brand '${params.brand}' not found. Available: ${available.join(", ")}` }], isError: true };
    }
    try {
      // Store config to GCS for future updates
      const configJson = JSON.stringify(params, null, 2);
      await gcsUpload(`configs/${params.serviceName}.json`, Buffer.from(configJson), "application/json");

      const { steps, serviceUrl } = await buildAndDeploy(params);
      return {
        content: [{
          type: "text",
          text: [
            `Campaign deployed!`, ``, ...steps, ``,
            `Preview: ${serviceUrl}`,
            ``,
            `To make changes, use update_landing_page.`,
            `To add a custom domain, use setup_domain.`,
          ].join("\n"),
        }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Deployment failed: ${err.message}` }], isError: true };
    }
  }
);

// ── Tool: update_landing_page ───────────────────────────────────────────────
server.tool(
  "update_landing_page",
  `Update an existing deployed landing page. Fetches the stored config, merges your changes, rebuilds, and deploys to the same URL.
Only provide the fields you want to change — everything else stays the same.`,
  {
    serviceName: z.string().describe("The service name used when it was first deployed"),
    content: z.object({
      label: z.string().optional(),
      headline: z.string().optional(),
      headlineAccent: z.string().optional(),
      body: z.string().optional(),
      postSubmitHeadline: z.string().optional(),
      postSubmitBody: z.string().optional(),
      submitButton: z.string().optional(),
    }).optional().describe("Updated content fields — only include what's changing"),
    variants: z.array(z.string()).optional().describe("Updated variant names"),
    pageTitle: z.string().optional().describe("Updated browser tab title"),
    klaviyoListId: z.string().optional().describe("Updated Klaviyo list ID"),
    ogDescription: z.string().optional().describe("Updated og:description for social-share previews"),
    ogImagePath: z.string().optional().describe("Updated path to OG image, e.g. '/assets/og-image.jpg'"),
    ogUrl: z.string().optional().describe("Updated canonical URL for og:url"),
  },
  async (params) => {
    try {
      const existing = await gcsDownloadJson(`configs/${params.serviceName}.json`);
      if (!existing) {
        return { content: [{ type: "text", text: `Error: No stored config found for '${params.serviceName}'. Was it deployed with deploy_landing_page?` }], isError: true };
      }

      // Deep merge
      const merged = { ...existing };
      if (params.content) merged.content = { ...existing.content, ...params.content };
      if (params.variants) merged.variants = params.variants;
      if (params.pageTitle) merged.pageTitle = params.pageTitle;
      if (params.klaviyoListId) merged.klaviyoListId = params.klaviyoListId;
      if (params.ogDescription !== undefined) merged.ogDescription = params.ogDescription;
      if (params.ogImagePath !== undefined) merged.ogImagePath = params.ogImagePath;
      if (params.ogUrl !== undefined) merged.ogUrl = params.ogUrl;

      // Store updated config
      await gcsUpload(`configs/${params.serviceName}.json`, Buffer.from(JSON.stringify(merged, null, 2)), "application/json");

      const { steps, serviceUrl } = await buildAndDeploy(merged);
      return {
        content: [{
          type: "text",
          text: [
            `Page updated!`, ``, ...steps, ``,
            `Same URL: ${serviceUrl}`,
            `Refresh your browser to see the changes.`,
          ].join("\n"),
        }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Update failed: ${err.message}` }], isError: true };
    }
  }
);

// ── Tool: upload_asset ──────────────────────────────────────────────────────
server.tool(
  "upload_asset",
  `Upload an image or media file for a campaign. The asset will be included in the next deploy or update.
Accepts base64-encoded file content.`,
  {
    serviceName: z.string().describe("The service name this asset belongs to"),
    fileName: z.string().describe("File name including extension, e.g. 'bg-image.jpg' or 'og-image.jpg'"),
    base64Content: z.string().describe("Base64-encoded file content"),
    contentType: z.string().optional().describe("MIME type, e.g. 'image/jpeg'. Auto-detected from extension if omitted."),
  },
  async ({ serviceName, fileName, base64Content, contentType }) => {
    try {
      const mimeTypes = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4" };
      const ext = fileName.split(".").pop().toLowerCase();
      const mime = contentType || mimeTypes[ext] || "application/octet-stream";
      const buffer = Buffer.from(base64Content, "base64");

      await gcsUpload(`assets/${serviceName}/${fileName}`, buffer, mime);

      return {
        content: [{
          type: "text",
          text: `Uploaded ${fileName} (${(buffer.length / 1024).toFixed(0)} KB) for ${serviceName}.\nIt will be included in the next deploy or update.`,
        }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Upload failed: ${err.message}` }], isError: true };
    }
  }
);

// ── Tool: setup_domain ──────────────────────────────────────────────────────
server.tool(
  "setup_domain",
  `Set up a custom subdomain for a deployed landing page.
Creates CNAME in GoDaddy, verifies domain with Google, creates Cloud Run domain mapping.
SSL provisioning takes 15-30 min after setup.`,
  {
    serviceName: z.string().describe("Cloud Run service name (must already be deployed)"),
    subdomain: z.string().describe("Subdomain to create, e.g. 'studio' (without the domain)"),
    brand: z.string().describe("Brand key: 'doac' or 'wntt'"),
  },
  async ({ serviceName, subdomain, brand }) => {
    const domain = DOMAINS[brand];
    if (!domain) {
      return { content: [{ type: "text", text: `Error: No domain for brand '${brand}'. Available: ${Object.keys(DOMAINS).join(", ")}` }], isError: true };
    }
    const fullDomain = `${subdomain}.${domain}`;
    const steps = [];

    try {
      // Check if CNAME already exists before creating
      let cnameExists = false;
      try {
        const existing = await godaddyRequest("GET", `/v1/domains/${domain}/records/CNAME/${subdomain}`);
        if (Array.isArray(existing) && existing.some(r => r.data === "ghs.googlehosted.com")) {
          cnameExists = true;
          steps.push(`CNAME already exists: ${fullDomain} → ghs.googlehosted.com`);
        }
      } catch { /* no existing record */ }

      if (!cnameExists) {
        steps.push(`Adding CNAME: ${fullDomain} → ghs.googlehosted.com`);
        await addDnsRecord(domain, "CNAME", subdomain, "ghs.googlehosted.com");
        steps.push("CNAME created.");
      }

      try {
        const vToken = await getVerificationToken(domain);
        await addDnsRecord(domain, "TXT", "@", vToken);
        steps.push("TXT verification record added.");
        await new Promise((r) => setTimeout(r, 5000));
        await verifyDomain(domain);
        steps.push("Domain verified with Google.");
      } catch (err) {
        if (err.message.includes("already")) steps.push(`Domain ${domain} already verified.`);
        else steps.push(`Verification warning: ${err.message} — continuing.`);
      }

      steps.push(`Mapping ${fullDomain} → ${serviceName}...`);
      const mapping = await createDomainMapping(serviceName, subdomain, domain);
      steps.push(mapping.status === "already_exists" ? "Mapping already exists." : "Mapping created.");

      // Check mapping status for errors (e.g. PermissionDenied)
      try {
        const token = await getGcpAccessToken();
        const checkRes = await fetch(
          `https://${GCP_REGION}-run.googleapis.com/apis/domains.cloudrun.com/v1/namespaces/${GCP_PROJECT}/domainmappings/${fullDomain}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (checkRes.ok) {
          const mappingData = await checkRes.json();
          const conditions = mappingData.status?.conditions || [];
          const errors = conditions.filter(c => c.status !== "True" && c.message);
          if (errors.length > 0) {
            for (const err of errors) {
              steps.push(`⚠ ${err.type}: ${err.message}`);
            }
            if (errors.some(e => e.message?.includes("permission") || e.message?.includes("Permission"))) {
              steps.push("→ The service account likely needs Owner permission in Google Search Console for this domain.");
            }
          }
        }
      } catch { /* non-fatal — status check is best-effort */ }

      return {
        content: [{
          type: "text",
          text: [...steps, ``, `Site will be at: https://${fullDomain}`, `SSL takes 15-30 min. Use check_ssl_status to verify.`].join("\n"),
        }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Domain setup failed: ${err.message}` }], isError: true };
    }
  }
);

// ── Tool: check_ssl_status ──────────────────────────────────────────────────
server.tool(
  "check_ssl_status",
  "Check if a custom domain's SSL is provisioned and the site is reachable.",
  {
    subdomain: z.string().describe("Subdomain, e.g. 'studio'"),
    brand: z.string().describe("Brand key: 'doac' or 'wntt'"),
  },
  async ({ subdomain, brand }) => {
    const domain = DOMAINS[brand];
    if (!domain) return { content: [{ type: "text", text: `Error: No domain for brand '${brand}'.` }], isError: true };
    const fullDomain = `${subdomain}.${domain}`;
    const checks = [];

    try {
      const records = await dns.resolveCname(fullDomain);
      checks.push(`DNS CNAME: ${records.join(", ")}`);
    } catch (err) {
      checks.push(err.code === "ENODATA" || err.code === "ENOTFOUND" ? "DNS CNAME: not resolved yet" : `DNS: ${err.code}`);
    }

    try {
      const res = await fetch(`https://${fullDomain}`, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000) });
      checks.push(`HTTPS: ${res.status} ${res.statusText}`);
      if (res.ok) checks.push("SSL is provisioned and site is live!");
      else if (res.status === 503) checks.push("SSL still provisioning. Try again in a few minutes.");
    } catch (err) {
      checks.push(`HTTPS: not reachable (${err.message}). SSL may still be provisioning.`);
    }

    return { content: [{ type: "text", text: [`SSL status for https://${fullDomain}`, ``, ...checks].join("\n") }] };
  }
);

// ── Tool: upload_dist ───────────────────────────────────────────────────────
server.tool(
  "upload_dist",
  `Upload a built static frontend (Vite dist/, Next.js out/, etc.) for a custom-page deploy.
Send a base64-encoded gzipped tarball of the dist directory contents. Use the tar-from-inside-dist recipe so files land at the archive root (not nested under a wrapping folder):
  tar -czf - -C dist . | base64
The dist will be picked up by the next deploy_custom_page or update_custom_page call for this serviceName.`,
  {
    serviceName: z.string().describe("Cloud Run service name (lowercase, hyphenated). Same name used in deploy_custom_page."),
    base64Tarball: z.string().describe("Base64-encoded gzipped tarball of the local dist/ directory contents."),
  },
  async ({ serviceName, base64Tarball }) => {
    try {
      const buffer = Buffer.from(base64Tarball, "base64");
      const MAX_BYTES = 25 * 1024 * 1024;
      if (buffer.length > MAX_BYTES) {
        return { content: [{ type: "text", text: `Dist tarball is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — over the 25 MB cap. This usually means node_modules or source files got tarred. Re-run the recipe: \`tar -czf - -C dist . | base64\`` }], isError: true };
      }
      const ts = Date.now();
      const objectName = `dist/${serviceName}/${ts}.tar.gz`;
      await gcsUpload(objectName, buffer, "application/gzip");
      return {
        content: [{
          type: "text",
          text: `Uploaded dist (${(buffer.length / 1024).toFixed(0)} KB) for ${serviceName}.\nUse deploy_custom_page (first time) or update_custom_page (subsequent deploys) next.`,
        }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Upload failed: ${err.message}` }], isError: true };
    }
  }
);

// ── Tool: deploy_custom_page ────────────────────────────────────────────────
server.tool(
  "deploy_custom_page",
  `First-time deploy of a custom-built static page to Cloud Run. Wraps the latest uploaded dist in nginx:alpine, deploys to Cloud Run, returns the live URL (~30s).
Use this for bespoke campaigns (custom layout, custom flows, non-standard signup). For DOAC/WNTT-style signup pages use deploy_landing_page instead.
Requires upload_dist to have been called first for the same serviceName.`,
  {
    serviceName: z.string().describe("Cloud Run service name (lowercase, hyphenated). Must match the upload_dist serviceName."),
    pageTitle: z.string().describe("Browser tab title (already baked into the dist; stored here as metadata)."),
    ogUrl: z.string().optional().describe("Canonical URL for og:url, once a domain is set up. Optional on first deploy."),
  },
  async (params) => {
    try {
      const objects = await gcsList(`dist/${params.serviceName}/`);
      if (objects.length === 0) {
        return { content: [{ type: "text", text: `No dist uploaded for '${params.serviceName}'. Run upload_dist first.` }], isError: true };
      }
      const latest = objects.sort().pop();

      // Soft guard against a name collision with a standard-flow campaign
      const standardConfig = await gcsDownloadJson(`configs/${params.serviceName}.json`);
      if (standardConfig) {
        return { content: [{ type: "text", text: `Service '${params.serviceName}' already exists as a standard signup campaign. Pick a different serviceName, or use update_landing_page if you meant to update the existing one.` }], isError: true };
      }

      const config = { ...params, latestDist: latest, deployedAt: new Date().toISOString() };
      await gcsUpload(`custom-configs/${params.serviceName}.json`, Buffer.from(JSON.stringify(config, null, 2)), "application/json");

      const { steps, serviceUrl } = await buildAndDeployCustom({ ...params, distObjectName: latest });

      return {
        content: [{
          type: "text",
          text: [
            `Custom page deployed!`, ``, ...steps, ``,
            `Preview: ${serviceUrl}`,
            ``,
            `To redeploy after rebuilding locally: upload_dist then update_custom_page.`,
            `To add a custom domain: setup_domain.`,
            `To remove everything: teardown_custom_page.`,
          ].join("\n"),
        }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Deployment failed: ${err.message}` }], isError: true };
    }
  }
);

// ── Tool: update_custom_page ────────────────────────────────────────────────
server.tool(
  "update_custom_page",
  `Redeploy an existing custom page. Picks up the latest dist from upload_dist, builds, deploys to the same URL.
Important: deploys whatever's in the latest upload_dist call. Run \`npm run build\` and re-upload the dist before this to ship local edits.`,
  {
    serviceName: z.string().describe("The service name used at first deploy."),
    ogUrl: z.string().optional().describe("Updated og:url if the domain has been set up since the first deploy."),
  },
  async (params) => {
    try {
      const existing = await gcsDownloadJson(`custom-configs/${params.serviceName}.json`);
      if (!existing) {
        return { content: [{ type: "text", text: `No stored custom-page config for '${params.serviceName}'. Was it deployed with deploy_custom_page?` }], isError: true };
      }

      const objects = await gcsList(`dist/${params.serviceName}/`);
      if (objects.length === 0) {
        return { content: [{ type: "text", text: `No dist found for '${params.serviceName}'. Run upload_dist before update_custom_page.` }], isError: true };
      }
      const latest = objects.sort().pop();

      const merged = { ...existing, latestDist: latest, deployedAt: new Date().toISOString() };
      if (params.ogUrl !== undefined) merged.ogUrl = params.ogUrl;
      await gcsUpload(`custom-configs/${params.serviceName}.json`, Buffer.from(JSON.stringify(merged, null, 2)), "application/json");

      const { steps, serviceUrl } = await buildAndDeployCustom({ ...merged, distObjectName: latest });
      return {
        content: [{
          type: "text",
          text: [
            `Custom page updated!`, ``, ...steps, ``,
            `Same URL: ${serviceUrl}`,
            `Refresh your browser to see the changes.`,
          ].join("\n"),
        }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Update failed: ${err.message}` }], isError: true };
    }
  }
);

// ── Tool: teardown_custom_page ──────────────────────────────────────────────
server.tool(
  "teardown_custom_page",
  `Permanently delete a custom-page Cloud Run service and its GCS artefacts (dist tarballs, config, uploaded assets).
Container images are NOT deleted in v1 — they accrue at ~$0.02/month each, acceptable short-term.
Pass confirm: true to actually delete.`,
  {
    serviceName: z.string().describe("Cloud Run service name to destroy."),
    confirm: z.literal(true).describe("Must be true. Prevents accidental teardowns."),
  },
  async ({ serviceName, confirm }) => {
    if (confirm !== true) {
      return { content: [{ type: "text", text: "Pass confirm: true to actually delete." }], isError: true };
    }
    const steps = [];
    try {
      const token = await getGcpAccessToken();
      const servicePath = `projects/${GCP_PROJECT}/locations/${GCP_REGION}/services/${serviceName}`;
      const delRes = await fetch(`https://run.googleapis.com/v2/${servicePath}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (delRes.ok) steps.push("Cloud Run service deleted.");
      else if (delRes.status === 404) steps.push("Cloud Run service already gone.");
      else steps.push(`Cloud Run delete warning: ${delRes.status} ${(await delRes.text()).slice(0, 200)}`);

      const dists = await gcsList(`dist/${serviceName}/`);
      for (const d of dists) await gcsDelete(d);
      steps.push(`Deleted ${dists.length} dist tarball(s).`);

      await gcsDelete(`custom-configs/${serviceName}.json`);
      steps.push("Deleted custom-configs entry.");

      const assets = await gcsList(`assets/${serviceName}/`);
      for (const a of assets) await gcsDelete(a);
      if (assets.length > 0) steps.push(`Deleted ${assets.length} asset(s).`);

      return { content: [{ type: "text", text: [`Teardown complete for '${serviceName}'.`, ``, ...steps].join("\n") }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Teardown failed: ${err.message}\nCompleted steps:\n${steps.map(s => `  - ${s}`).join("\n")}` }], isError: true };
    }
  }
);

// ── Tool: teardown_landing_page (standard-flow companion) ──────────────────
server.tool(
  "teardown_landing_page",
  `Permanently delete a standard-flow Cloud Run service and its GCS artefacts (config, uploaded assets).
For pages deployed with deploy_landing_page. Use teardown_custom_page for custom-page deploys.
Container images are NOT deleted in v1. Pass confirm: true to actually delete.`,
  {
    serviceName: z.string().describe("Cloud Run service name to destroy."),
    confirm: z.literal(true).describe("Must be true. Prevents accidental teardowns."),
  },
  async ({ serviceName, confirm }) => {
    if (confirm !== true) {
      return { content: [{ type: "text", text: "Pass confirm: true to actually delete." }], isError: true };
    }
    const steps = [];
    try {
      const token = await getGcpAccessToken();
      const servicePath = `projects/${GCP_PROJECT}/locations/${GCP_REGION}/services/${serviceName}`;
      const delRes = await fetch(`https://run.googleapis.com/v2/${servicePath}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (delRes.ok) steps.push("Cloud Run service deleted.");
      else if (delRes.status === 404) steps.push("Cloud Run service already gone.");
      else steps.push(`Cloud Run delete warning: ${delRes.status} ${(await delRes.text()).slice(0, 200)}`);

      await gcsDelete(`configs/${serviceName}.json`);
      steps.push("Deleted configs entry.");

      const assets = await gcsList(`assets/${serviceName}/`);
      for (const a of assets) await gcsDelete(a);
      if (assets.length > 0) steps.push(`Deleted ${assets.length} asset(s).`);

      return { content: [{ type: "text", text: [`Teardown complete for '${serviceName}'.`, ``, ...steps].join("\n") }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Teardown failed: ${err.message}\nCompleted steps:\n${steps.map(s => `  - ${s}`).join("\n")}` }], isError: true };
    }
  }
);

} // end registerTools

// ── Express + StreamableHTTP Transport ──────────────────────────────────────
const app = express();
// Only parse JSON for non-MCP routes; StreamableHTTPServerTransport reads the body itself
app.use((req, res, next) => {
  if (req.path === "/mcp") return next();
  express.json()(req, res, next);
});

// Health check (no auth)
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// OAuth discovery stubs — Claude Desktop checks these before connecting
// Return "no auth required" responses so it proceeds without OAuth
app.get("/.well-known/oauth-protected-resource", (_req, res) => res.status(404).end());
app.get("/.well-known/oauth-protected-resource/*", (_req, res) => res.status(404).end());
app.get("/.well-known/oauth-authorization-server", (_req, res) => res.status(404).end());
app.post("/register", (_req, res) => res.status(404).end());

// Ensure Accept header includes what StreamableHTTPServerTransport requires
app.use("/mcp", (req, _res, next) => {
  if (req.method === "POST") {
    const accept = req.headers.accept || "";
    if (!accept.includes("text/event-stream")) {
      req.headers.accept = "application/json, text/event-stream";
    }
  }
  next();
});

// Auth middleware for MCP endpoint
// Bearer token auth for programmatic access; skipped when no token is configured
// Claude Desktop custom connectors use OAuth or no auth — bearer is for CLI/API use
function authMiddleware(req, res, next) {
  if (!MCP_AUTH_TOKEN) return next();
  const auth = req.headers.authorization;
  if (auth && auth !== `Bearer ${MCP_AUTH_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// MCP endpoint — stateless mode (no session management needed)
const transports = {};

app.all("/mcp", authMiddleware, async (req, res) => {
  try {
    // For GET requests (SSE), or DELETE, pass through
    if (req.method === "GET" || req.method === "DELETE") {
      const sessionId = req.headers["mcp-session-id"];
      const transport = transports[sessionId];
      if (transport) {
        await transport.handleRequest(req, res);
      } else {
        res.status(400).json({ error: "No transport found for session" });
      }
      return;
    }

    // POST — check if there's an existing session
    const sessionId = req.headers["mcp-session-id"];
    if (sessionId && transports[sessionId]) {
      await transports[sessionId].handleRequest(req, res);
      return;
    }

    // New session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid && transports[sid]) {
        delete transports[sid];
      }
    };

    await createMcpServer().connect(transport);

    // Store transport by session ID after first request
    const origWriteHead = res.writeHead.bind(res);
    res.writeHead = function(statusCode, ...args) {
      const sid = transport.sessionId;
      if (sid) transports[sid] = transport;
      return origWriteHead(statusCode, ...args);
    };

    await transport.handleRequest(req, res);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// ── SSE Transport (for Claude Desktop compatibility) ───────────────────────
const sseTransports = {};

app.get("/sse", authMiddleware, async (_req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  sseTransports[transport.sessionId] = transport;

  transport.onclose = () => {
    delete sseTransports[transport.sessionId];
  };

  await createMcpServer().connect(transport);
});

app.post("/messages", authMiddleware, async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = sseTransports[sessionId];
  if (!transport) {
    return res.status(400).json({ error: "No transport found for session" });
  }
  await transport.handlePostMessage(req, res);
});

if (STDIO_MODE) {
  const transport = new StdioServerTransport();
  const server = createMcpServer();
  await server.connect(transport);
  console.error(`Campaign Studio MCP (stdio) — template: ${TEMPLATE_DIR}`);
} else {
  app.listen(PORT, () => {
    console.log(`Campaign Studio MCP server listening on port ${PORT}`);
    console.log(`Health:         http://localhost:${PORT}/health`);
    console.log(`MCP (HTTP):     http://localhost:${PORT}/mcp`);
    console.log(`MCP (SSE):      http://localhost:${PORT}/sse`);
  });
}
