/**
 * Brand Preset: We Need To Talk (WNTT)
 * ─────────────────────────────────────
 * Paul C. Brunson podcast — Flight Studio brand.
 * Warm, editorial aesthetic: teal, blush pink, caramel accents.
 *
 * Brand guidelines: Figtree font, Alternate Gothic Compressed for logo only.
 * Colour palette: #214050 (teal), #FFE7E6 (blush), #BD804A (caramel), #F8D2D1 (pink).
 */

export default {
  // ── Identity ─────────────────────────────────────────────────────
  name: "We Need To Talk",
  shortName: "WNTT",
  logo: "/assets/wntt-logo-pink.png", // Variants available: wntt-logo-teal/pink/black/white.png

  // ── Subscriber provider ──────────────────────────────────────────
  provider: "klaviyo",

  // ── Klaviyo ──────────────────────────────────────────────────────
  klaviyoCompanyId: "SyEtVT",

  // ── Meta Pixel ─────────────────────────────────────────────────
  metaPixelId: "",  // Find in Meta Events Manager → Data Sources → Pixel ID

  // ── Legal ────────────────────────────────────────────────────────
  privacyPolicyUrl: "https://needtotalkshow.com/privacypolicy",
  cookiePolicyUrl: "https://needtotalkshow.com/cookiepolicy",
  termsUrl: "https://needtotalkshow.com/terms",

  // ── Theme ────────────────────────────────────────────────────────
  theme: {
    fonts: {
      headline: '"Figtree", sans-serif',
      body: '"Figtree", sans-serif',
      label: '"Figtree", sans-serif',
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;800;900&display=swap",
    },
    colors: {
      // Surfaces — teal foundation (dark mode, WNTT editorial)
      surface: "#1a3640",
      "surface-dim": "#142c35",
      "surface-bright": "#2d5a68",
      "surface-container-lowest": "#0f232b",
      "surface-container-low": "#1a3640",
      "surface-container": "#1e3e4a",
      "surface-container-high": "#244854",
      "surface-container-highest": "#2a525e",
      "surface-variant": "#2a525e",
      "surface-tint": "#FFE7E6",
      background: "#1a3640",
      "on-background": "#FFE7E6",
      "on-surface": "#FFE7E6",
      "on-surface-variant": "#c4aaaa",
      "inverse-surface": "#FFE7E6",
      "inverse-on-surface": "#214050",
      "inverse-primary": "#214050",
      // Primary — blush/cream (light text on dark teal)
      primary: "#FFE7E6",
      "primary-dim": "#F8D2D1",
      "primary-container": "#3a5a65",
      "primary-fixed": "#FFE7E6",
      "primary-fixed-dim": "#F8D2D1",
      "on-primary": "#214050",
      "on-primary-container": "#F8D2D1",
      "on-primary-fixed": "#214050",
      "on-primary-fixed-variant": "#2d5a68",
      // Secondary — soft pink
      secondary: "#F8D2D1",
      "secondary-dim": "#e8bfbe",
      "secondary-container": "#3a5560",
      "secondary-fixed": "#F8D2D1",
      "secondary-fixed-dim": "#e8bfbe",
      "on-secondary": "#214050",
      "on-secondary-container": "#F8D2D1",
      "on-secondary-fixed": "#214050",
      "on-secondary-fixed-variant": "#2d5a68",
      // Tertiary — caramel/bronze accent
      tertiary: "#BD804A",
      "tertiary-dim": "#a06a3a",
      "tertiary-container": "#6b4422",
      "tertiary-fixed": "#d4975e",
      "tertiary-fixed-dim": "#BD804A",
      "on-tertiary": "#ffffff",
      "on-tertiary-container": "#d4975e",
      "on-tertiary-fixed": "#3d2510",
      "on-tertiary-fixed-variant": "#6b4422",
      // Error
      error: "#ee7d77",
      "error-dim": "#bb5551",
      "error-container": "#7f2927",
      "on-error": "#490106",
      "on-error-container": "#ff9993",
      // Outline
      outline: "#6b8a92",
      "outline-variant": "#3a5a65",
    },
    radius: {
      DEFAULT: "8px",
      lg: "12px",
      xl: "16px",
    },
  },
};
