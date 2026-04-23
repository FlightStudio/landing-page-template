#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────
# Campaign Template — First-Time Setup
#
# Run this once after cloning the repo. It installs dependencies and
# creates the MCP config so Claude Code can deploy pages for you.
#
# Usage:
#   ./scripts/setup.sh
# ─────────────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo ""
echo "  Campaign Template Setup"
echo "  ───────────────────────"
echo ""

# ── 1. Install template dependencies (for local dev server) ─────────
echo "→ Installing template dependencies..."
npm install --silent
echo "  ✓ Template deps installed"

# ── 2. Install MCP server dependencies ──────────────────────────────
echo "→ Installing MCP server dependencies..."
(cd mcp-server && npm ci --silent)
echo "  ✓ MCP server deps installed"

# ── 3. Create .mcp.json if it doesn't exist ─────────────────────────
if [ -f ".mcp.json" ]; then
  echo "  ✓ .mcp.json already exists — skipping"
else
  echo "→ Creating .mcp.json..."

  # Find the SA key in the repo
  SA_KEY_FILE=$(ls "$REPO_ROOT/mcp-server/credentials/"steven-warehouse-dev*.json 2>/dev/null | head -1)

  if [ -z "$SA_KEY_FILE" ]; then
    echo ""
    echo "  ⚠ Could not find the GCP service account key in mcp-server/credentials/."
    echo "  Make sure you've pulled the latest from git."
    echo ""
    exit 1
  fi

  SA_KEY_B64=$(base64 -i "$SA_KEY_FILE" | tr -d '\n')

  python3 -c "
import json, sys

sa_key = sys.argv[1]

config = {
    'mcpServers': {
        'campaign-studio': {
            'type': 'stdio',
            'command': 'node',
            'args': ['mcp-server/server.js', '--stdio'],
            'env': {
                'GCP_PROJECT': 'steven-warehouse-dev',
                'GCP_REGION': 'europe-west1',
                'GODADDY_KEY': 'e4XpBpWvB6pU_RTuBBVsyFh1HsPpawk7GJ4',
                'GODADDY_SECRET': 'SP1St6jMHVXydJPvhCQJ78',
                'GCS_BUCKET': 'steven-warehouse-dev_campaign-studio',
                'DOMAINS_JSON': json.dumps({
                    'doac': 'thediary.com',
                    'wntt': 'needtotalkshow.com',
                    'thediaryofaceo': 'thediaryofaceo.com',
                    'behindthediary': 'behindthediary.com',
                    'beginagain': 'beginagainshow.com',
                    'doaccircle': 'doaccircle.com',
                    'doacscreenings': 'doacscreenings.com',
                    'unlockthelessons': 'unlockthelessons.com',
                    'the33rdlaw': 'the33rdlaw.com',
                    'justfckingdoit': 'justfckingdoit.com',
                    'hsrowntheroom': 'hsrowntheroom.com',
                    'theline': 'the-line-show.com',
                    'flightspeakers': 'flight-speakers.com'
                }),
                'GCP_SA_KEY': sa_key
            }
        }
    }
}

with open('.mcp.json', 'w') as f:
    json.dump(config, f, indent=2)
    f.write('\n')
" "$SA_KEY_B64"

  echo "  ✓ .mcp.json created"
fi

echo ""
echo "  Setup complete! Open this folder in Claude Code to get started."
echo ""
echo "  Local dev:  npm run dev"
echo "  Deploy:     Ask Claude to deploy using the MCP"
echo ""
