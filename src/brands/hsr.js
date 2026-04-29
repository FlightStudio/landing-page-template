/**
 * Brand Preset: Hot Smart Rich (HSR) — STUB
 * ────────────────────────────────────────────────────────────────────
 * Wires up Beehiiv subscriber routing. Identity / theme / legal URLs
 * are placeholders — fill them in when building the first HSR campaign.
 *
 * HSR is the only brand using Beehiiv. The signup form routes through
 * the MCP server's /api/subscribe-beehiiv proxy so the API key never
 * enters the client bundle.
 */

export default {
  // ── Identity (TODO — marketer fills in) ──────────────────────────
  name: "Hot Smart Rich",
  shortName: "HSR",
  logo: "", // TODO — marketer adds the asset and sets the path

  // ── Subscriber provider — DON'T MODIFY ───────────────────────────
  provider: "beehiiv",
  beehiiv: {
    publicationId: "pub_ea72d441-200a-486d-b0e2-34b65bc386b8",
    proxyUrl: "https://campaign-studio-30219985459.europe-west1.run.app/api/subscribe-beehiiv",
  },

  // ── Form configuration — DON'T MODIFY without checking the form ──
  // Beehiiv has no first-class SMS subscription concept; phone field is hidden by default.
  // Marketers can override per-campaign via the formFields arg on deploy_landing_page.
  subscriber: {
    phone: "off", // "off" | "optional" | "required"
  },

  // ── Meta Pixel (TODO if needed) ──────────────────────────────────
  metaPixelId: "",

  // ── Legal — TODO, marketer fills in ──────────────────────────────
  privacyPolicyUrl: "",
  cookiePolicyUrl: "",
  termsUrl: "",

  // ── Theme — TODO, marketer fills in ──────────────────────────────
  // Mirror the structure of src/brands/doac.js or src/brands/wntt.js when ready.
  theme: {
    fonts: {},
    colors: {},
    radius: {},
  },
};
