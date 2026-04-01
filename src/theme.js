import { BRAND_THEME } from "./campaign.config";

/**
 * Inject brand theme as CSS custom properties on :root and load Google Fonts.
 * Call once on app boot (before first render).
 */
export function applyBrandTheme() {
  const { colors, fonts, radius } = BRAND_THEME;

  const vars = [];

  // Colors → --color-{name}
  for (const [name, value] of Object.entries(colors)) {
    vars.push(`--color-${name}: ${value}`);
  }

  // Fonts → --font-{name}
  for (const [name, value] of Object.entries(fonts)) {
    if (name === "googleFontsUrl") continue;
    vars.push(`--font-${name}: ${value}`);
  }

  // Radius → --radius-{name}
  for (const [name, value] of Object.entries(radius)) {
    vars.push(`--radius-${name === "DEFAULT" ? "DEFAULT" : name}: ${value}`);
  }

  // Inject as a <style> block so values override the @theme defaults
  const style = document.createElement("style");
  style.textContent = `:root { ${vars.join("; ")}; }`;
  document.head.appendChild(style);

  // Set body background + text to match theme
  document.body.style.backgroundColor = colors.surface;
  document.body.style.color = colors["on-background"];

  // Load Google Fonts
  if (fonts.googleFontsUrl) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = fonts.googleFontsUrl;
    document.head.appendChild(link);
  }
}
