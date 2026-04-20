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
│   ├── server.js                   #   MCP server (863 lines, 6 tools)
│   ├── Dockerfile                  #   Cloud Run container
│   ├── package.json                #   MCP dependencies
│   ├── setup.sh                    #   one-time setup script
│   ├── test-apis.js                #   integration test suite
│   ├── README.md                   #   MCP-specific docs
│   └── credentials/
│       └── config.example.json     #   config template (all 13 domains)
├── scripts/
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
│  Tools:                                                         │
│  • deploy_landing_page  → Cloud Build → Cloud Run               │
│  • update_landing_page  → Patch existing deployment             │
│  • upload_asset         → GCS storage                           │
│  • setup_domain         → GoDaddy + Google Verification         │
│  • check_ssl_status     → DNS + HTTPS check                    │
│  • list_brands          → Available brand presets               │
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

### Tools (6 total)

| Tool | What it does |
|------|-------------|
| `deploy_landing_page` | Generates campaign config → tarballs source → Cloud Build (Docker) → deploys to Cloud Run → sets public access → returns live URL. ~2 min end-to-end. |
| `update_landing_page` | Fetches stored config from GCS, merges changes, rebuilds and redeploys. Same URL, new revision. |
| `upload_asset` | Stores base64-encoded files (images, video) in GCS. Included in next deploy automatically. |
| `setup_domain` | Creates GoDaddy CNAME → `ghs.googlehosted.com`, adds TXT verification record, verifies with Google, creates Cloud Run domain mapping. |
| `check_ssl_status` | Checks DNS CNAME resolution + HTTPS reachability. SSL takes 15-30 min after domain setup. |
| `list_brands` | Returns available brand presets with Klaviyo IDs, domains, logos. |

### Authentication

- **Claude → MCP:** No auth required (optional Bearer token via `MCP_AUTH_TOKEN` env var)
- **MCP → GCP:** Service account credentials via `GCP_SA_KEY` env var (base64-encoded JSON)
- **MCP → GoDaddy:** API key/secret via `GODADDY_KEY` / `GODADDY_SECRET` env vars

### Service Account Permissions Required

- `roles/cloudbuild.builds.editor` — trigger builds
- `roles/run.admin` — deploy services + set IAM
- `roles/storage.objectAdmin` — read/write GCS
- `roles/siteVerification.admin` — verify domains
- **Owner** in Google Search Console for each domain (required for Cloud Run domain mapping)

### Deploying the MCP Server Itself

```bash
# From the repo root
docker build -f mcp-server/Dockerfile -t gcr.io/steven-warehouse-dev/campaign-studio:latest .
docker push gcr.io/steven-warehouse-dev/campaign-studio:latest

gcloud run deploy campaign-studio \
  --image gcr.io/steven-warehouse-dev/campaign-studio:latest \
  --platform managed \
  --region europe-west1 \
  --set-env-vars "GCP_PROJECT=steven-warehouse-dev,GCP_REGION=europe-west1,GCP_SA_KEY=<base64>,GODADDY_KEY=<key>,GODADDY_SECRET=<secret>,DOMAINS_JSON={...}" \
  --memory 512Mi \
  --allow-unauthenticated
```

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

| Brand | Domain | Klaviyo ID | Pixel |
|-------|--------|-----------|-------|
| DOAC (The Diary of a CEO) | thediary.com | WjQKGn | not set |
| WNTT (We Need To Talk) | needtotalkshow.com | SyEtVT | not set |

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

1. Install Node.js (LTS) and Claude Desktop
2. Clone this repo
3. In Claude Desktop → Settings → Connectors → add the MCP URL above
4. Open this folder in Claude Desktop (Code mode)
5. Type `/new-campaign` to start building

For MCP server development:
```bash
cd mcp-server
./setup.sh              # or manually: npm ci + copy config
node test-apis.js all   # Verify everything connects
node server.js          # Run locally
```

---

## Known Limitations

- **No local preview in MCP flow** — the MCP deploys directly. Local preview requires the template repo + `npm run dev`.
- **No rollback** — updating overwrites config in GCS. No version history.
- **No draft/staging mode** — all deploys are immediately public.
- **Build tarballs accumulate** — `{GCP_PROJECT}_cloudbuild` bucket isn't cleaned up.
- **SSL provisioning takes 15-30 min** — users need to call `check_ssl_status` manually.

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
