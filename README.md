# Campaign Template

Build, preview, and deploy landing pages and quizzes for Flight Studio brands. Powered by Claude Desktop (Code mode) and the Campaign Studio MCP server.

---

## Setup (one-time)

You need two things installed:

1. **Node.js** — [nodejs.org](https://nodejs.org) (pick the LTS version). Verify with `node --version`.
2. **Claude Code** — [claude.ai/code](https://claude.ai/code) (recommended: install as an extension in VS Code or Cursor).

Then:

```bash
# Clone the repo (ask Matt for the URL if you don't have it)
git clone https://github.com/FlightStudio/landing-page-template.git
cd landing-page-template

# One-time setup — installs deps + wires Claude Code at the production MCP
./scripts/setup.sh
```

Then open the folder in **VS Code / Cursor with Claude Code** (or in Claude Desktop's Code mode). The Campaign Studio MCP is auto-detected via the `.mcp.json` the setup script writes.

To verify everything's connected, ask Claude:

> "Can you see the Campaign Studio MCP tools?"

You should see **11 tools** in two flows:

- **Standard signup pages** (DOAC / WNTT): `list_brands`, `deploy_landing_page`, `update_landing_page`, `upload_asset`, `teardown_landing_page`.
- **Custom-coded pages** (bespoke designs, ticket pages, anything outside the signup template): `upload_dist`, `deploy_custom_page`, `update_custom_page`, `teardown_custom_page`.
- **Shared** (both modes use these): `setup_domain`, `check_ssl_status`.

**Credentials:** the production MCP runs on Cloud Run with its own service account, so you don't need GCP creds locally. If Matt sends you a credentials file (only needed if you're developing the MCP itself, not just using it), drop it in `mcp-server/credentials/` — the folder is gitignored.

### Alternative: Claude Desktop (instead of Claude Code)

If you'd rather use the Claude Desktop app:

1. Install from [claude.ai/download](https://claude.ai/download), sign in.
2. Settings (gear icon) → **Connectors** → **+** → fill in:
   - **Name**: `Campaign Studio`
   - **Remote MCP server URL**: `https://campaign-studio-30219985459.europe-west1.run.app/mcp`
   - Leave OAuth fields blank
3. Click **Add**, then open the `landing-page-template` folder as a project (File → Open Folder) and switch to the **Code** tab.

Both paths give you the same 11 tools. Pick whichever editor you're already using.

---

## Building a campaign

### Start a new campaign

1. Open the `landing-page-template` folder in Claude Desktop
2. Switch to the **Code** tab
3. Type `/new-campaign`
4. Follow the prompts — Claude will ask about:
   - **Campaign type** — signup page or quiz
   - **Brand** — pick an existing one or give Claude the details for a new one
   - **Content** — headline, body copy, button text
   - **Klaviyo list** — where signups go
   - **A/B variants** — how many versions you want to test, and what differs between them

### What it feels like

A real flow looks like this:

> **You:** I want to build a We Need To Talk Love Island quiz — picks your Islander match based on 5 questions.
>
> **Claude:** Happy to help. A few things to get started — what's the Klaviyo list ID for this one? How many result types should we have (e.g. 4 Islanders)? And anything different from the usual WNTT look, or stick with caramel-on-teal?
>
> **You:** List is `ABC123`. 4 Islanders. Standard look is fine. Here's the brief [pastes doc]. Oh, and I want two variants — one with "Find your match" and one with "Which Islander are you?".
>
> **Claude:** Got it. Scaffolding `wntt-love-island-quiz` with 2 variants: `match-headline` and `islander-headline`. I'll open the preview in your browser in a moment.
>
> *[Claude scaffolds, starts the dev server, opens localhost. You see the quiz on screen.]*
>
> **You:** The gate headline feels weak. Can you try something punchier? And swap the background to this image [drops image in chat].
>
> **Claude:** *[edits copy, uploads image, hot reload shows the new version]* Done — take a look.
>
> **You:** Nice. Let's ship it to `loveisland.needtotalkshow.com`.
>
> **Claude:** Deploying... *[~2 min]* Live at the Cloud Run URL. Setting up the subdomain now — SSL will take 15-30 min to provision, I'll let you know when it's ready.

Under the hood Claude will:

1. **Offer you a template** to start from if there's one saved that matches the brand / campaign type — or scaffold from scratch if you'd rather
2. **Scaffold** a new project directory with all the right files
3. **Fill in** your campaign config from the brief
4. **Start a local preview** (`npm run dev`) — opens in your browser with hot reload, without you touching a terminal
5. **Iterate** — ask for any changes ("make the headline bigger", "change the background colour", "swap the button text") and see them instantly
6. **Run a pre-deploy checklist** — analytics, Klaviyo, mobile, OG tags, etc.
7. **Deploy** via Campaign Studio MCP to a live URL on Cloud Run
8. **Set up a custom domain** if needed — e.g. `quiz.needtotalkshow.com` or `signup.thediary.com`
9. **Ask if you want to save this as a template** — for your team to reuse next time

### Campaign types

**Signup page** — email capture with headline, body copy, background media, A/B variant support. Good for competitions, waitlists, event signups.

**Quiz** — email gate followed by multiple-choice questions, scoring, and personalised results. Good for personality quizzes, recommendation engines, interactive content.

**Custom design** — anything bespoke that doesn't fit the signup-page mould (Eventbrite checkout, brand outside DOAC/WNTT, hand-coded layout, page exported from Lovable / v0 / Figma). Build the project locally with `npm run build`, then Claude uses `upload_dist` + `deploy_custom_page` to ship it to the same Cloud Run / domain stack as standard pages. No Klaviyo wiring, no scaffold. See [MCP_CUSTOM_PAGE_PLAN.md](MCP_CUSTOM_PAGE_PLAN.md) for the architecture.

### Subscriber providers (signup pages and quizzes)

Two paths, picked automatically based on the brand:

- **Klaviyo** (default — DOAC, WNTT, all brands except HSR). Pass a Klaviyo list ID at setup time. List/list properties / SMS / cookie-consent identify all work as before.
- **Beehiiv** (HSR only). Pass `utm_source`, `utm_medium`, `utm_campaign` at setup time. Subscribers are created via a server-side proxy on the MCP — the API key never enters the campaign bundle. Each subscriber is auto-tagged with `${campaign_name} — ${variant}` (stored as a Beehiiv tag and on the `Acquisition Source` custom field). Form fields beyond email are config-driven via the `formFields` arg.

When you start `/new-campaign`, Claude asks "Klaviyo or Beehiiv?" first. If the answer doesn't match the brand you pick, Claude flags the mismatch instead of guessing.

---

## Reusable templates

Built something you'd like to reuse? At the end of `/new-campaign` (after deploy), Claude asks:

> "Want to save this as a template?"

If you say yes, Claude saves your campaign's look & layout into [templates/](templates/) — **with every Klaviyo list ID, campaign slug, headline, and other campaign-specific value scrubbed out**. Next time anyone runs `/new-campaign` in this repo, Claude will offer your template as a starting point.

### Sharing a template

Templates are just folders inside `templates/`. Send the folder to a teammate however you like:
- **Via git** — commit `templates/<name>/` and push. Your team pulls and it appears in their template list.
- **One-off** — zip the folder, send it on Slack/email. They drop it in their own `templates/` directory.

Because templates never contain campaign-specific identifiers (no list IDs, no domains), sharing them is safe. Full details in [templates/README.md](templates/README.md).

---

## Available brands

Each brand has a preset in `src/brands/` that defines its Klaviyo account, legal URLs, fonts, colours, and logo.

| Brand | File | Fonts | Accent |
|-------|------|-------|--------|
| The Diary of a CEO | `src/brands/doac.js` | Inter | Red on black |
| We Need To Talk | `src/brands/wntt.js` | Figtree | Caramel on teal |

If the brand you need isn't listed, don't worry about creating the file — just tell Claude the brand you're building for during `/new-campaign`. It'll ask for the details it needs (logo, colours, fonts, Klaviyo company ID, legal URLs, root domain) and set up the preset for you.

---

## Project structure

```
landing-page-template/
├── .claude/commands/           # Claude skills
│   ├── new-campaign.md         #   /new-campaign conversation flow
│   └── CAMPAIGN_LEARNINGS.md   #   accumulated build learnings
├── mcp-server/                 # Campaign Studio MCP server
│   ├── server.js               #   MCP tools (11 — deploy, domain, SSL, custom-page)
│   ├── Dockerfile              #   Cloud Run container
│   ├── deploy.sh               #   immutable-tag deploy + smoke check
│   ├── setup.sh                #   developer-only setup (most users skip)
│   ├── templates/custom-page/  #   nginx files for deploy_custom_page builds
│   ├── test-apis.js            #   integration tests for standard flow
│   ├── test-custom-deploy.mjs  #   E2E test for custom-page mode
│   └── credentials/            #   GCP service account (gitignored, dev only)
├── scripts/
│   ├── setup.sh                # Top-level setup wrapper (run once after clone)
│   └── scaffold.sh             # Creates new campaign projects
├── templates/                  # Saved campaign templates (shareable folders)
├── src/
│   ├── brands/                 # Brand presets (DOAC, WNTT, etc.)
│   ├── quiz-templates/         # Quiz components (used by --type quiz)
│   ├── campaign.config.js      # Campaign-specific config (TODO template)
│   ├── main.jsx                # App entry (signup flow)
│   ├── LandingPage.jsx         # Signup page component
│   ├── SignupForm.jsx          # Form with Klaviyo integration
│   ├── VariantRedirect.jsx     # A/B variant router
│   ├── CookieConsent.jsx       # Cookie banner
│   ├── consent.js              # Analytics init (RudderStack, Meta Pixel, Klaviyo)
│   ├── klaviyo.js              # Klaviyo subscribe + profile update
│   └── theme.js                # Applies brand colours/fonts as CSS variables
├── public/assets/              # Brand logos + campaign media
├── index.html                  # HTML shell (OG tags injected at build)
├── vite.config.js              # Build config + OG tag plugin
├── Dockerfile                  # Production container (nginx)
├── HANDOVER.md                 # Technical handover document
└── package.json
```

---

## What's built in

Everything below is pre-wired. You don't need to set any of it up manually — just fill in `campaign.config.js` (or let `/new-campaign` do it for you).

### Analytics (fires automatically on page load)
- **RudderStack** — page views, form/quiz events, click tracking. Data flows to BigQuery.
- **Meta Pixel** — PageView on load, Lead on form submit, CompleteRegistration on quiz complete.
- **Klaviyo** — onsite JS for identification.

> Analytics load unconditionally — no consent gating. The cookie banner records user preference but doesn't block any tracking. This was approved by the data controller.

### Klaviyo integration
- **`subscribeToKlaviyo()`** — subscribes email to a list with campaign metadata (slug, variant, consent source).
- **`updateKlaviyoProfile()`** — writes properties (like quiz results) via the Client API. Works without cookie consent.
- **`identifyKlaviyo()`** — identifies the user via onsite JS. Only works after cookie consent.

### A/B variants
- Visitors are randomly assigned a variant and redirected (e.g. `/headline-long`).
- The variant is stored in a cookie and sent with every analytics event.
- Variant names should be descriptive ("headline-long" / "headline-short", not "a" / "b").

### OG tags
- Injected at build time by a Vite plugin from `campaign.config.js`.
- Includes `og:title`, `og:description`, `og:image`, `og:url` + Twitter equivalents.
- Test after deploy using Facebook Sharing Debugger.

---

## Deployment

Deployment is handled by the **Campaign Studio MCP** — Claude does this for you during the `/new-campaign` flow. You don't need to run any deploy commands manually.

There are two deploy modes, picked automatically based on your campaign type:

- **Standard signup** (`deploy_landing_page`) — Claude generates a `campaign.config.js` from your brief, packages the baked-in signup template, builds via Cloud Build (~2 min), and ships to Cloud Run.
- **Custom design** (`upload_dist` + `deploy_custom_page`) — Claude runs `npm run build` in your project, uploads the `dist/` to GCS, and the MCP wraps it in `nginx:alpine` and ships to Cloud Run (~30s, no `npm ci` step).

Either way you get back a live `*.run.app` URL, and `setup_domain` works the same on both.

### Custom domains

Claude can also set up a custom subdomain (e.g. `quiz.needtotalkshow.com`) using the MCP's domain tools. This creates the DNS record, verifies the domain with Google, and provisions SSL automatically (takes 15-30 min).

---

## Tips

- **Ask for changes in plain English** — "make the button say 'Enter Now'", "add a countdown timer", "change the background to a video". Claude edits the code and you see it instantly in the preview.
- **Check mobile** — resize your browser to 375px width, or use Chrome DevTools device mode.
- **OG images** — must be 1200x630px. Add to `public/assets/` and reference in config as `/assets/og-image.jpg`.
- **Meta Pixel** — if the brand doesn't have a Pixel ID yet, that's fine. Everything is wired up and will activate once the ID is added to the brand preset.
- **Multiple campaigns** — each campaign gets its own project directory. The template repo stays clean.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm run dev` fails | Run `npm install` (or re-run `./scripts/setup.sh`) |
| MCP tools not showing in Claude | (Claude Code) check `.mcp.json` exists at repo root and points at the prod MCP URL — re-run `./scripts/setup.sh` to recreate it. (Claude Desktop) check `claude_desktop_config.json` is valid JSON, restart the app. |
| Claude only sees the old 6 tools | Your client cached the schema at session start. Restart Claude Code / Claude Desktop and reopen the project. |
| Deploy says "no new revision" | Already fixed — image tags are timestamped |
| `update_custom_page` doesn't seem to apply my edits | Custom-page mode deploys whatever was in your last `upload_dist` call. Run `npm run build` again, then re-upload, then update. |
| Domain setup permission error | The GCP service account needs **Owner** permission in Google Search Console for the domain |
| 503 error after domain setup | Normal — SSL is still provisioning. Wait 15-30 min. |
| Cookie consent not appearing | Check `consent.js` is imported in `main.jsx` |
