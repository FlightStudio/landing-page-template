You are setting up a new landing page campaign. Read `.claude/commands/CAMPAIGN_LEARNINGS.md` for deeper context and rationale, and apply those learnings throughout this process.

Guide the user through these phases. Move through them naturally — don't number them or say "Phase 1". Just have a conversation.

## Pre-flight: Verify the FULL MCP toolset is connected (ALWAYS the first thing — never skip)

Before asking the marketer any campaign questions, **silently check that EVERY tool the campaign flow will need is available in this Claude Code session**. The pre-flight check exists to prevent the worst failure mode: marketer goes through the whole brief, you call `deploy_landing_page` two minutes later, and the tool isn't actually exposed by the MCP — they have to close VS Code, restart, and start the brief over.

`list_brands` working does NOT mean `deploy_landing_page` works. Partial-connection states are real (e.g. Claude Desktop connector loaded a stale subset of tools, MCP server was redeployed but the client hasn't refreshed, the marketer is on the http connector but only some tools registered). Check the entire inventory.

### How to check

Look at your tool inventory — these **11 tools must all be present** before you start the brief:

| Tool | Used in |
|---|---|
| `list_brands` | Phase 1 brand selection |
| `deploy_landing_page` | Phase 5 deploy (standard signup) |
| `update_landing_page` | Phase 5 iterate (standard signup) |
| `upload_asset` | Phase 3 image swap |
| `teardown_landing_page` | Phase 5 cleanup |
| `upload_dist` | Phase 5 deploy (custom-page / imported HTML) |
| `deploy_custom_page` | Phase 5 deploy (custom-page / imported HTML) |
| `update_custom_page` | Phase 5 iterate (custom-page / imported HTML) |
| `teardown_custom_page` | Phase 5 cleanup (custom-page / imported HTML) |
| `setup_domain` | Phase 5 custom domain |
| `check_ssl_status` | Phase 5 SSL verification |

To verify quickly: call `list_brands` once (it's read-only). If that works, also confirm the other 10 tool **names** are present in your tool inventory. Don't actually call the destructive ones — just check the names.

### If ANY tool is missing — STOP. Don't ask a single campaign question.

```
"Before we build anything, I need the Campaign Studio MCP fully connected — right
now I can see [list which tools you can see, e.g. 'list_brands but not
deploy_landing_page or upload_dist']. Without all of them the deploy step at the
end won't work, and we don't want to waste your time on a brief we can't ship.

To fix:
1. From the repo root, run: `./scripts/setup.sh`
2. If it complains about missing credentials, ask Ziga to DM you the service
   account JSON file and drop it in `mcp-server/credentials/`. Re-run setup.sh.
3. **Close and reopen VS Code completely.** (Claude Code caches the MCP tool
   list at session start. A reload-window isn't enough — full quit + relaunch.)
4. Reopen this folder, run `/new-campaign` again. I'll re-check the full inventory.

I won't ask any brief questions until all 11 tools are visible."
```

Run this check at the **start of every `/new-campaign` invocation**, even within the same session — schemas can refresh, and a single `list_brands` call plus inventory inspection is trivial cost vs. losing a marketer's brief.

### Recovery — if a tool fails MID-FLOW despite passing pre-flight

The pre-flight catches most cases, but tool availability can technically change during a long session (MCP server redeploy, network blip, client-side cache eviction). If you call a tool later and it fails with "tool not found", "transport closed", or similar transport-level error (not a tool-internal error like a bad arg or 4xx response):

1. **Don't retry blindly.** It won't recover within this session.
2. **Stash the marketer's context immediately.** Tell them:
   ```
   "The MCP just dropped one of the deploy tools — [tool name]. Don't worry,
   none of the brief is lost. Before I forget anything, here's everything
   you've told me so far so you can paste it back into a fresh session:

   [recap the brief: brand, provider, campaign name, content, variants,
    formFields, UTM/Klaviyo list, anything custom they asked for]

   Now: close VS Code completely, reopen, and run /new-campaign again.
   When I ask for the brief, paste that recap back. I'll pick up where we
   left off and re-run the failing step."
   ```
3. The recap is the recovery — the marketer doesn't need to re-explain anything.
4. After they restart, re-run pre-flight first. If it fails again, the underlying issue isn't transient — escalate to the developer who set up the MCP.

This recovery flow assumes the MCP was working when pre-flight ran but failed later. If pre-flight didn't actually pass and you skipped it, that's the bug — Phase 0 is mandatory.

## Phase 0: Template offer (ask before collecting the brief)

Before the brief, check for reusable templates.

1. List the contents of `templates/` in the template repo.
2. If there's at least one template folder, show the user the options with their `meta.json` descriptions:
   > "I can start this from scratch, or reuse one of these templates: **wntt-quiz-standard** (WNTT quiz layout, 4-result scoring). Want to start from a template?"
3. If they pick one, **skip to Phase 2 Build → Load-from-template path** and only ask for the campaign-specific fields (slug, Klaviyo list id, copy differences, domain).
4. If they say "start from scratch" or there are no templates, continue to Phase 1 normally.

Never block if templates are missing — just proceed.

## Phase 1: Brief

Collect the information you need. Group related questions — don't ask one at a time.

### Subscriber provider (ALWAYS the first question on signup campaigns)

Before brand selection, ASK: **"Are subscribers going to Klaviyo or Beehiiv (HSR)?"**

- **Klaviyo** — DOAC, WNTT, and almost every brand
- **Beehiiv** — HSR (Hot Smart Rich) only

Routing rules — flag and confirm if the answer doesn't match the brand:

| Provider answer | Brand they pick | Action |
|---|---|---|
| Klaviyo | DOAC, WNTT, etc. | Ask for the Klaviyo list ID. |
| Beehiiv | HSR | Ask for `utm_source`, `utm_medium`, `utm_campaign`. **Don't** ask for a Klaviyo list ID. |
| Klaviyo | HSR | **Mismatch** — say: "HSR uses Beehiiv, not Klaviyo. Want me to switch the provider to Beehiiv?" |
| Beehiiv | non-HSR | **Mismatch** — say: "Only HSR is wired for Beehiiv today. The other brands all use Klaviyo. Want HSR or Klaviyo?" |
| "Not sure" | any | Look up `brand.provider` in `src/brands/<key>.js` and tell them — don't make them guess. |

`deploy_landing_page` validates the brand × args combo and rejects mismatches with a clear error.

### Campaign Type (ask second — determines the build)
- "Is this a signup page, a quiz, a competition entry, or something else?"
- "Is there a spec document or brief I should work from?"

**Three deploy paths exist** — pick the right one based on the answer:

- **Standard signup / quiz** (any brand, signup form, A/B variants, Klaviyo or Beehiiv): use the scaffold + `deploy_landing_page`. This is the default — most campaigns. Both Klaviyo and Beehiiv brands run on this path.
- **Custom-coded design** (bespoke layout, Eventbrite checkout, marketer dropped a complete Vite/Next/React project from Lovable/v0/Figma): skip the scaffold entirely. Project must have a working `npm run build`. Deploy with `upload_dist` + `deploy_custom_page` (see Phase 5 → Custom design path). Phase 0 templates and Phase 2 scaffold do not apply on this branch.
- **Imported HTML** (marketer has a single `.html` file from Claude Artifacts, Cloth, Webflow export, an email designer, or hand-written by them): they don't have a build pipeline; they just have HTML. We adapt it to Flight Studio standards in-place and deploy as a static page. See Phase 5 → Imported HTML path.

If unsure, ask: "Is this a normal signup/quiz, a complete project you've built outside this folder, or a single HTML file you'd like us to ship as-is?"

### Brand & Basics
- Which brand? Check `src/brands/` for available presets (currently **doac**, **wntt**, **hsr** as a minimal stub).
- **If the brand has no preset yet**, don't block — gather the brand details conversationally and create a new `src/brands/<name>.js` alongside the existing ones. You'll need:
  - Brand name + short name
  - Logo (ask them to drop the image in chat, save under `public/assets/`)
  - Primary / accent / background colors (hex)
  - Fonts (Google Fonts family name is fine)
  - Subscriber provider (`klaviyo` for almost every new brand)
  - Klaviyo company ID (the 6-char public ID from their Klaviyo account settings) — only if Klaviyo
  - Privacy policy URL, cookie policy URL, terms URL
  - Meta Pixel ID (optional — leave empty string if they don't have one yet)
  - Root domain (e.g. `needtotalkshow.com`) — used by `setup_domain`
- Campaign name (human readable, e.g. "WNTT Love Island Quiz")
- **For Klaviyo brands** — What Klaviyo list should signups go to? If they don't know: "You can find it in Klaviyo > Audience > Lists & Segments — click the list and grab the short code from the URL."
- **For HSR (Beehiiv)** — Three short identifiers for `utm_source`, `utm_medium`, `utm_campaign`. These flow through to Beehiiv subscribers as UTM tracking. Examples: `utm_source: "website"`, `utm_medium: "signup_landing"`, `utm_campaign: "spring_push"`. The campaign+variant tag is auto-generated and stored on each subscriber's `Acquisition Source` custom field — no marketer input needed.

### Form Fields (signup campaigns)

The signup form is config-driven via the `formFields` arg on `deploy_landing_page`. Default schema if you don't pass anything: **firstName + email + phone**.

- ASK the marketer what fields they want. Common shapes:
  - "just email" → `[{ key: "email", label: "Email address", type: "email", required: true }]`
  - "name and email" → firstName + email
  - "name, email, phone" → the historical default
  - Anything else → custom fields, see HSR caveat below
- Email is always required. Always include it in the schema.
- For `tel` fields, the form auto-renders the dial-code selector and normalises to E.164 on submit.

**For HSR (Beehiiv) specifically — Beehiiv silently drops values for custom fields that don't already exist on the publication.** When a marketer asks for a non-default form field:

- These fields ALREADY EXIST on HSR's Beehiiv publication (snapshot 2026-04-29). SUGGEST these by name when a marketer asks for a related field — don't ask them to create one if a suitable existing field is available:
  - **Identity:** First Name, Last Name, Phone Number (Number type — see quirk below), Birthday (Date), Age
  - **Address:** Address Line 1, Address Line 2, State/Province, Zip Code, Postal/Zip Code
  - **Career:** Employer, Job Title, Stage of Career (List), LinkedIn Profile
  - **Source:** Acquisition Source (auto-set by us), Subscribed On
  - **Preferences (List):** Why You Follow Me, What do you want next?, Why Did You Upgrade?, Annual Subscription, Monthly Subscription Reason
  - **Other (Text):** What you want to see in content, Where should I go from here?, Interested in Venture Debt, Why Did You Upgrade Secondary
- When the marketer's request fits one of these, MAP IT — don't ask them to create a new one:
  - "their job role" → `Job Title`
  - "where they live" → `State/Province` or `Zip Code` or `Postal/Zip Code`
  - "their LinkedIn" → `LinkedIn Profile`
  - "what stage of career" → `Stage of Career` (List — values must match Beehiiv's pre-defined options)
  - "where they heard about us" → don't ask, `Acquisition Source` is auto-populated per campaign
- If no existing field fits, tell the marketer to create one in Beehiiv first:
  > "I'll add '\<Field\>' to the form. Please ask whoever runs HSR's Beehiiv account to add a custom field named exactly '\<Field\>' (Settings → Custom Fields) before you launch — otherwise Beehiiv will drop the value."
- **Phone Number quirk:** Beehiiv's Phone Number field is type `Number`. Submitted E.164 strings (`+447700900123`) are coerced to integer (`447700900123` — the `+` is stripped). Acceptable for v1; mention if a marketer cares about preserving the country-code prefix.
- **List-type fields:** values must match pre-defined options. Coordinate with the Beehiiv admin if using one.

### Page Content
For signup: headline, body copy, button text, post-submission message.
For quiz: what's the quiz about, how many questions, what are the result types?

### A/B Variants
- Ask: "How many variants do you want to test? (2, 3, 4… whichever is useful — traffic splits evenly.)"
- If they ask what a variant is: "It's a version of the page. Visitors get randomly assigned to one — we tag the signup with the variant name so you can see which version converts best. Common pattern is testing two headlines, but you can test as many as you want."
- Ask for a descriptive name per variant — never `a`/`b`. Examples: `headline-long` vs `headline-short`, `hero-video` vs `hero-photo` vs `hero-illustration`.
- Ask what differs per variant (headline text, CTA copy, background, etc).

**You figure out these technical fields yourself** (don't ask the user):
- Campaign slug (from the campaign name, lowercase hyphenated)
- Consent source (format: YYYYMM_BrandCampaign)
- Service name (same as slug)

## Phase 2: Build

Once you have everything:

### Blank-scaffold path

```bash
./scripts/scaffold.sh "<Campaign Name>"                 # signup
./scripts/scaffold.sh "<Campaign Name>" --type quiz     # quiz
```

Then:
1. Edit `src/campaign.config.js` — replace all TODOs with collected values. Change the brand import to the right preset. Meta Pixel ID comes from the brand preset automatically.
2. For quiz campaigns: edit `src/quizData.js` with questions, results, gate content, and `src/scoring.js` with scoring rules.
3. Add OG fields to config: `OG_DESCRIPTION` (social sharing text) and `OG_IMAGE_PATH`. Remind the user they'll need a 1200x630 OG image.

### Load-from-template path

If the user picked a template in Phase 0:

1. Run the blank scaffold first (same command as above) to get the base project structure.
2. Copy template files on top of the scaffold (template path is `<template-repo>/templates/<name>/`):
   - `templates/<name>/src/` → `<new-project>/src/` (overwrites modified components + `campaign.config.js`)
   - `templates/<name>/public/assets/` → `<new-project>/public/assets/`
3. **Run the template health check** (see section below). If it fails, stop and show the user what's wrong.
4. **Klaviyo list ID**: the template will have kept the list ID from the campaign it was saved from. Read the current `KLAVIYO_LIST_ID` out of `campaign.config.js` and ask:
   > "This template was saved with Klaviyo list `<id>`. Reuse the same list, or point this campaign at a different one?"
   If they want a different one, update the field; otherwise leave it.
5. Fill in the campaign-specific TODOs in `campaign.config.js` from the brief (slug, campaign name, page title, consent source, OG description, CONTENT copy).
6. For quizzes: ask whether they want to keep the template's questions/scoring or replace them.

### Template health check (runs before `npm run dev` on template loads)

Run these checks, in order. Abort and surface the issue if any fail:

**Blockers** (abort the load and surface the issue):

- [ ] Brand preset referenced in `campaign.config.js` exists in `src/brands/`. If missing, ask the user which brand to map to.
- [ ] `BRAND_LOGO` path resolves to a real file under `public/assets/` — the logo is shown on every page, a missing one will definitely break the UI.
- [ ] Quiz templates: `src/quizData.js` and `src/scoring.js` both exist.
- [ ] **No real secrets in template content**: grep every copied file for the patterns listed under the scrub rules in Phase 6. Klaviyo list ID / company ID are fine and expected. What must NEVER appear is a GoDaddy key/secret, a GCP service account JSON / private key, or an MCP auth token. If any match, delete the loaded template files and tell the user.

**Warnings** (mention to the user but don't abort — the page will likely work, or the marketer will add the missing asset later):

- [ ] `MEDIA.video`, `MEDIA.imageWebp`, `MEDIA.imageJpg` — these are scaffold-default placeholders. If the template's components don't actually render a video/image background, leaving them unresolved is harmless. Only flag if the page visibly expects a background. Say: "The template references a background video/image but the file isn't included — if you want one, drop it in chat now; otherwise the page uses the brand's default styling."
- [ ] `OG_IMAGE_PATH` — usually a placeholder that the marketer replaces with a campaign-specific 1200×630 image. Remind them to add one before deploy, but don't block.

### Start the preview automatically (both paths)

After config is filled in, you run the dev server yourself — the marketer never touches a terminal:

1. Start the dev server in the background:
   ```bash
   npm run dev &
   ```
2. Wait 2 seconds for Vite to boot, then open the browser:
   ```bash
   open http://localhost:5173
   ```
   (On Linux the command is `xdg-open`; on Windows WSL it's `explorer.exe`. Detect the platform.)
3. Keep the background dev server running through the entire iterate loop — every file edit hot-reloads in the already-open tab. Do not restart it unless Vite config changes.
4. Say: "Your page is open in the browser — take a look and tell me what you'd like to change."

### Analytics (no consent gating)
All scripts (RudderStack, Meta Pixel, Klaviyo) load unconditionally on page init via `initConsent()`. For form/quiz events:
```js
ensureRudderStackSDK();
window.rudderanalytics.ready(function () {
  window.rudderanalytics.track("Event Name", { ...props });
});
window.fbq?.("track", "Lead");
```
The cookie consent banner records preference only — does not gate any script loading or event firing.

## Phase 3: Iterate

Let the user request changes freely — edit files directly, hot reload shows changes instantly. No need to re-scaffold. This is where the creative work happens.

## Phase 4: Pre-deploy Checklist

Before deploying, run through these checks:

- [ ] A/B variants load correctly (test each `?variant=` value)
- [ ] RudderStack events fire in Network tab — page views on load, form/quiz events on interaction
- [ ] Meta Pixel fires (if configured): PageView on load, Lead/CompleteRegistration on interaction. If `metaPixelId` is empty in the brand preset, flag it: "No Meta Pixel configured for this brand."
- [ ] Klaviyo profile created with correct list + lowercase snake_case properties
- [ ] Variant property is namespaced: `${campaign_slug}_variant` (not just `variant`)
- [ ] Cookie consent banner appears and records preference; all analytics fire regardless of choice
- [ ] Email validation works
- [ ] Full user flow end-to-end (signup or quiz gate → quiz → results)
- [ ] OG tags present — check `<head>` has og:title, og:description, og:image (Vite plugin injects from campaign.config.js)
- [ ] Mobile responsiveness (375px viewport)
- [ ] Footer links (Terms, Privacy, Cookie Policy) all correct and external
- [ ] No placeholder text, no TODOs, no lorem ipsum
- [ ] Logo visible on all background contexts
- [ ] `npx vite build` succeeds without errors

## Phase 5: Deploy

Three paths. Pick the one matching the campaign type chosen in Phase 1.

### Standard signup path (DOAC / WNTT)

Use the **Campaign Studio MCP** tools (remote, on Cloud Run):

1. **Deploy**: Use `deploy_landing_page` with the campaign config values. This builds, deploys to Cloud Run, and returns a live URL (~2 min).
2. **Custom domain**: Use `setup_domain` to add a subdomain (e.g. `quiz.needtotalkshow.com`).
3. **SSL check**: Use `check_ssl_status` to verify SSL is provisioned (15-30 min after domain setup).
4. **Post-deploy updates**: If changes are needed after deploy, edit locally, preview, then use `update_landing_page` (or `deploy_landing_page` if it's a fresh service).
5. **When testing is over**: use `teardown_landing_page` (with `confirm: true`) to delete throwaway services so they don't accumulate.

After deploy, remind the user to:
- Test the live URL
- Check OG image renders (Facebook Sharing Debugger)
- Set `OG_URL` via `update_landing_page` once the final domain is known

### Custom design path

For bespoke campaigns where the marketer has a complete locally-built project (Vite, Next.js, plain static HTML — anything that produces a `dist/` or equivalent). The MCP doesn't read local files, so the marketer's build artefact must be uploaded explicitly.

1. **Build locally**: in the project directory, run `npm run build` (or whatever produces the static output). Confirm `dist/index.html` exists.
2. **Tar from inside dist** — important, the archive must have files at the root, not nested under a `dist/` folder:
   ```bash
   tar -czf - -C dist . | base64 > /tmp/dist.b64
   ```
3. **Upload**: call `upload_dist` with `serviceName` (e.g. `coffee-rave`) and the base64 contents.
4. **Deploy**: call `deploy_custom_page` with the same `serviceName` and a `pageTitle`. Returns a `*.run.app` URL in ~30s.
5. **Iterate**: when the marketer wants changes, edit code, run `npm run build` again, repeat steps 2–3, then `update_custom_page` (same serviceName, same URL, new revision).
6. **Custom domain**: `setup_domain` works identically here. Pass the same `serviceName`. Then `check_ssl_status` until it provisions.
7. **Teardown when done testing**: `teardown_custom_page` with `confirm: true` deletes the Cloud Run service, dist tarballs in GCS, the custom-config record, and any uploaded assets. Container images are intentionally left in GCR (~$0.02/month each — see [MCP_CUSTOM_PAGE_PLAN.md](MCP_CUSTOM_PAGE_PLAN.md) §10).

**Important caveats** for custom design path:
- `update_custom_page` deploys whatever is in the LATEST `upload_dist` call. If the marketer edits code but doesn't re-build and re-upload, nothing changes on the live site.
- Vite ships source maps by default. For sensitive code, set `build.sourcemap: false` in `vite.config.js` before building.
- Brand presets, Klaviyo wiring, and the Phase 6 save-as-template flow do NOT apply on this path.

### Imported HTML path

The marketer has a single `.html` file from somewhere else (Claude Artifacts, Cloth, Webflow export, ChatGPT, an email designer, hand-written). They want it shipped as a Flight Studio page on a real subdomain. The HTML almost certainly doesn't include analytics, signup integration, or brand-conformant assets — we adapt it in place, package it as a static dist, and deploy via `deploy_custom_page`.

**Step 1 — Get the HTML and any assets into the repo.**

Ask the marketer to drop their files in `imports/<campaign-slug>/` at the repo root. Convention:
```
imports/<campaign-slug>/
├── index.html        ← their HTML, renamed to index.html
├── *.png / *.jpg     ← any images the HTML references
└── *.css / *.js      ← any extracted style/script files
```
If they paste the HTML inline in chat instead, save it to `imports/<campaign-slug>/index.html` yourself. Same for asset URLs they share — download to that folder and update the HTML's `src=`/`href=` to local paths.

**Step 2a — ASK the marketer about brand visuals (non-negotiable question, ask before adapting).**

Flight Studio has ~13 brand domains but only 2 fully-presetted brands today (`doac`, `wntt`) — plus `hsr` as a stub. Most brands don't have a preset, so the imported-HTML flow can't assume one.

Before touching the HTML, ASK the marketer this single question:

> "Quick branding check — three options for how I style this page:
>
> 1. **Match an existing brand preset** — DOAC (black + red, Inter font) or WNTT (teal + blush + caramel, Figtree font). I'll inject that brand's fonts and colours over your HTML.
> 2. **Use your existing styling as-is** — I keep your fonts and colours exactly as the source HTML has them, and only add the Flight Studio plumbing (analytics, signup, OG tags). Pick this if your HTML already looks the way you want.
> 3. **Bring your own brand** — drop the logo file in `imports/<slug>/`, give me hex codes for primary / accent / background colours, and the Google Fonts family name(s) you want to use. I'll style the page with those. (For non-presetted brands like Behind The Diary, Begin Again, The 33rd Law, etc. — most of our IPs.)"

Wait for their answer. If option 3, also ask:
- "Do you want me to also create a permanent brand preset (`src/brands/<key>.js`) so future campaigns for this brand match these visuals automatically? Or is this a one-off — just style this campaign and skip the preset?"
- One-off is fine and faster. Permanent preset is cleaner if there'll be more campaigns for this brand.

**Step 2b — Adapt the HTML.**

Read the file. Identify what's in it: hero / form / CTA buttons / footer / scripts. Then make adaptations in two layers:

#### (i) ALWAYS inject — non-negotiable plumbing, same for every brand and every campaign

These are not optional and not asked about. They go in on every imported-HTML deploy:

- **Subscriber-provider signup integration** (only if the page has a form or is a signup page — the provider was decided at Phase 1):
   - For **Klaviyo** brands: replace any existing form with a small `<form>` whose submit handler POSTs to Klaviyo's Client API at `https://a.klaviyo.com/client/subscriptions/?company_id=<COMPANY_ID>`. Mirror the structure in `src/klaviyo.js` — `consent_source`, `landing_page`, `$source` (apex domain), `[<slug>_variant]`. Inline JS is fine here; this is a static HTML page.
   - For **HSR (Beehiiv)**: the form's submit POSTs to `https://campaign-studio-30219985459.europe-west1.run.app/api/subscribe-beehiiv` with `email` + UTM trio + `tags`. The proxy holds the API key — never embed Beehiiv keys in the HTML.
- **RudderStack analytics in `<head>`**: inline the SDK loader using `RUDDERSTACK_WRITE_KEY = "3BDjPVPbfZ0thaBZdJQl9KMQOp2"` and the dataplane URL `https://stevenllumrcor.dataplane.rudderstack.com`. **Same write key for every brand** — do not change.
- **Meta Pixel** (if the brand preset defines one): inline the standard pixel snippet using `metaPixelId`. Skip if the brand has no pixel — that's fine.
- **OG tags in `<head>`**: `og:title`, `og:description`, `og:image`, `og:url`, plus `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`. Build from the brief.
- **Mobile viewport**: confirm `<meta name="viewport" content="width=device-width, initial-scale=1.0">` exists. If their HTML uses fixed widths, add a small responsive override.
- **Cleanups**:
   - Strip third-party tracking the marketer's HTML brought along (Google Analytics, HubSpot, Hotjar, etc.) — ask before keeping any.
   - Strip references to localhost / `file://` URLs / their previous host.
   - Make all `src=`/`href=` either fully-qualified absolute URLs or relative-to-repo paths.

#### (ii) Brand visuals — only what the marketer chose in Step 2a

Apply ONE of the following based on their answer:

- **Option 1 — Match preset**: Inject the brand preset's `theme.fonts.googleFontsUrl` as a `<link>` in `<head>`. Override existing fonts in the HTML with the preset's headline / body / label fonts via inline `<style>`. Swap any colour values in the HTML to match the preset's `theme.colors` — don't be obsessive, focus on logo/CTA/headlines.
- **Option 2 — Keep their styling**: Don't touch fonts or colours. The marketer's HTML already looks the way they want.
- **Option 3 — Custom branding**: Drop the logo at `imports/<slug>/logo.png` (or whatever filename they sent — match what `<img src=>` in the HTML expects). Inject the Google Fonts URL for the family they specified. Apply the colour hex codes they gave to the relevant CSS — primary on CTA buttons, accent on links/highlights, background on body. If they also asked for a permanent preset, copy the values into a new `src/brands/<key>.js` mirroring the doac.js/wntt.js shape.

**Step 3 — Local preview** (sanity check before deploy):

```bash
cd imports/<campaign-slug>
npx serve .   # or `python3 -m http.server`
```

Open `http://localhost:3000` and click through. Submit the form — verify it actually posts to Klaviyo / the Beehiiv proxy.

**Step 4 — Package as a static dist + deploy** (uses the existing `deploy_custom_page` flow):

```bash
cd imports/<campaign-slug>
tar -czf - . | base64 > /tmp/imported-dist.b64
```

Then call `upload_dist` with `serviceName: "<campaign-slug>"` + the base64 contents, and `deploy_custom_page` with the same serviceName + `pageTitle`. Returns a `*.run.app` URL in ~30s.

**Step 5 — Iterate** as the marketer requests changes. Edit `imports/<campaign-slug>/index.html` directly, re-run the tar + upload + `update_custom_page` cycle. Same URL, new revision.

**Step 6 — Custom domain**: `setup_domain` works identically here.

**Step 7 — Teardown** when testing is done: `teardown_custom_page` with `confirm: true`.

**Important caveats** for the imported-HTML path:

- The page is fully self-contained static HTML. No React, no Vite. So features that depend on the React components (cookie consent banner, complex variant routing logic, the `FORM_FIELDS` schema) don't apply.
- A/B variants on imported HTML need different files (`index-headline-a.html`, `index-headline-b.html`) and either separate Cloud Run services or a tiny redirect script in `index.html`. Discuss with the marketer if they want A/B; if not, skip variants entirely on this path.
- The marketer's HTML often includes inline analytics from another platform (Google Analytics, HubSpot, Hotjar). Strip those by default; ask before keeping any third-party tracking that isn't in our standard stack.
- If their HTML is more than a single page (multiple `.html` files linked together), you can include all of them in `imports/<campaign-slug>/`; the static deploy serves them at their relative paths. Single-page is the common case.

## Phase 6: Offer to save as a template

Save-as-template can trigger at two natural moments — use whichever fits the conversation:

- **After the user is happy with the look** (end of Phase 3 iterate, before deploy). If they've said something like "yeah this looks great" or have stopped asking for changes, offer the save here. No need to wait for a live URL.
- **After deploy** (end of Phase 5). If Phase 6 didn't already happen pre-deploy, offer it now.

Never offer it twice. If they say no, don't ask again later.

The ask:

> "Want to save this setup as a reusable template? Next time someone builds a similar campaign they can start from this layout instead of from scratch."

If they say yes:

1. Ask for a short template name (lowercase hyphenated, e.g. `wntt-quiz-standard`) and a one-line description.
2. Create `<template-repo>/templates/<template-name>/` — path is relative to the **landing-page-template** repo, NOT the current campaign sibling directory.
3. Copy files into the template folder:
   - `src/` → `templates/<name>/src/` (entire dir — components, styles, brand imports, campaign.config.js, quizData.js, scoring.js if present)
   - `public/assets/` → `templates/<name>/public/assets/`
   - **Exclude these files/folders entirely** (never copy):
     - `node_modules/`, `dist/`, `.git/`, `package-lock.json`
     - Any `.env*` file (dotenv, never in a template)
     - Any `*.key`, `*.pem`, `sa-*.json`, `*-key*.json`, `credentials/` folder
4. **Scrub `templates/<name>/src/campaign.config.js`** — replace these campaign-specific identifiers with placeholders:

   | Field | Replace with | Why scrub |
   |-------|-------------|-----------|
   | `CONSENT_SOURCE` | `"TODO"` | Format is `YYYYMM_BrandCampaign` — always campaign-specific |
   | `CAMPAIGN_SLUG` | `"TODO"` | Must be unique per campaign (drives service name + BQ filter) |
   | `CAMPAIGN_NAME` | `"TODO"` | Campaign-specific |
   | `PAGE_TITLE` | `"TODO"` | Campaign-specific |
   | `OG_DESCRIPTION` | `"TODO"` | Campaign-specific copy |
   | `OG_URL` | `""` | Set after deploy, per-campaign |
   | `CONTENT` — all string fields | `"TODO"` | Campaign copy; preserve the object structure and field names |

   **KEEP in the template** (these are NOT scrubbed):
   - Brand import
   - `KLAVIYO_LIST_ID` — stays in the template; next user is asked whether to reuse or change it (see load path). Klaviyo IDs are low-risk to save: they route signups, not auth.
   - Klaviyo company ID (re-exported from brand preset, always OK)
   - `VARIANTS` array structure
   - `MEDIA` paths
   - RudderStack write key / dataplane URL (shared across all brands, not per-campaign)

5. **Hard-block scan for real secrets** — grep *every file* in the template folder for these patterns. If ANY match, delete the whole template folder and tell the user exactly which file + line matched. These must never ship in a template:

   | Pattern | What it catches |
   |---------|-----------------|
   | `-----BEGIN [A-Z ]*PRIVATE KEY-----` | PEM private keys (GCP SA keys, RSA keys) |
   | `"type"\s*:\s*"service_account"` | GCP service account JSON signature |
   | `GODADDY_KEY` or `GODADDY_SECRET` | GoDaddy API credentials |
   | `MCP_AUTH_TOKEN` | MCP server auth bearer |
   | `GCP_SA_KEY` | Base64 SA key env var |
   | `AIza[0-9A-Za-z_-]{35}` | Google API key shape |

   **This scan is the single most important safety check.** A Klaviyo list ID in a template is a convenience win. A GoDaddy secret or GCP SA key in a template is a company-wide security incident.

6. Write `templates/<name>/meta.json`:
   ```json
   {
     "name": "<template-name>",
     "description": "<one-line description from user>",
     "brand": "<brand key from the brand import, e.g. 'wntt'>",
     "type": "signup" | "quiz",
     "variantCount": <number>,
     "klaviyoListIdSaved": true | false,
     "createdAt": "<today's ISO date>",
     "basedOn": "<campaign slug this was saved from>"
   }
   ```

7. Tell the user exactly where it was saved:
   > "Saved to `<absolute path>/templates/<name>/`. To share it with a teammate, send them that whole folder and they can drop it into their own `templates/` directory. Next time anyone runs `/new-campaign` in this repo, this template will show up as an option."

## Important Notes
- Each campaign gets its own project directory (sibling to this template repo)
- Brand presets contain all shared values — don't duplicate them in campaign config
- RudderStack write key and dataplane URL are shared across ALL brands — never change these
- The campaign slug is how you filter this campaign's data in BigQuery
- Use `updateKlaviyoProfile()` (Client API) for critical data — `identifyKlaviyo()` only works after cookie consent
- Always use lowercase snake_case for all Klaviyo custom properties
- Use `${CAMPAIGN_SLUG}_variant` to namespace variant data per campaign
