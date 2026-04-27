#!/usr/bin/env bash
# Build + deploy the Campaign Studio MCP server with an immutable tag, then smoke-check.
# Never use :latest — Cloud Run pins revisions to digests, and a mutable tag silently drifts.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

TAG="$(date +%Y%m%d-%H%M%S)"
IMAGE="gcr.io/steven-warehouse-dev/campaign-studio:$TAG"

echo "==> Building $IMAGE"
BUILD_CFG="$(mktemp)"
cat > "$BUILD_CFG" <<EOF
steps:
- name: gcr.io/cloud-builders/docker
  args: ['build','-f','mcp-server/Dockerfile','-t','$IMAGE','.']
images:
- '$IMAGE'
timeout: 900s
EOF
gcloud builds submit --config="$BUILD_CFG" .
rm -f "$BUILD_CFG"

echo "==> Deploying to Cloud Run"
gcloud run deploy campaign-studio --image="$IMAGE" --region=europe-west1 --quiet

echo "==> Running smoke check"
node "$REPO_ROOT/mcp-server/smoke-check.mjs"

echo "==> Deploy complete: $IMAGE"
