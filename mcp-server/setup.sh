#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Campaign Studio MCP Server — Setup Script
# Run this once to configure the MCP server for your machine.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_EXAMPLE="$SCRIPT_DIR/credentials/config.example.json"
CONFIG_FILE="$SCRIPT_DIR/credentials/config.json"
CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

echo "Campaign Studio MCP Server — Setup"
echo "==================================="
echo ""

# ── Check prerequisites ─────────────────────────────────────────────────────

echo "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  echo "Error: Node.js is not installed. Install Node.js 18+ from https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error: Node.js $(node -v) found, but 18+ is required."
  exit 1
fi
echo "  Node.js $(node -v) OK"
echo ""

# ── Install dependencies ────────────────────────────────────────────────────

echo "Installing dependencies..."
cd "$SCRIPT_DIR" && npm ci --silent
echo "  Dependencies installed."
echo ""

# ── Configure credentials ───────────────────────────────────────────────────

if [ -f "$CONFIG_FILE" ]; then
  echo "Config file already exists at: $CONFIG_FILE"
  read -p "Overwrite? (y/N): " OVERWRITE
  if [ "$OVERWRITE" != "y" ] && [ "$OVERWRITE" != "Y" ]; then
    echo "Keeping existing config."
    SKIP_CONFIG=true
  else
    SKIP_CONFIG=false
  fi
else
  SKIP_CONFIG=false
fi

if [ "$SKIP_CONFIG" = false ]; then
  echo "Path to the GCP service account JSON key file (steven-warehouse-dev)."
  echo "  (Ask Ziga for this file if you don't have it.)"
  read -p "  Service account path: " SA_PATH

  if [ -n "$SA_PATH" ] && [ ! -f "$SA_PATH" ]; then
    echo "  Warning: File not found: $SA_PATH"
    read -p "  Continue anyway? (y/N): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
      exit 1
    fi
  fi

  echo ""
  echo "GoDaddy API credentials (for domain setup)."
  echo "  Find these at https://developer.godaddy.com/keys"
  read -p "  GoDaddy API key: " GD_KEY
  read -p "  GoDaddy API secret: " GD_SECRET

  mkdir -p "$SCRIPT_DIR/credentials"
  node --input-type=module -e "
    import { readFileSync, writeFileSync } from 'fs';
    const config = JSON.parse(readFileSync('$CONFIG_EXAMPLE', 'utf-8'));
    config.gcp.serviceAccountPath = '$SA_PATH';
    config.godaddy = { key: '$GD_KEY', secret: '$GD_SECRET' };
    writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2) + '\n');
    console.log('  Config written to: $CONFIG_FILE');
  "
fi

echo ""

# ── Configure Claude Desktop ────────────────────────────────────────────────

echo "Configuring Claude Desktop..."

SERVER_PATH="$SCRIPT_DIR/server.js"

if [ -d "$CLAUDE_CONFIG_DIR" ]; then
  if [ -f "$CLAUDE_CONFIG" ]; then
    if grep -q "landing-pages" "$CLAUDE_CONFIG" 2>/dev/null; then
      echo "  Claude Desktop already has 'landing-pages' configured."
    else
      node --input-type=module -e "
        import { readFileSync, writeFileSync } from 'fs';
        const config = JSON.parse(readFileSync('$CLAUDE_CONFIG', 'utf-8'));
        if (!config.mcpServers) config.mcpServers = {};
        config.mcpServers['landing-pages'] = {
          command: 'node',
          args: ['$SERVER_PATH']
        };
        writeFileSync('$CLAUDE_CONFIG', JSON.stringify(config, null, 2) + '\n');
        console.log('  Added landing-pages to Claude Desktop config.');
      "
    fi
  else
    mkdir -p "$CLAUDE_CONFIG_DIR"
    node --input-type=module -e "
      import { writeFileSync } from 'fs';
      const config = {
        mcpServers: {
          'landing-pages': {
            command: 'node',
            args: ['$SERVER_PATH']
          }
        }
      };
      writeFileSync('$CLAUDE_CONFIG', JSON.stringify(config, null, 2) + '\n');
      console.log('  Created Claude Desktop config with landing-pages.');
    "
  fi
else
  echo "  Claude Desktop config directory not found."
  echo "  You can also connect via remote MCP instead (see README.md)."
  echo ""
  echo "  To configure manually, add this to Claude Desktop config:"
  echo "  {\"mcpServers\":{\"landing-pages\":{\"command\":\"node\",\"args\":[\"$SERVER_PATH\"]}}}"
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "==================================="
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Restart Claude Desktop (if running)"
echo "  2. Open the landing-page-template folder in Claude Desktop"
echo "  3. Type /new-campaign to get started"
echo ""
echo "To verify API connections: node test-apis.js all"
