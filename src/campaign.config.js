/**
 * Campaign Configuration
 * ─────────────────────
 * TODO: Fill in the values below for your campaign.
 *
 * 1. Change the brand import to match your brand (doac, wntt, etc.)
 * 2. Fill in the campaign-specific values
 * 3. Add your media assets to public/assets/
 */

import brand from "./brands/doac"; // ← Change to your brand: "./brands/wntt", "./brands/hsr", etc.

// ── Re-export brand object + key (used by subscribe.js dispatcher) ──
export const BRAND = brand;
export const BRAND_KEY = "doac"; // ← match the import filename above

// ── Re-export brand values ───────────────────────────────────────────
export const KLAVIYO_COMPANY_ID = brand.klaviyoCompanyId || "";
export const BRAND_NAME = brand.name;
export const BRAND_SHORT = brand.shortName;
export const BRAND_LOGO = brand.logo;
export const PRIVACY_POLICY_URL = brand.privacyPolicyUrl;
export const COOKIE_POLICY_URL = brand.cookiePolicyUrl;
export const TERMS_URL = brand.termsUrl;
export const BRAND_THEME = brand.theme;
export const META_PIXEL_ID = brand.metaPixelId || "";

// ── Klaviyo (campaign-specific — only for Klaviyo brands, blank for HSR) ──
export const KLAVIYO_LIST_ID = "TODO";           // Create a new list in Klaviyo
export const CONSENT_SOURCE = "TODO";            // Format: YYYYMM_BrandCampaign

// ── Beehiiv (campaign-specific — only for HSR, blank for Klaviyo brands) ──
export const UTM_SOURCE = "";                    // e.g. "website"
export const UTM_MEDIUM = "";                    // e.g. "signup_landing"
export const UTM_CAMPAIGN = "";                  // e.g. "spring_push"

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
// Any number of descriptive names. 2, 3, 4+ all work — traffic splits evenly.
// Never use "a"/"b" — name them by what differs (e.g. "headline-long", "hero-video").
export const VARIANTS = ["variant-a", "variant-b"];

// ── Form Schema ──────────────────────────────────────────────────────
// Each entry: { key, label, type, required, klaviyo?, beehiiv? }
// - key:      internal field key (form state)
// - label:    user-visible label / placeholder
// - type:     "text" | "email" | "tel" | "number"
// - required: whether the form blocks submit until filled
// - klaviyo:  override the Klaviyo property name (defaults derived from key)
// - beehiiv:  override the Beehiiv custom_field name (must match an existing
//             custom field on the publication, or Beehiiv silently drops the value)
export const FORM_FIELDS = [
  { key: "firstName", label: "First name",       type: "text",  required: true,  klaviyo: "first_name",   beehiiv: "First Name" },
  { key: "email",     label: "Email address",    type: "email", required: true },
  { key: "phone",     label: "Phone (optional)", type: "tel",   required: false, klaviyo: "phone_number", beehiiv: "Phone Number" },
];

// ── Background Media ─────────────────────────────────────────────────
export const MEDIA = {
  video: "/assets/bg-video.mp4",
  imageWebp: "/assets/bg-image.webp",
  imageJpg: "/assets/bg-image.jpg",
};

// ── RudderStack (shared across all brands — DO NOT CHANGE) ───────────
export const RUDDERSTACK_WRITE_KEY = "3BDjPVPbfZ0thaBZdJQl9KMQOp2";
export const RUDDERSTACK_DATAPLANE_URL = "https://stevenllumrcor.dataplane.rudderstack.com";
