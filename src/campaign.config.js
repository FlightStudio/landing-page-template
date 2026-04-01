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
