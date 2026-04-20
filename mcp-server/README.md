# Campaign Studio MCP Server

MCP server that lets you create, deploy, and manage Flight Studio landing page campaigns from Claude Desktop. No gcloud CLI, no Docker knowledge, no DNS panel needed — just Node.js.

## Quick Setup

```bash
cd mcp-server
./setup.sh
```

The script installs dependencies, prompts for the GCP service account key path, and configures Claude Desktop automatically. Restart Claude Desktop afterwards.

## Manual Setup

### 1. Install dependencies

```bash
cd mcp-server
npm ci
```

### 2. Configure credentials

```bash
cp credentials/config.example.json credentials/config.json
```

Edit `credentials/config.json`:
- `gcp.serviceAccountPath` — path to the GCP service account JSON key (ask Matt for this file)

The GCP project, region, and domains are pre-filled.

### 3. Connect to Claude Desktop

**Option A — Remote (recommended):**

Open Claude Desktop → Settings → Connectors → click **+**:
- Name: `Campaign Studio`
- URL: `https://campaign-studio-30219985459.europe-west1.run.app/mcp`
- Leave OAuth fields blank

**Option B — Local:**

Open Claude Desktop → Settings → Developer → Edit Config:

```json
{
  "mcpServers": {
    "landing-pages": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/server.js"]
    }
  }
}
```

Restart Claude Desktop.

## Tools

| Tool | What it does |
|------|-------------|
| `list_brands` | Shows brand presets with Klaviyo IDs, logos, domains |
| `deploy_landing_page` | Builds + deploys a new campaign to Cloud Run (~2 min) |
| `update_landing_page` | Updates an existing deployment (same URL, new revision) |
| `upload_asset` | Uploads images/media for use in next deploy |
| `setup_domain` | GoDaddy CNAME + Google verification + Cloud Run domain mapping |
| `check_ssl_status` | Checks if SSL is provisioned and site is reachable |

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

The server runs on Cloud Run. To redeploy after changes:

```bash
# From the repo root
docker build -f mcp-server/Dockerfile -t gcr.io/steven-warehouse-dev/campaign-studio:latest .
docker push gcr.io/steven-warehouse-dev/campaign-studio:latest

gcloud run deploy campaign-studio \
  --image gcr.io/steven-warehouse-dev/campaign-studio:latest \
  --platform managed \
  --region europe-west1 \
  --memory 512Mi \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT=steven-warehouse-dev,GCP_REGION=europe-west1,GODADDY_KEY=<key>,GODADDY_SECRET=<secret>,GCP_SA_KEY=<base64-encoded-sa-json>,DOMAINS_JSON=<json-string>"
```

## Troubleshooting

Run the integration test suite:

```bash
node test-apis.js all
```

Individual tests: `auth`, `gcs`, `build`, `cloudrun`, `godaddy`, `dns`.

## Prerequisites

- Node.js 18+
- GCP service account key for `steven-warehouse-dev`

That's it. No gcloud CLI, no Docker, no DNS tools needed for day-to-day use.
