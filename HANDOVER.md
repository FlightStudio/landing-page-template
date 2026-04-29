# Campaign Studio — Project Handover

## What This Is

A system that lets the marketing team build, deploy, and manage landing pages and quizzes without touching any infrastructure. They talk to Claude in plain English, and Claude handles the technical work — scaffolding, config, deployment, domains, SSL.

**The stack:**
- **Campaign Template** (this repo) — React/Vite landing page scaffold with brand presets, analytics, A/B testing, Klaviyo integration
- **Campaign Studio MCP** — a Node.js server on Cloud Run that gives Claude deployment superpowers (deploy, domain setup, SSL provisioning)
- **Claude Desktop** (Code mode) — the interface the marketing team actually uses

**The workflow for marketing:**
1. Open Claude Desktop, open this folder, type `/new-campaign`
2. Answer questions about the campaign (brand, copy, variants, Klaviyo list)
3. Claude scaffolds the project, shows a live preview
4. They request changes in plain English until happy
5. Claude deploys to a live URL via the MCP, sets up custom domain + SSL

No Docker, no CLI, no GCP console, no DNS panel.

---

## Where Everything Lives

Everything is in this one repo:

```
landing-page-template/
├── .claude/commands/               # Claude skills
│   ├── new-campaign.md             #   /new-campaign conversation flow
│   └── CAMPAIGN_LEARNINGS.md       #   accumulated build learnings
├── mcp-server/                     # Campaign Studio MCP server
│   ├── server.js                   #   MCP server (11 tools, v2.2.0)
│   ├── Dockerfile                  #   Cloud Run container
│   ├── package.json                #   MCP dependencies
│   ├── setup.sh                    #   developer setup (only needed if working on MCP itself)
│   ├── deploy.sh                   #   immutable-tag deploy + smoke check
│   ├── smoke-check.mjs             #   post-deploy version + schema verification
│   ├── test-apis.js                #   integration test suite (existing tools)
│   ├── test-custom-deploy.mjs      #   E2E test for custom-page mode
│   ├── templates/custom-page/      #   nginx Dockerfile + nginx.conf baked into image
│   ├── README.md                   #   MCP-specific docs
│   └── credentials/
│       └── config.example.json     #   config template (all 13 domains)
├── scripts/
│   ├── setup.sh                    # top-level setup wrapper for new joiners
│   └── scaffold.sh                 # creates new campaign projects
├── src/
│   ├── brands/                     # brand presets (doac, wntt)
│   ├── quiz-templates/             # quiz components
│   ├── campaign.config.js          # per-campaign TODO template
│   ├── consent.js                  # analytics SDK loaders
│   ├── klaviyo.js                  # Klaviyo Client API
│   └── ...                         # React components
├── public/assets/                  # brand logos
├── HANDOVER.md                     # this document
└── README.md                       # user-facing guide
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Marketing Team (Claude Desktop)                                │
│                                                                 │
│  "Deploy this campaign to live.thediary.com"                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ MCP protocol (HTTP)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Campaign Studio MCP Server (Cloud Run)                         │
│  https://campaign-studio-30219985459.europe-west1.run.app/mcp   │
│                                                                 │
│  Tools (11 — two deploy modes share the same domain/SSL helpers):│
│                                                                  │
│  Standard signup mode (DOAC / WNTT):                            │
│  • deploy_landing_page   → Cloud Build → Cloud Run              │
│  • update_landing_page   → Patch existing deployment            │
│  • upload_asset          → GCS storage                          │
│  • teardown_landing_page → Delete service + GCS metadata        │
│  • list_brands           → Available brand presets              │
│                                                                  │
│  Custom-page mode (bespoke designs):                            │
│  • upload_dist           → Tarball of pre-built static frontend │
│  • deploy_custom_page    → Wrap in nginx → Cloud Run (~30s)     │
│  • update_custom_page    → Redeploy latest dist (same URL)      │
│  • teardown_custom_page  → Delete service + dist + metadata     │
│                                                                  │
│  Shared:                                                         │
│  • setup_domain          → GoDaddy + Google Verification        │
│  • check_ssl_status      → DNS + HTTPS check                    │
└──────┬──────────┬───────────────┬───────────────┬───────────────┘
       │          │               │               │
       ▼          ▼               ▼               ▼
   Cloud Build  Cloud Run    GoDaddy API    Google Site
   (docker)     (hosting)    (DNS CNAME)    Verification
       │          │
       ▼          ▼
   Container    Live URL
   Registry     (public)
```

**GCP Project:** `steven-warehouse-dev`  
**Region:** `europe-west1`  
**Each campaign** becomes its own Cloud Run service (e.g. `doac-london-meetgreet`, `wntt-attachment-quiz`)

---

## The MCP Server

Current version: **2.2.0** (April 2026). Two deploy modes against shared Cloud Run / GCS infrastructure.

### Standard signup mode — for DOAC/WNTT signup pages

Builds from a fixed template baked into the server's Docker image. Customisable through tool args (copy, brand preset, Klaviyo list, A/B variants, swappable assets).

| Tool | What it does |
|------|-------------|
| `deploy_landing_page` | Generates campaign config → tarballs source → Cloud Build (Docker) → deploys to Cloud Run → sets public access → returns live URL. ~2 min end-to-end. |
| `update_landing_page` | Fetches stored config from GCS, merges changes, rebuilds and redeploys. Same URL, new revision. |
| `upload_asset` | Stores base64-encoded files (images, video) in GCS at `assets/<service>/`. Included in next deploy automatically. |
| `teardown_landing_page` | Deletes the Cloud Run service + GCS config + uploaded assets. Container images remain in GCR (~$0.02/mo each — see Deferred work). Pass `confirm: true` to actually delete. |
| `list_brands` | Returns available brand presets with Klaviyo IDs, domains, logos. |

### Custom-page mode — for bespoke designs (added v2.2.0)

Wraps a pre-built `dist/` (Vite, Next.js, plain static HTML — anything with an `index.html`) in `nginx:alpine` and deploys to Cloud Run. The MCP server doesn't read local files, so the marketer's build artefact is uploaded explicitly. Used for campaigns that don't fit the signup-page mould — Eventbrite ticket pages, brand pages outside DOAC/WNTT, hand-coded layouts, exports from Lovable / v0 / Figma.

| Tool | What it does |
|------|-------------|
| `upload_dist` | Stores a base64-encoded gzipped tarball of the local `dist/` at `dist/<service>/<ts>.tar.gz`. 25 MB cap. Recipe: `tar -czf - -C dist . \| base64`. |
| `deploy_custom_page` | First-time deploy: untars latest dist, writes nginx Dockerfile + nginx.conf, Cloud Build, deploys to Cloud Run. ~30s (no `npm ci` step). |
| `update_custom_page` | Redeploy latest dist for an existing service. Same URL, new revision. Re-run `upload_dist` first to pick up local edits. |
| `teardown_custom_page` | Deletes the Cloud Run service + GCS dist tarballs + custom-config + uploaded assets. Pass `confirm: true`. |

### Shared (work for both modes)

| Tool | What it does |
|------|-------------|
| `setup_domain` | Creates GoDaddy CNAME → `ghs.googlehosted.com`, adds TXT verification record, verifies with Google, creates Cloud Run domain mapping. |
| `check_ssl_status` | Checks DNS CNAME resolution + HTTPS reachability. SSL takes 15-30 min after domain setup. |

### GCS layout

```
gs://<project>_campaign-studio/
├── configs/<service>.json              standard signup mode metadata
├── custom-configs/<service>.json       custom-page mode metadata     (NEW v2.2.0)
├── assets/<service>/<file>             uploaded assets (either mode)
├── dist/<service>/<ts>.tar.gz          uploaded dist tarballs        (NEW v2.2.0)
└── builds/source/<svc>-<ts>.tar.gz     transient Cloud Build sources
```

Standard `configs/` and custom `custom-configs/` are strictly separate prefixes — `update_landing_page` cannot accidentally read a custom-page config and vice versa.

### Authentication

- **Claude → MCP:** No auth required (optional Bearer token via `MCP_AUTH_TOKEN` env var)
- **MCP → GCP:** Service account credentials via `GCP_SA_KEY` env var (base64-encoded JSON)
- **MCP → GoDaddy:** API key/secret via `GODADDY_KEY` / `GODADDY_SECRET` env vars
- **MCP → Beehiiv:** Bearer API key via `BEEHIIV_API_KEY` env var (HSR brand only). Set on Cloud Run via `gcloud run services update campaign-studio --region=europe-west1 --update-env-vars=BEEHIIV_API_KEY=<key>`. Never enters code, image, or repo. Used exclusively by the public `/api/subscribe-beehiiv` proxy.

### Service Account Permissions Required

- `roles/cloudbuild.builds.editor` — trigger builds
- `roles/run.admin` — deploy services + set IAM
- `roles/storage.objectAdmin` — read/write GCS
- `roles/siteVerification.admin` — verify domains
- **Owner** in Google Search Console for each domain (required for Cloud Run domain mapping)

### Deploying the MCP Server Itself

Use the deploy script — it builds with an immutable timestamped tag, deploys to Cloud Run, and runs the post-deploy smoke check. **Never use `:latest`** — Cloud Run pins revisions to digests and a mutable tag silently drifts (this caused a real prod/source mismatch — see TEST_REPORT.md gap #1).

```bash
./mcp-server/deploy.sh
```

After the script returns, also verify out-of-band before declaring it shipped:

```bash
curl -s -X POST https://campaign-studio-30219985459.europe-west1.run.app/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify","version":"0"}}}'
# Then call tools/list with the returned mcp-session-id and confirm new tools are present.
```

This is necessary because Claude Code's MCP client caches `tools/list` at session start — restart Claude Desktop / Claude Code sessions before testing new tools.

**Rollback** (one command — pinned tags make this trivial):

```bash
gcloud container images list-tags gcr.io/steven-warehouse-dev/campaign-studio --limit 10
gcloud run deploy campaign-studio --image=gcr.io/steven-warehouse-dev/campaign-studio:<previous-tag> --region=europe-west1
```

The new mode coexists with the old — even if a custom-page tool has a bug, standard `deploy_landing_page` campaigns continue working through both server versions.

### Running Tests

```bash
cd mcp-server
node test-apis.js all    # Tests: GCP auth, GCS, Cloud Build, Cloud Run, GoDaddy, DNS
```

---

## The Campaign Template

### What's Built In (no setup needed per campaign)

- **RudderStack** — page views, form events, click tracking → BigQuery
- **Meta Pixel** — PageView on load, Lead on form submit, CompleteRegistration on quiz complete
- **Klaviyo** — subscribe to list, profile updates, identification
- **A/B testing** — random variant assignment, cookie persistence, variant in all events
- **Cookie consent** — banner records preference but does NOT gate any analytics (data controller approved)
- **OG tags** — injected at build time by Vite plugin from campaign config

### Brand Presets

| Brand | Domain | Provider | Klaviyo ID / Beehiiv Pub | Pixel |
|-------|--------|----------|--------------------------|-------|
| DOAC (The Diary of a CEO) | thediary.com | klaviyo | WjQKGn | not set |
| WNTT (We Need To Talk) | needtotalkshow.com | klaviyo | SyEtVT | not set |
| HSR (Hot Smart Rich) | hsrowntheroom.com | **beehiiv** | pub_ea72d441-200a-486d-b0e2-34b65bc386b8 | not set |

HSR is the only brand using Beehiiv. All other brands use Klaviyo. The provider field on the brand preset (`src/brands/<key>.js`) is the source of truth — `deploy_landing_page` rejects mismatches between the brand and the Klaviyo/UTM args.

### Key Files

| File | Purpose |
|------|---------|
| `scripts/scaffold.sh` | Creates new campaign projects |
| `src/brands/*.js` | Brand presets (theme, Klaviyo, legal URLs) |
| `src/campaign.config.js` | Per-campaign TODO template |
| `src/consent.js` | Analytics SDK loaders (all unconditional) |
| `src/klaviyo.js` | Klaviyo Client API + phone normalization |
| `src/SignupForm.jsx` | Email/phone form |
| `src/quiz-templates/` | Quiz components (gate, questions, results, scoring) |
| `vite.config.js` | Build config + OG tag injection |
| `Dockerfile` | Multi-stage build (Node → nginx Alpine) |

---

## Outstanding Work: Domain Expansion

All 13 domains are already registered in `mcp-server/credentials/config.example.json`. The remaining work is:

### 1. Brand presets for new shows

Some domains represent shows/products that don't have brand presets yet. Each needs a `src/brands/<name>.js` with Klaviyo Company ID, theme (colours, fonts), logo assets, and legal URLs:

| Domain | Brand preset needed? |
|--------|---------------------|
| thediary.com | `doac.js` exists |
| thediaryofaceo.com | use `doac` |
| behindthediary.com | use `doac` |
| doaccircle.com | use `doac` |
| doacscreenings.com | use `doac` |
| unlockthelessons.com | use `doac` or new |
| the33rdlaw.com | use `doac` or new |
| justfckingdoit.com | use `doac` or new |
| needtotalkshow.com | `wntt.js` exists |
| hsrowntheroom.com | **new preset needed** |
| beginagainshow.com | **new preset needed** |
| the-line-show.com | **new preset needed** |
| flight-speakers.com | **new preset needed** (pending confirmation) |

### 2. Google Search Console verification

The GCP service account needs **Owner** permission in Search Console for every domain. Without this, `setup_domain` will create the CNAME but the Cloud Run domain mapping will fail with a permission error.

### 3. GoDaddy access

Confirm all 13 domains are managed in the same GoDaddy account that the API key has access to. If any are on a different registrar, domain setup won't work automatically for those.

### 4. Redeploy MCP server

After adding domains to the `DOMAINS_JSON` env var on Cloud Run, rebuild and deploy:
```bash
docker build -f mcp-server/Dockerfile -t gcr.io/steven-warehouse-dev/campaign-studio:latest .
docker push gcr.io/steven-warehouse-dev/campaign-studio:latest
# Then update the Cloud Run service with the new DOMAINS_JSON env var
```

### Future: Multi-domain per brand

The current architecture maps one key → one domain. With 13 domains, some brands (like DOAC) span multiple domains. The `setup_domain` tool takes a brand key and derives the domain. If a brand needs multiple domains, consider changing `setup_domain` to accept a `domain` parameter directly, with brand as optional context.

---

## Credentials & Access Needed

| What | Where to find it |
|------|-----------------|
| GCP service account key | Generate from GCP Console → IAM → Service Accounts → Keys (project: `steven-warehouse-dev`) |
| GoDaddy API key/secret | Manage at developer.godaddy.com. Entered during `setup.sh` or set as env vars on Cloud Run. |
| Klaviyo API keys | Per-brand. Found in Klaviyo → Settings → API Keys |
| RudderStack write key | `3BDjPVPbfZ0thaBZdJQl9KMQOp2` (shared, all brands) |
| RudderStack dataplane | `stevenllumrcor.dataplane.rudderstack.com` |
| Claude Desktop connector URL | `https://campaign-studio-30219985459.europe-west1.run.app/mcp` |

---

## How to Set Up From Scratch (New Machine)

For most people (marketers, anyone using the MCP, not developing it):

1. Install Node.js LTS from https://nodejs.org and Claude Code (in VS Code / Cursor) from https://claude.ai/code
2. Clone this repo
3. From the repo root: `./scripts/setup.sh` — installs template deps, writes `.mcp.json` pointing at the production MCP
4. Open the folder in VS Code / Cursor with Claude Code — the Campaign Studio MCP is auto-detected via `.mcp.json`
5. Ask Claude: "Can you see the Campaign Studio MCP tools?" to verify, then type `/new-campaign` to start building

For Claude Desktop specifically (alternative to Claude Code in VS Code):

- Settings → Connectors → add `https://campaign-studio-30219985459.europe-west1.run.app/mcp` as an HTTP MCP server. Then open this folder in Claude Desktop (Code mode).

For MCP server development (developing the MCP itself, not using it):

```bash
cd mcp-server
./setup.sh                                # interactive: SA path, GoDaddy creds, Claude Desktop config
node test-apis.js all                     # API smoke tests against real GCP/GoDaddy
node server.js                            # Run locally — see mcp-server/README.md
MCP_URL=http://localhost:8080/mcp node test-custom-deploy.mjs   # E2E test custom-page mode
```

---

## Known Limitations

- **No local preview in MCP flow** — the MCP deploys directly. Local preview requires the template repo + `npm run dev`.
- **No rollback for individual campaigns** — `update_*` overwrites config in GCS. No campaign-level version history. (MCP server itself rolls back fine via image tags.)
- **No draft/staging mode** — all deploys are immediately public.
- **Build tarballs accumulate** — `{GCP_PROJECT}_cloudbuild` bucket isn't cleaned up. Apply a 30-day lifecycle rule.
- **Custom-page mode dist tarballs** — same concern. Lifecycle rule on `gs://<project>_campaign-studio/dist/` recommended.
- **Container images linger after teardown** — both `teardown_*` tools delete the Cloud Run service + GCS state but leave container images in GCR (~$0.02/mo each). v2 work, see Deferred.
- **SSL provisioning takes 15-30 min** — users need to call `check_ssl_status` manually.
- **Custom-page `update_custom_page` deploys the LATEST upload, not the latest local code** — the MCP doesn't read local files. If a marketer edits code without re-running `npm run build` and re-uploading, nothing changes on the live site. Surfaced in `/new-campaign` copy.

---

## Deferred work

- ✅ **`teardown_landing_page` and `teardown_custom_page` MCP tools.** Both shipped in v2.2.0 (April 2026). Closes the orphan-resource gap from TEST_REPORT.md #6.
- **Container image cleanup in teardown tools.** v1 leaves images in GCR. Needs `roles/storage.admin` on the GCR bucket to delete manifests. v2 should add this.
- **`og:url` meta tag.** `OG_URL` is exported by `campaign.config.js` but the Vite template's `index.html` doesn't reference it, so the `ogUrl` arg added to `deploy_landing_page`/`update_landing_page` in v2.1.0 has no current effect. Most crawlers fall back to the canonical request URL, so non-blocking, but the meta tag should be added so the field actually does something. Same applies to the optional `ogUrl` on `deploy_custom_page` / `update_custom_page` — it's stored in custom-configs/ for reference but doesn't get baked into the dist (the marketer controls their own dist's HTML).
- **GCS lifecycle rules.** Apply 30-day delete to `dist/`, `builds/source/`, and possibly `assets/` for serviceNames that no longer have a config. Not done yet.

---

## What changed in v2.3.0 (April 2026)

Adds Beehiiv as a second subscriber provider, alongside the existing Klaviyo flow. Net-additive — existing Klaviyo brands (DOAC, WNTT, all 11 yet-to-be-presetted others) work unchanged.

**New tools:** none. v2.3.0 adds **schema fields** to existing tools rather than tools themselves.

**New schema fields** on `deploy_landing_page` + `update_landing_page`:
- `utmSource`, `utmMedium`, `utmCampaign` — required for HSR (Beehiiv); rejected for Klaviyo brands
- `formFields` — per-campaign form schema (replaces the historical hardcoded firstName + email + phone)

**New public HTTP endpoint** on the MCP server: `POST /api/subscribe-beehiiv`
- Browsers (campaign pages) call this. Server-side, holds `BEEHIIV_API_KEY`.
- CORS allow-list: `localhost`, `*.run.app`, all brand domains. 10kb body limit. 10/min/IP rate limit.
- Validates email + custom_fields shape, then forwards to Beehiiv with the system-managed `Acquisition Source` custom field carrying `${campaign_name} — ${variant}` for filtering.
- Best-effort follow-up call to `POST /publications/.../subscriptions/<id>/tags` to attach the same value as a real Beehiiv tag.

**New brand preset:** `src/brands/hsr.js` — minimal stub (provider config + `subscriber.phone: "off"` default; identity, theme, legal URLs are placeholders for the marketer to fill in when building HSR's first campaign).

**Repo additions:**
- `src/subscribe.js` — provider-agnostic dispatcher reading `BRAND.provider`
- `src/beehiiv.js` — client-side proxy fetch wrapper
- `mcp-server/test-beehiiv.mjs` — standalone Beehiiv API E2E test (creates real burner subscribers; manual cleanup via Beehiiv dashboard — DO NOT add automated DELETE calls, see auto-memory)

**Repo modifications:**
- `src/SignupForm.jsx` — refactored to render fields from `FORM_FIELDS`, dispatch via `subscribe()`
- `src/brands/doac.js`, `src/brands/wntt.js` — gained `provider: "klaviyo"` field (explicit, was implicit before)
- `src/campaign.config.js` — exports `BRAND`, `BRAND_KEY`, `UTM_SOURCE`/`MEDIUM`/`CAMPAIGN`, `FORM_FIELDS`
- `mcp-server/server.js` — proxy endpoint + rate limiter + brand×provider validation in `deploy_landing_page` + `KNOWN_BEEHIIV_FIELDS` constant + `SERVER_INSTRUCTIONS` provider-routing guidance
- `mcp-server/credentials/config.example.json` — `hsr` domain alias added alongside `hsrowntheroom`

**Architectural note — why a proxy:** Klaviyo's Client API is designed for browser use (write-only, no secret needed). Beehiiv requires a Bearer API key for every call. We MUST NOT put it in the static React bundle (anyone could extract it from DevTools), so all Beehiiv subscribe calls go through the MCP server's proxy endpoint. Same Cloud Run service, just one new Express route.

**Critical operational caveat — Beehiiv custom fields:** Beehiiv silently drops values for custom fields that don't already exist on the publication. The MCP keeps a `KNOWN_BEEHIIV_FIELDS` list (currently 25 fields confirmed on HSR's publication) and warns the marketer if a campaign's `formFields` references something outside that list. Update the `KNOWN_BEEHIIV_FIELDS` constant in `server.js` whenever HSR's admin adds new fields in the Beehiiv UI.

**Rolled out:**
- Server v2.3.0 deployed to Cloud Run as immutable tag `:20260429-110002` (revision `campaign-studio-00022-2jv`)
- `BEEHIIV_API_KEY` env var set on Cloud Run service (revision 00021 had it set first; 00022 inherits)
- Smoke check + out-of-band `tools/list` confirmed all new schema fields visible to fresh sessions
- Phase 0 burner-API validation passed (subscriber created, UTM round-trip, Acquisition Source carries tag, separate tags endpoint works, Phone Number coerces E.164 to integer)
- Local proxy + prod proxy round-trip tests both created real Beehiiv subscribers cleanly

---

## What changed in v2.2.0 (April 2026)

Five new MCP tools enabling deploy of pre-built static frontends alongside the existing scaffold-based signup flow. Existing tool schemas unchanged — net-additive release.

**New tools:** `upload_dist`, `deploy_custom_page`, `update_custom_page`, `teardown_custom_page`, `teardown_landing_page` (companion for the standard flow).

**Why:** Some campaigns don't fit the signup-page mould — Eventbrite ticket pages (Begin Again Coffee Rave was the trigger), brands without a preset, fully bespoke designs from external tools. Previously the only deploy path was the baked-in template, which doesn't read local files. The new mode accepts a pre-built `dist/` and deploys it as a static nginx site to the same Cloud Run / domain stack.

**Architecture decision:** ship the built `dist/`, not the source tree. Smaller payloads (<5MB typical), 30s build (no `npm ci`), no arbitrary code execution server-side. Detail in `MCP_CUSTOM_PAGE_PLAN.md` (root of repo, gitignored — local-only planning doc).

**Rolled out:**
- Server v2.2.0 deployed to Cloud Run as immutable tag `:20260427-162417` (revision `campaign-studio-00019-dkm`)
- Smoke check + `tools/list` out-of-band verification confirmed new tools live
- Integration test (`mcp-server/test-custom-deploy.mjs`) passed end-to-end against local MCP — full upload → deploy → verify → update → verify → teardown → verify-clean cycle
- README + `/new-campaign` slash command updated to branch on standard-vs-custom

**Gitignore now excludes** root-level `*.md` files (planning/test scratch docs) except `HANDOVER.md` and `README.md`, plus `.mcp.json` (may contain auth tokens). See `.gitignore`.

---

## Repo Sharing Checklist

Before sharing, ensure:

- [x] MCP server code lives in this repo (`mcp-server/`)
- [x] No `.env` files or actual credentials in the repo
- [x] `credentials/config.json` is in `.gitignore` (only `config.example.json` committed)
- [x] `config.example.json` has no API keys (blanked out)
- [x] All 13 domains pre-registered in config template
- [x] MCP README matches actual tools
- [ ] Service account JSON shared separately (not in repo)
- [ ] GoDaddy API keys shared separately (not in repo)
- [ ] Google Search Console Owner permission granted for all 13 domains
