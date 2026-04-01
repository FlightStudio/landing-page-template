#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────
# Landing Page Scaffold Script
# Creates a new campaign project from the template.
#
# Usage:
#   ./scripts/scaffold.sh <project-name> [--type quiz]
#
# Examples:
#   ./scripts/scaffold.sh "WNTT Summer Campaign"
#   ./scripts/scaffold.sh "WNTT Love Island Quiz" --type quiz
# ─────────────────────────────────────────────────────────────────────

TEMPLATE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_NAME="${1:?Usage: scaffold.sh <project-name> [--type quiz]}"
TARGET_DIR="$(dirname "$TEMPLATE_DIR")/$PROJECT_NAME"
CAMPAIGN_TYPE="signup"

# Parse flags
shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --type) CAMPAIGN_TYPE="$2"; shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [ -d "$TARGET_DIR" ]; then
  echo "Error: $TARGET_DIR already exists"
  exit 1
fi

echo "Scaffolding new campaign: $PROJECT_NAME"
echo "  Type: $CAMPAIGN_TYPE"
echo "  From: $TEMPLATE_DIR"
echo "  To:   $TARGET_DIR"
echo ""

mkdir -p "$TARGET_DIR"

# ── Copy template files ──────────────────────────────────────────────
# Core config
cp "$TEMPLATE_DIR/package.json" "$TARGET_DIR/"
cp "$TEMPLATE_DIR/package-lock.json" "$TARGET_DIR/"
cp "$TEMPLATE_DIR/vite.config.js" "$TARGET_DIR/"
cp "$TEMPLATE_DIR/index.html" "$TARGET_DIR/"

# Deployment
cp "$TEMPLATE_DIR/Dockerfile" "$TARGET_DIR/"
cp "$TEMPLATE_DIR/nginx.conf" "$TARGET_DIR/"

# Source — shared files
mkdir -p "$TARGET_DIR/src"
cp -r "$TEMPLATE_DIR/src/brands" "$TARGET_DIR/src/brands"
cp "$TEMPLATE_DIR/src/consent.js" "$TARGET_DIR/src/consent.js"
cp "$TEMPLATE_DIR/src/klaviyo.js" "$TARGET_DIR/src/klaviyo.js"
cp "$TEMPLATE_DIR/src/theme.js" "$TARGET_DIR/src/theme.js"
cp "$TEMPLATE_DIR/src/index.css" "$TARGET_DIR/src/index.css"
cp "$TEMPLATE_DIR/src/CookieConsent.jsx" "$TARGET_DIR/src/CookieConsent.jsx"
cp "$TEMPLATE_DIR/src/VariantRedirect.jsx" "$TARGET_DIR/src/VariantRedirect.jsx"

if [ "$CAMPAIGN_TYPE" = "quiz" ]; then
  # Quiz-specific files
  cp "$TEMPLATE_DIR/src/quiz-templates/main.jsx" "$TARGET_DIR/src/main.jsx"
  cp "$TEMPLATE_DIR/src/quiz-templates/QuizPage.jsx" "$TARGET_DIR/src/QuizPage.jsx"
  cp "$TEMPLATE_DIR/src/quiz-templates/EmailGate.jsx" "$TARGET_DIR/src/EmailGate.jsx"
  cp "$TEMPLATE_DIR/src/quiz-templates/QuizQuestion.jsx" "$TARGET_DIR/src/QuizQuestion.jsx"
  cp "$TEMPLATE_DIR/src/quiz-templates/ResultsPage.jsx" "$TARGET_DIR/src/ResultsPage.jsx"
  cp "$TEMPLATE_DIR/src/quiz-templates/quizData.js" "$TARGET_DIR/src/quizData.js"
  cp "$TEMPLATE_DIR/src/quiz-templates/scoring.js" "$TARGET_DIR/src/scoring.js"
else
  # Signup-specific files
  cp "$TEMPLATE_DIR/src/main.jsx" "$TARGET_DIR/src/main.jsx"
  cp "$TEMPLATE_DIR/src/LandingPage.jsx" "$TARGET_DIR/src/LandingPage.jsx"
  cp "$TEMPLATE_DIR/src/SignupForm.jsx" "$TARGET_DIR/src/SignupForm.jsx"
fi

# Public assets directory (empty — campaign will add its own media)
mkdir -p "$TARGET_DIR/public/assets"

# Copy brand logos (all brands available)
for logo in "$TEMPLATE_DIR"/public/assets/doac-*.png "$TEMPLATE_DIR"/public/assets/doac-*.svg \
            "$TEMPLATE_DIR"/public/assets/wntt-*.png; do
  [ -f "$logo" ] && cp "$logo" "$TARGET_DIR/public/assets/"
done

# ── Create placeholder campaign config ───────────────────────────────
cat > "$TARGET_DIR/src/campaign.config.js" << 'CONFIGEOF'
/**
 * Campaign Configuration
 * ─────────────────────
 * TODO: Fill in the values below for your campaign.
 *
 * 1. Change the brand import to match your brand (doac, wntt, etc.)
 * 2. Fill in the campaign-specific values
 * 3. Add your media assets to public/assets/
 */

import brand from "./brands/doac"; // ← Change to your brand: "./brands/wntt", etc.

// ── Re-export brand values ───────────────────────────────────────────
export const KLAVIYO_COMPANY_ID = brand.klaviyoCompanyId;
export const BRAND_NAME = brand.name;
export const BRAND_SHORT = brand.shortName;
export const BRAND_LOGO = brand.logo;
export const PRIVACY_POLICY_URL = brand.privacyPolicyUrl;
export const COOKIE_POLICY_URL = brand.cookiePolicyUrl;
export const TERMS_URL = brand.termsUrl;
export const BRAND_THEME = brand.theme;
export const META_PIXEL_ID = brand.metaPixelId || "";

// ── Klaviyo (campaign-specific) ──────────────────────────────────────
export const KLAVIYO_LIST_ID = "TODO";           // Create a new list in Klaviyo
export const CONSENT_SOURCE = "TODO";            // Format: YYYYMM_BrandCampaign

// ── Campaign Identity ────────────────────────────────────────────────
export const CAMPAIGN_SLUG = "TODO";             // Used in RudderStack events + BQ filtering
export const CAMPAIGN_NAME = "TODO";             // Can differ from slug if needed
export const PAGE_TITLE = "TODO";                // Browser tab title

// ── OG Tags (injected by Vite plugin at build time) ─────────────────
export const OG_DESCRIPTION = "TODO";            // Social sharing description
export const OG_IMAGE_PATH = "/assets/og-image.jpg"; // 1200x630 jpg/png in public/assets/
export const OG_URL = "";                        // Set to live URL after deploy

// ── Page Content (for signup campaigns — quiz campaigns use quizData.js) ──
export const CONTENT = {
  label: "TODO",
  headline: "TODO",
  headlineAccent: "TODO",
  body: "TODO",
  postSubmitHeadline: "You're in!",
  postSubmitBody: "TODO",
  submitButton: "Sign Up",
};

// ── A/B Variants ─────────────────────────────────────────────────────
export const VARIANTS = ["variant-a", "variant-b"];

// ── Background Media ─────────────────────────────────────────────────
export const MEDIA = {
  video: "/assets/bg-video.mp4",
  imageWebp: "/assets/bg-image.webp",
  imageJpg: "/assets/bg-image.jpg",
};

// ── RudderStack (shared across all brands — DO NOT CHANGE) ───────────
export const RUDDERSTACK_WRITE_KEY = "3BDjPVPbfZ0thaBZdJQl9KMQOp2";
export const RUDDERSTACK_DATAPLANE_URL = "https://stevenllumrcor.dataplane.rudderstack.com";
CONFIGEOF

# ── Create .gitignore ────────────────────────────────────────────────
cat > "$TARGET_DIR/.gitignore" << 'EOF'
node_modules/
dist/
.DS_Store
EOF

# ── Check for Meta Pixel ────────────────────────────────────────────
echo "Checking brand presets for Meta Pixel..."
for brand_file in "$TARGET_DIR"/src/brands/*.js; do
  brand_name=$(basename "$brand_file" .js)
  if grep -q 'metaPixelId:\s*""' "$brand_file" 2>/dev/null; then
    echo "  ⚠  $brand_name: No Meta Pixel ID configured. Add it to src/brands/$brand_name.js when available."
  fi
done
echo ""

# ── Install dependencies ─────────────────────────────────────────────
echo "Installing dependencies..."
cd "$TARGET_DIR" && npm ci --silent

echo ""
echo "✓ Campaign scaffolded at: $TARGET_DIR"
echo "  Type: $CAMPAIGN_TYPE"
echo ""
echo "Next steps:"
echo "  1. cd \"$TARGET_DIR\""
echo "  2. Edit src/campaign.config.js (fill in TODOs)"
if [ "$CAMPAIGN_TYPE" = "quiz" ]; then
  echo "  3. Edit src/quizData.js (add your questions and results)"
  echo "  4. Edit src/scoring.js (customize scoring rules)"
fi
echo "  5. Add media assets to public/assets/"
echo "  6. npm run dev  (preview locally)"
echo "  7. When ready, use Campaign Studio MCP to deploy"
