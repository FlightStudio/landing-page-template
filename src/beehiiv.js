import { BRAND } from "./campaign.config";

/**
 * Subscribe an email to Beehiiv via the server-side proxy on the MCP server.
 * Beehiiv requires a Bearer API key — the proxy holds it server-side so the
 * client bundle never sees it.
 *
 * Custom field names must match an existing custom field on the Beehiiv
 * publication, otherwise Beehiiv silently drops the value. See
 * .claude/commands/CAMPAIGN_LEARNINGS.md §12 for the existing-field reference.
 */
export async function subscribeToBeehiiv({
  email,
  utmSource,
  utmMedium,
  utmCampaign,
  referringSite,
  tags,
  customFields, // optional [{ name: "First Name", value: "Bruce" }, …]
}) {
  const proxyUrl = BRAND?.beehiiv?.proxyUrl;
  if (!proxyUrl) {
    return new Response(
      JSON.stringify({ error: "No Beehiiv proxy configured for this brand" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      utm_source: utmSource || "",
      utm_medium: utmMedium || "",
      utm_campaign: utmCampaign || "",
      referring_site: referringSite || "",
      tags: Array.isArray(tags) ? tags : [],
      custom_fields: Array.isArray(customFields) ? customFields : [],
    }),
  });
}
