# Campaign Studio MCP Server

MCP server that lets you create, deploy, and manage Flight Studio landing page campaigns from Claude Desktop.

> **If you're building a campaign, you do NOT need this folder.** The MCP is already deployed to Cloud Run. Just add the remote connector URL in Claude Desktop and go — see the root [README.md](../README.md) step 4.
>
> This folder is for **developing the MCP itself** — adding tools, fixing bugs, redeploying. Only touch it if that's what you're doing.

## Local development setup

Use this flow when you need to run the server locally to debug or extend it.

### 1. Install dependencies

```bash
cd mcp-server
npm ci
```

### 2. Configure credentials

Drop a GCP service account JSON key into `credentials/` (the folder is gitignored).

Create `mcp-server/.env`:

```
GOOGLE_APPLICATION_CREDENTIALS=./credentials/<your-sa-key-filename>.json
GCP_PROJECT=steven-warehouse-dev
GCP_REGION=europe-west1
```

The service account needs these roles: `roles/cloudbuild.builds.editor`, `roles/run.admin`, `roles/storage.objectAdmin`, `roles/siteVerification.admin`, plus Owner on each domain in Google Search Console.

### 3. Point Claude Desktop at the local server

Open Claude Desktop → Settings → Developer → Edit Config:

```json
{
  "mcpServers": {
    "landing-pages-local": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/server.js"]
    }
  }
}
```

Restart Claude Desktop. Keep the remote connector enabled too if you want to flip between them.

## Tools

The server exposes two deploy modes against the same Cloud Run / GCS infrastructure.

### Standard signup mode — for DOAC / WNTT / HSR signup pages

Builds from a fixed template baked into the server's image. Customisable through the tool args (copy, brand preset, Klaviyo list **or** Beehiiv UTM trio, A/B variants, swappable assets, dynamic form fields).

Brand × subscriber-provider pairing:

- **Klaviyo brands** (DOAC, WNTT, all others): pass `klaviyoListId` + `consentSource`. UTM fields are rejected.
- **Beehiiv brands** (HSR only): pass `utmSource` + `utmMedium` + `utmCampaign`. `klaviyoListId` is rejected.
- The brand preset's `provider` field is the source of truth. `deploy_landing_page` rejects mismatches with a clear error message.

| Tool | What it does |
|------|-------------|
| `list_brands` | Shows brand presets with provider + Klaviyo/Beehiiv IDs + domains |
| `deploy_landing_page` | First-time deploy of a standard signup page to Cloud Run (~2 min). Accepts `formFields` for custom form schemas. |
| `update_landing_page` | Update an existing standard deploy (same URL, new revision). Can also update `utmSource`/`utmMedium`/`utmCampaign`/`formFields`. |
| `upload_asset` | Upload images/media for use in next standard deploy |
| `teardown_landing_page` | Delete a standard service + GCS config + assets (`confirm: true` required) |

For HSR campaigns, the marketer-supplied form fields become Beehiiv `custom_fields` on every submission. The proxy automatically populates `Acquisition Source` with `${campaign_name} — ${variant}` so marketers can filter Beehiiv by exact campaign + variant.

### Custom-page mode — for bespoke designs

Wraps a pre-built `dist/` (Vite, Next.js, or any static frontend) in `nginx:alpine` and deploys to Cloud Run. The server doesn't read local files, so the marketer's build artefact must be uploaded explicitly.

| Tool | What it does |
|------|-------------|
| `upload_dist` | Upload a base64'd gzipped tarball of a local `dist/`. Recipe: `tar -czf - -C dist . \| base64`. 25 MB cap. |
| `deploy_custom_page` | First-time deploy of the latest uploaded dist (~30s — no `npm ci`) |
| `update_custom_page` | Redeploy the latest uploaded dist (same URL, new revision). Re-run `upload_dist` first to ship local edits. |
| `teardown_custom_page` | Delete the service + dist tarballs + custom-config + assets (`confirm: true` required) |

### Shared (work for both modes)

| Tool | What it does |
|------|-------------|
| `setup_domain` | GoDaddy CNAME + Google verification + Cloud Run domain mapping |
| `check_ssl_status` | Checks if SSL is provisioned and the site is reachable |

### Beehiiv subscribe proxy — HTTP, not MCP

Browsers (campaign pages) call this directly, not through Claude. It lives on the same Cloud Run service alongside the MCP routes.

```
POST /api/subscribe-beehiiv
Origin: <one of: localhost / *.run.app / brand domain>
Content-Type: application/json
Body: {
  email: "...",
  utm_source / utm_medium / utm_campaign / referring_site,
  tags: [string],            // becomes both: lowercased Beehiiv tags + "Acquisition Source" custom field
  custom_fields: [ { name, value } ]   // marketer-defined extras (must match existing Beehiiv fields)
}
```

- Holds `BEEHIIV_API_KEY` server-side. The static campaign bundle never sees it.
- CORS allow-list, 10kb body limit, 10 req/min/IP rate limit, email-format validation.
- Two-step Beehiiv flow: (1) create subscription with `custom_fields`, (2) best-effort attach tags via `POST /publications/<pub>/subscriptions/<id>/tags`. If step 2 fails, the `Acquisition Source` custom field still carries the campaign+variant.
- **Important Beehiiv quirk:** custom field values for fields that don't exist on the publication are silently dropped. The MCP keeps a `KNOWN_BEEHIIV_FIELDS` list (server.js, ~25 entries) and warns in `deploy_landing_page` output when a campaign uses a field name outside that list. Update the list when HSR's admin adds new custom fields in the Beehiiv UI.

### GCS layout

The server stores artefacts and metadata under these prefixes (bucket: `<project>_campaign-studio`):

```
configs/<service>.json              standard signup mode metadata (both Klaviyo and Beehiiv brands)
custom-configs/<service>.json       custom-page mode metadata
assets/<service>/<file>             marketer-uploaded images for either mode
dist/<service>/<ts>.tar.gz          uploaded dist tarballs (custom mode)
builds/source/<svc>-<ts>.tar.gz     transient Cloud Build sources (auto-cleanup recommended)
```

Standard and custom configs live under different prefixes by design — `update_landing_page` cannot accidentally read a custom-page config and vice versa.

### Server env vars (Cloud Run)

| Var | Purpose |
|---|---|
| `GCP_PROJECT` / `GCP_REGION` | Where to deploy campaigns |
| `GCP_SA_KEY` (base64) | Service account credentials for Cloud Build / Cloud Run / GCS / Site Verification |
| `GODADDY_KEY` / `GODADDY_SECRET` | DNS record creation for `setup_domain` |
| `DOMAINS_JSON` | Brand → root domain map (e.g. `{"doac":"thediary.com","hsr":"hsrowntheroom.com"}`) |
| `MCP_AUTH_TOKEN` (optional) | Bearer auth for the `/mcp` route |
| `BEEHIIV_API_KEY` | **HSR only** — Bearer key for the `/api/subscribe-beehiiv` proxy. Set via `gcloud run services update campaign-studio --update-env-vars=BEEHIIV_API_KEY=<key>`. |
| `BEEHIIV_PUBLICATION_ID` (optional) | Override the default HSR publication ID (rare — only useful for testing against a separate publication). |

## Supported Domains

All domains managed via GoDaddy. Used by `setup_domain` to create subdomains:

| Key | Domain |
|-----|--------|
| doac | thediary.com |
| wntt | needtotalkshow.com |
| behindthediary | behindthediary.com |
| thediaryofaceo | thediaryofaceo.com |
| beginagain | beginagainshow.com |
| hsrowntheroom | hsrowntheroom.com |
| unlockthelessons | unlockthelessons.com |
| theline | the-line-show.com |
| doaccircle | doaccircle.com |
| the33rdlaw | the33rdlaw.com |
| justfckingdoit | justfckingdoit.com |
| doacscreenings | doacscreenings.com |
| flightspeakers | flight-speakers.com |

## How to Use

Open Claude Desktop, open the `landing-page-template` folder, and describe what you want:

> "Create a new landing page for the DOAC London meet and greet. Klaviyo list is VgEHAy."

Claude asks for copy/variant details, then deploys a live preview URL in ~2 minutes.

> "Set up london.thediary.com for that page"

Claude creates DNS records, verifies the domain, maps it to Cloud Run, and tells you when SSL is ready.

## Deploying the MCP Server

Use [`deploy.sh`](deploy.sh) — it builds with an immutable timestamped tag, deploys to Cloud Run, and runs the post-deploy [smoke check](smoke-check.mjs):

```bash
./mcp-server/deploy.sh
```

**Never use `:latest`.** Cloud Run pins revisions to image digests, and a mutable tag silently drifts (this caused a real prod/source mismatch — see [TEST_REPORT.md](../TEST_REPORT.md) gap #1). The deploy script always uses `gcr.io/steven-warehouse-dev/campaign-studio:YYYYMMDD-HHMMSS`.

After a deploy, **also verify out-of-band** before declaring it shipped:

```bash
curl -s -X POST https://campaign-studio-30219985459.europe-west1.run.app/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify","version":"0"}}}'
```

Then `tools/list` with the returned `mcp-session-id`. Confirm new tools are present. The smoke check already does this, but Claude Code's MCP client caches `tools/list` at session start — restart Claude Desktop / Claude Code sessions before testing the new tools.

### Rolling back

If a deploy breaks something:

```bash
gcloud container images list-tags gcr.io/steven-warehouse-dev/campaign-studio --limit 10
gcloud run deploy campaign-studio --image=gcr.io/steven-warehouse-dev/campaign-studio:<previous-tag> --region=europe-west1
```

The pinned-tag pattern means rollback is one command — no digest gymnastics.

## Troubleshooting

### Pre-deploy: API smoke tests

```bash
node test-apis.js all
```

Individual: `auth`, `gcs`, `build`, `cloudrun`, `godaddy`, `dns`.

### Custom-page mode end-to-end

Run [`test-custom-deploy.mjs`](test-custom-deploy.mjs) — boots a tiny dummy dist, runs `upload_dist → deploy → fetch → update → fetch → teardown`, asserts everything. **Creates real Cloud Run resources for ~1 min.**

```bash
MCP_AUTH_TOKEN=<token> node mcp-server/test-custom-deploy.mjs
```

The service it creates is named `custom-test-<timestamp>` and is torn down at the end. If the test fails partway, the script prints the manual cleanup command.

### Beehiiv proxy end-to-end

Run [`test-beehiiv.mjs`](test-beehiiv.mjs) — directly hits Beehiiv's API to verify create + tags + custom_fields shape. Reads `BEEHIIV_API_KEY` from env (never hardcoded).

```bash
BEEHIIV_API_KEY=<key> node mcp-server/test-beehiiv.mjs
```

**Creates real burner subscribers** (3 per run, named `zbosneaks+hsrtest-{a,b,c}-<ts>@gmail.com`). Per the project rule, **the test does NOT call DELETE on Beehiiv subscribers** — manual cleanup via the Beehiiv dashboard if you want.

## Prerequisites

- Node.js 18+
- GCP service account key for `steven-warehouse-dev`

That's it. No gcloud CLI, no Docker, no DNS tools needed for day-to-day use.
