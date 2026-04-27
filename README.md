# Campaign Template

Build, preview, and deploy landing pages and quizzes for Flight Studio brands. Powered by Claude Desktop (Code mode) and the Campaign Studio MCP server.

---

## Setup (one-time)

### 1. Install Claude Desktop

Download and install from [claude.ai/download](https://claude.ai/download). Sign in with your Anthropic account. Open it once so it creates its config folder.

### 2. Install Node.js

Download from [nodejs.org](https://nodejs.org) (LTS version). Verify it's installed:
```bash
node --version
```

### 3. Clone this repo

```bash
git clone https://github.com/FlightStudio/landing-page-template.git
```

### 4. Add the Campaign Studio connector

This connects Claude to the deployment server so you can deploy, set up domains, and check SSL — all from within Claude.

1. Open Claude Desktop
2. Go to **Settings** (gear icon) > **Connectors**
3. Click the **+** button
4. Fill in:
   - **Name**: `Campaign Studio`
   - **Remote MCP server URL**: `https://campaign-studio-30219985459.europe-west1.run.app/mcp`
   - Leave OAuth fields blank
5. Click **Add**

You should see 6 tools appear: `deploy_landing_page`, `update_landing_page`, `upload_asset`, `setup_domain`, `check_ssl_status`, `list_brands`.

### 5. Verify it works

1. Open Claude Desktop
2. Open the `landing-page-template` folder as a project (File > Open Folder)
3. Switch to the **Code** tab
4. Type: "Can you see the Campaign Studio MCP tools?"
5. Claude should confirm it can see tools like `deploy_landing_page` and `setup_domain`

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
│   ├── server.js               #   MCP tools (deploy, domains, SSL)
│   ├── Dockerfile              #   Cloud Run container
│   ├── setup.sh                #   one-time setup
│   ├── test-apis.js            #   integration tests
│   └── credentials/            #   config (gitignored)
├── scripts/
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

Behind the scenes, it:
1. Builds the Vite app
2. Packages it in an nginx Docker container
3. Deploys to Google Cloud Run
4. Returns a live URL

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
| `npm run dev` fails | Run `npm install` first |
| MCP tools not showing in Claude | Check `claude_desktop_config.json` is valid JSON, restart Claude Desktop |
| Deploy says "no new revision" | Already fixed — image tags are timestamped |
| Domain setup permission error | The GCP service account needs **Owner** permission in Google Search Console for the domain |
| 503 error after domain setup | Normal — SSL is still provisioning. Wait 15-30 min. |
| Cookie consent not appearing | Check `consent.js` is imported in `main.jsx` |
