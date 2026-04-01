#!/usr/bin/env bash
# Campaign analytics reporter — queries BigQuery for key metrics
# Usage: ./scripts/campaign-stats.sh [landing_page_slug]
# Example: ./scripts/campaign-stats.sh wntt-attachment-style

set -euo pipefail

SLUG="${1:-}"
PROJECT="steven-warehouse-dev"
DATASET="raw_landing_pages"

if [ -z "$SLUG" ]; then
  echo "Usage: $0 <landing_page_slug>"
  echo "Example: $0 wntt-attachment-style"
  echo ""
  echo "Known slugs:"
  bq query --project_id="$PROJECT" --use_legacy_sql=false --format=pretty \
    "SELECT DISTINCT landing_page FROM \`${DATASET}.pages\` WHERE landing_page IS NOT NULL ORDER BY landing_page"
  exit 1
fi

echo "============================================"
echo " Campaign Stats: ${SLUG}"
echo " $(date '+%Y-%m-%d %H:%M')"
echo "============================================"
echo ""

echo "--- 1. Unique Visitors ---"
bq query --project_id="$PROJECT" --use_legacy_sql=false --format=pretty "
SELECT
  COUNT(DISTINCT anonymous_id) AS unique_visitors
FROM \`${DATASET}.pages\`
WHERE landing_page = '${SLUG}'
"

echo "--- 2. Visitors by Variant ---"
bq query --project_id="$PROJECT" --use_legacy_sql=false --format=pretty "
SELECT
  variant,
  COUNT(DISTINCT anonymous_id) AS unique_visitors
FROM \`${DATASET}.pages\`
WHERE landing_page = '${SLUG}'
GROUP BY variant
ORDER BY unique_visitors DESC
"

echo "--- 3. Form Submissions by Variant ---"
bq query --project_id="$PROJECT" --use_legacy_sql=false --format=pretty "
SELECT
  variant,
  COUNT(*) AS submissions,
  COUNT(DISTINCT anonymous_id) AS unique_submitters
FROM \`${DATASET}.form_submitted\`
WHERE landing_page = '${SLUG}'
GROUP BY variant
ORDER BY submissions DESC
"

echo "--- 4. Conversion Rate (Visitors → Submitters) ---"
bq query --project_id="$PROJECT" --use_legacy_sql=false --format=pretty "
WITH views AS (
  SELECT variant, COUNT(DISTINCT anonymous_id) AS unique_visitors
  FROM \`${DATASET}.pages\`
  WHERE landing_page = '${SLUG}'
  GROUP BY variant
),
subs AS (
  SELECT variant, COUNT(DISTINCT anonymous_id) AS submitters
  FROM \`${DATASET}.form_submitted\`
  WHERE landing_page = '${SLUG}'
  GROUP BY variant
)
SELECT
  v.variant,
  v.unique_visitors,
  COALESCE(s.submitters, 0) AS submitters,
  ROUND(COALESCE(s.submitters, 0) / v.unique_visitors * 100, 1) AS conversion_pct
FROM views v
LEFT JOIN subs s ON v.variant = s.variant
ORDER BY conversion_pct DESC
"

echo "--- 5. Drop-off (Visited but Never Submitted) ---"
bq query --project_id="$PROJECT" --use_legacy_sql=false --format=pretty "
WITH visitors AS (
  SELECT DISTINCT anonymous_id, variant
  FROM \`${DATASET}.pages\`
  WHERE landing_page = '${SLUG}'
),
submitters AS (
  SELECT DISTINCT anonymous_id
  FROM \`${DATASET}.form_submitted\`
  WHERE landing_page = '${SLUG}'
)
SELECT
  v.variant,
  COUNT(*) AS total_visitors,
  COUNTIF(s.anonymous_id IS NULL) AS dropped_off,
  ROUND(COUNTIF(s.anonymous_id IS NULL) / COUNT(*) * 100, 1) AS dropoff_pct
FROM visitors v
LEFT JOIN submitters s ON v.anonymous_id = s.anonymous_id
GROUP BY v.variant
ORDER BY dropoff_pct DESC
"

echo "--- 6. Cookie Consent Breakdown ---"
bq query --project_id="$PROJECT" --use_legacy_sql=false --format=pretty "
SELECT
  action,
  COUNT(*) AS count
FROM \`${DATASET}.cookie_consent\`
WHERE landing_page = '${SLUG}'
GROUP BY action
"

echo "--- 7. Daily Trend (Last 14 Days) ---"
bq query --project_id="$PROJECT" --use_legacy_sql=false --format=pretty "
SELECT
  DATE(p.timestamp) AS day,
  COUNT(DISTINCT p.anonymous_id) AS visitors,
  COUNT(DISTINCT f.anonymous_id) AS submitters
FROM \`${DATASET}.pages\` p
LEFT JOIN \`${DATASET}.form_submitted\` f
  ON p.anonymous_id = f.anonymous_id
  AND DATE(p.timestamp) = DATE(f.timestamp)
WHERE p.landing_page = '${SLUG}'
  AND p.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)
GROUP BY day
ORDER BY day DESC
"

echo "============================================"
echo " Done"
echo "============================================"
