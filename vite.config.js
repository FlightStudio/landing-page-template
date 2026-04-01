import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Reads campaign.config.js and brand preset via regex to extract
 * values for OG tags. Same extraction pattern as the MCP server's loadBrands.
 */
function extractConfigValues() {
  const configPath = resolve(__dirname, "src/campaign.config.js");
  let config;
  try {
    config = readFileSync(configPath, "utf-8");
  } catch {
    return null; // config not yet written (fresh scaffold)
  }

  const get = (pattern) => {
    const match = config.match(pattern);
    return match ? match[1] : "";
  };

  const pageTitle = get(/PAGE_TITLE\s*=\s*"([^"]+)"/);
  const ogDescription = get(/OG_DESCRIPTION\s*=\s*"([^"]+)"/);
  const ogImagePath = get(/OG_IMAGE_PATH\s*=\s*"([^"]+)"/);
  const ogUrl = get(/OG_URL\s*=\s*"([^"]+)"/);

  // Extract brand import to read brand name
  const brandFile = get(/from\s+"\.\/brands\/([^"]+)"/);
  let brandName = "";
  if (brandFile) {
    try {
      const brandContent = readFileSync(resolve(__dirname, "src/brands", `${brandFile}.js`), "utf-8");
      const brandMatch = brandContent.match(/name:\s*["']([^"']+)["']/);
      if (brandMatch) brandName = brandMatch[1];
    } catch { /* brand file not found */ }
  }

  return { pageTitle, ogDescription, ogImagePath, ogUrl, brandName };
}

function campaignMetaPlugin() {
  return {
    name: "campaign-meta",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const values = extractConfigValues();
        if (!values || !values.pageTitle) return html;

        const { pageTitle, ogDescription, ogImagePath, ogUrl, brandName } = values;
        const desc = ogDescription || `${pageTitle} — ${brandName}`;
        const image = ogImagePath || "/assets/og-image.jpg";
        // For OG image, use absolute URL if ogUrl is set, otherwise relative path
        const imageUrl = ogUrl ? `${ogUrl.replace(/\/$/, "")}${image}` : image;

        const metaTags = `<title>${pageTitle}</title>
    <meta name="description" content="${desc}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${pageTitle}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${imageUrl}" />
    ${ogUrl ? `<meta property="og:url" content="${ogUrl}" />` : ""}
    <meta property="og:site_name" content="${brandName}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${pageTitle}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${imageUrl}" />`;

        return html.replace(
          /<title>.*?<\/title>\s*.*?<!-- OG and Twitter tags injected at build time by campaignMeta plugin in vite\.config\.js -->/s,
          metaTags
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), campaignMetaPlugin()],
});
