/**
 * Brand Preset: The Diary of a CEO (DOAC)
 * ────────────────────────────────────────
 * Shared across all DOAC campaigns. Campaign-specific values
 * (list ID, slug, content, media, variants) go in campaign.config.js.
 *
 * Brand guidelines: Inter font family, black/white primary, red accent.
 */

export default {
  // ── Identity ─────────────────────────────────────────────────────
  name: "The Diary of a CEO",
  shortName: "DOAC",
  logo: "/assets/doac-logo-white.png",

  // ── Subscriber provider ──────────────────────────────────────────
  provider: "klaviyo",

  // ── Klaviyo ──────────────────────────────────────────────────────
  klaviyoCompanyId: "WjQKGn",

  // ── Meta Pixel ─────────────────────────────────────────────────
  metaPixelId: "",  // Find in Meta Events Manager → Data Sources → Pixel ID

  // ── Legal ────────────────────────────────────────────────────────
  privacyPolicyUrl: "https://www.flightstory.com/privacy-policy",
  cookiePolicyUrl: "https://www.flightstory.com/privacy-policy",
  termsUrl: "https://thediary.com/pages/terms-conditions",

  // ── Theme ────────────────────────────────────────────────────────
  theme: {
    fonts: {
      headline: '"Inter", sans-serif',
      body: '"Inter", sans-serif',
      label: '"Inter", sans-serif',
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap",
    },
    colors: {
      // Surfaces — black foundation
      surface: "#0e0e0e",
      "surface-dim": "#0e0e0e",
      "surface-bright": "#2c2c2c",
      "surface-container-lowest": "#000000",
      "surface-container-low": "#131313",
      "surface-container": "#191a1a",
      "surface-container-high": "#1f2020",
      "surface-container-highest": "#252626",
      "surface-variant": "#252626",
      "surface-tint": "#c6c6c7",
      background: "#0e0e0e",
      "on-background": "#e7e5e4",
      "on-surface": "#e7e5e4",
      "on-surface-variant": "#acabaa",
      "inverse-surface": "#fcf8f8",
      "inverse-on-surface": "#565554",
      "inverse-primary": "#5e5f60",
      // Primary — white/light grey (brand is black & white)
      primary: "#c6c6c7",
      "primary-dim": "#b8b9b9",
      "primary-container": "#454747",
      "primary-fixed": "#e2e2e2",
      "primary-fixed-dim": "#d4d4d4",
      "on-primary": "#3f4041",
      "on-primary-container": "#d0d0d0",
      "on-primary-fixed": "#3e4040",
      "on-primary-fixed-variant": "#5a5c5c",
      // Secondary — neutral grey
      secondary: "#9f9d9d",
      "secondary-dim": "#9f9d9d",
      "secondary-container": "#3b3b3b",
      "secondary-fixed": "#e4e2e1",
      "secondary-fixed-dim": "#d6d4d3",
      "on-secondary": "#202020",
      "on-secondary-container": "#c1bfbe",
      "on-secondary-fixed": "#3f3f3f",
      "on-secondary-fixed-variant": "#5c5b5b",
      // Tertiary — DOAC red accent
      tertiary: "#ff0000",
      "tertiary-dim": "#cc0000",
      "tertiary-container": "#990000",
      "tertiary-fixed": "#ff3333",
      "tertiary-fixed-dim": "#cc0000",
      "on-tertiary": "#ffffff",
      "on-tertiary-container": "#ff6666",
      "on-tertiary-fixed": "#4d0000",
      "on-tertiary-fixed-variant": "#800000",
      // Error
      error: "#ee7d77",
      "error-dim": "#bb5551",
      "error-container": "#7f2927",
      "on-error": "#490106",
      "on-error-container": "#ff9993",
      // Outline
      outline: "#767575",
      "outline-variant": "#484848",
    },
    radius: {
      DEFAULT: "0px",
      lg: "0px",
      xl: "0px",
    },
  },
};
