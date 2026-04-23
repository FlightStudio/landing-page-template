#!/usr/bin/env bash
set -euo pipefail

# Campaign Studio — one-time setup for new team members
# Run from the repo root: ./scripts/setup.sh

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Campaign Studio Setup ==="
echo ""

# 1. Install npm dependencies
echo "1/3  Installing template dependencies..."
npm install --silent

echo "2/3  Installing MCP server dependencies..."
(cd mcp-server && npm install --silent)

# 2. Check for service account key
SA_DIR="$REPO_ROOT/mcp-server/credentials"
SA_FILE=$(find "$SA_DIR" -maxdepth 1 -name "steven-warehouse-dev*.json" 2>/dev/null | head -1)

if [ -z "$SA_FILE" ]; then
  echo ""
  echo "⚠  No service account key found in mcp-server/credentials/"
  echo "   Ask Matt to DM you the credentials file, then drop it in:"
  echo "   $SA_DIR/"
  echo "   and re-run this script."
  exit 1
fi

echo "   Found SA key: $(basename "$SA_FILE")"

# 3. Generate .mcp.json
SA_KEY_B64=$(base64 < "$SA_FILE" | tr -d '\n')

DOMAINS_JSON='{"doac":"thediary.com","wntt":"needtotalkshow.com","thediaryofaceo":"thediaryofaceo.com","behindthediary":"behindthediary.com","beginagain":"beginagainshow.com","doaccircle":"doaccircle.com","doacscreenings":"doacscreenings.com","unlockthelessons":"unlockthelessons.com","the33rdlaw":"the33rdlaw.com","justfckingdoit":"justfckingdoit.com","hsrowntheroom":"hsrowntheroom.com","theline":"the-line-show.com","flightspeakers":"flight-speakers.com"}'

cat > "$REPO_ROOT/.mcp.json" << MCPEOF
{
  "mcpServers": {
    "campaign-studio": {
      "type": "stdio",
      "command": "node",
      "args": [
        "mcp-server/server.js",
        "--stdio"
      ],
      "env": {
        "GCP_PROJECT": "steven-warehouse-dev",
        "GCP_REGION": "europe-west1",
        "GODADDY_KEY": "e4XpBpWvB6pU_RTuBBVsyFh1HsPpawk7GJ4",
        "GODADDY_SECRET": "SP1St6jMHVXydJPvhCQJ78",
        "GCS_BUCKET": "steven-warehouse-dev_campaign-studio",
        "DOMAINS_JSON": "$DOMAINS_JSON",
        "GCP_SA_KEY": "$SA_KEY_B64"
      }
    }
  }
}
MCPEOF

echo "3/3  Generated .mcp.json (gitignored)"
echo ""
echo "=== Done! ==="
echo "Open this folder in VS Code / Cursor with Claude Code and the MCP tools will be available."
echo "Run 'npm run dev' to preview landing pages locally."
