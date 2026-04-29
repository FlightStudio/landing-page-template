import { subscribeToKlaviyo, identifyKlaviyo } from "./klaviyo";
import { subscribeToBeehiiv } from "./beehiiv";
import {
  BRAND,
  CAMPAIGN_NAME,
  UTM_SOURCE,
  UTM_MEDIUM,
  UTM_CAMPAIGN,
  FORM_FIELDS,
} from "./campaign.config";

/**
 * Dispatch a subscription to whichever provider the brand declares.
 *
 * @param {object} args
 * @param {string} args.email - Always required.
 * @param {string} args.variant - The A/B variant assigned to this visitor.
 * @param {object} args.values - Field key → value, matching FORM_FIELDS keys
 *   (excluding email). E.g. { firstName: "Bruce", phone: "+447…" }.
 * @returns {Promise<{ ok: boolean, status: number, error?: string }>}
 */
export async function subscribe({ email, variant, values = {} }) {
  const provider = BRAND?.provider || "klaviyo"; // default for back-compat with brands that pre-date this field

  if (provider === "klaviyo") {
    try {
      const res = await subscribeToKlaviyo({
        email,
        firstName: values.firstName,
        phone: values.phone,
        variant,
      });
      // identifyKlaviyo runs separately so a failure there (e.g. no cookie consent yet)
      // doesn't fail the form.
      try {
        identifyKlaviyo({
          email,
          firstName: values.firstName,
          phone: values.phone,
          variant,
        });
      } catch {}
      return { ok: res.ok, status: res.status };
    } catch (err) {
      return { ok: false, status: 0, error: err.message };
    }
  }

  if (provider === "beehiiv") {
    const tag = `${CAMPAIGN_NAME} — ${variant}`;
    const referringSite = window.location.origin + window.location.pathname;

    // Map every non-email value to a Beehiiv custom_field. The Beehiiv API name
    // comes from the field config (the marketer-facing label or explicit override);
    // fall back to the raw key if neither is set.
    const customFields = [];
    for (const field of FORM_FIELDS) {
      if (field.key === "email") continue;
      const value = values[field.key];
      if (value === undefined || value === null || value === "") continue;
      const beehiivName = field.beehiiv || field.label || field.key;
      customFields.push({ name: beehiivName, value });
    }

    try {
      const res = await subscribeToBeehiiv({
        email,
        utmSource: UTM_SOURCE,
        utmMedium: UTM_MEDIUM,
        utmCampaign: UTM_CAMPAIGN,
        referringSite,
        tags: [tag],
        customFields,
      });
      const body = res.ok ? null : await res.text().catch(() => null);
      return { ok: res.ok, status: res.status, error: body || undefined };
    } catch (err) {
      return { ok: false, status: 0, error: err.message };
    }
  }

  return {
    ok: false,
    status: 0,
    error: `Unknown subscriber provider: ${provider}`,
  };
}
