# Campaign Template

Build, preview, and deploy landing pages and quizzes for Flight Studio brands. Powered by Claude Desktop (Code mode) and the Campaign Studio MCP server.

---

## Setup (one-time) — from zero to ready in 9 steps

This walkthrough assumes you have a fresh laptop and have never installed any of this. **You won't need to use a terminal directly** — once Claude Code is running, you'll just tell it what to do in plain English. Allow ~15–20 minutes end to end.

After each step there's a **"What you should see"** check. If you don't see what's described, jump to the [Troubleshooting](#troubleshooting-setup) section at the bottom of this section.

---

### Step 1 — Install Node.js

1. Open your browser and go to **[nodejs.org](https://nodejs.org)**.
2. You'll see two big green buttons. Click the one labelled **"LTS"** (it's on the left, says "Recommended For Most Users").
3. The installer downloads (a `.pkg` file on Mac, a `.msi` on Windows). Open it once it's downloaded.
4. Click through the installer — accept the licence, click **Continue / Next / Install** at every prompt, enter your password if asked, then **Close** when it's done.

**What you should see:** the installer ends with a green checkmark or "Installation was successful" message. You don't need to verify anything in a terminal — just trust the installer.

---

### Step 2 — Install VS Code

(Skip if you already have VS Code. If you have Cursor instead, that also works — Cursor is a fork of VS Code and has Claude Code support too.)

1. Go to **[code.visualstudio.com](https://code.visualstudio.com)**.
2. Click the big blue **Download** button. The site auto-detects your OS (Mac / Windows / Linux).
3. Open the downloaded file. On Mac, drag the **Visual Studio Code** icon to your **Applications** folder. On Windows, run the installer.
4. Open VS Code. On first launch it'll ask about a colour theme and offer a tour — pick whatever, you can change later.

**What you should see:** VS Code opens to a Welcome tab with a list of "Start" actions on the left (New File, Open File, Clone Git Repository…). The left edge of the window has a vertical strip of icons (Files, Search, Source Control, Run, Extensions).

---

### Step 3 — Install the Claude Code extension and sign in

1. In VS Code, look at the vertical strip of icons on the **left edge of the window**. Click the one that looks like **four squares stacked together** (the Extensions icon). Or use the keyboard shortcut: **Cmd+Shift+X** (Mac) / **Ctrl+Shift+X** (Windows/Linux).
2. A search box appears at the top. Type **"Claude Code"**.
3. The first result should be **"Claude Code"** by **Anthropic** (the publisher must say Anthropic — not a copycat). Click the blue **Install** button next to it.
4. After install, VS Code will show a small notification asking you to **Reload Window** or **Restart**. Click it.
5. After reload, look at the vertical icon strip again — there's a new icon shaped like the **Claude logo** (asterisk-like). Click it.
6. The Claude panel opens. You'll see a **"Sign in to Claude"** button. Click it.
7. A browser window opens to **claude.ai**. Sign in with your **Anthropic account** (the same account you use for Claude.ai). After authenticating, you'll see "You can return to VS Code now" — close the browser tab and switch back to VS Code.

**What you should see:** the Claude panel in VS Code now shows a chat input box at the bottom and a welcome message. You're ready to talk to Claude.

---

### Step 4 — Get added to the GitHub repo (and clone it via Claude)

The repo is private to FlightStudio, so you need to be added as a collaborator first.

1. **Send Ziga your GitHub username. Accept the email invite.**
2. Back in VS Code, click the Claude icon in the left strip to open the Claude panel.
3. **Copy this prompt and paste it into Claude's chat box, then press Enter:**

   ```
   I'm setting up the Campaign Studio for the first time. Please clone
   https://github.com/FlightStudio/landing-page-template.git into my
   home folder, and once cloned, open the landing-page-template folder
   in this same VS Code window so we can keep working in it.
   ```
4. Claude will say something like "I'll run `git clone …` to do that — approve?" and show an **Approve** button. Click **Approve**. (Claude can run commands on your machine with your permission. Each new command shows a fresh approve prompt — that's intentional.)
5. After cloning, Claude opens the folder. VS Code may ask **"Do you trust the authors of the files in this folder?"** — click **Yes, I trust the authors**.

**What you should see:** the file tree in VS Code's left panel now shows folders like `mcp-server`, `src`, `scripts`, `templates`, plus files like `README.md` and `package.json`. The Claude panel says clone succeeded.

---

### Step 5 — Drop the credentials file in place

Ziga DMs you a `steven-warehouse-dev-4ba5a175d21c.json`. Save it to **Downloads**.

Tell Claude:

```
Ziga just sent me the credentials file. It's in my Downloads folder
and the filename starts with "steven-warehouse-dev-". Please move it
into the mcp-server/credentials/ folder of this repo.
```

Click **Approve** when Claude asks.

**What you should see:** Claude confirms the file is now at `mcp-server/credentials/steven-warehouse-dev-…json`. (The credentials folder is in `.gitignore` — the file never leaves your machine.)

---

### Step 6 — Run the one-time setup

This installs project dependencies and writes a configuration file that tells Claude Code about the Campaign Studio MCP.

Tell Claude:

```
Please run ./scripts/setup.sh from the repo root to do the one-time setup.
```

Claude will run the script and show you the output. It takes ~30 seconds. The script ends with a message like **"Generated .mcp.json"** and **"Done!"**.

**What you should see:** Claude's reply includes the line `Generated .mcp.json (gitignored)` near the end. If it complains about missing credentials, you skipped or mis-named Step 5 — fix that and re-run.

To double-check the file got written, ask Claude:

```
Confirm that .mcp.json exists at the repo root and tell me what server it's configured to use.
```

Claude should reply with a short summary saying yes the file exists and it's configured for `campaign-studio` via stdio transport.

---

### Step 7 — Restart VS Code so Claude Code picks up the new MCP

This is the step everybody forgets, and it's the #1 reason the MCP "isn't working" later.

1. **Quit VS Code completely** — `Cmd+Q` on Mac, or **File → Exit** on Windows. (Not just close the window — fully quit the app, otherwise the extension keeps using its old configuration.)
2. Reopen VS Code.
3. Use **File → Open Recent** and pick `landing-page-template`, OR **File → Open Folder** and navigate to where you cloned it.
4. Click the Claude icon in the left strip.

**What you should see:** when you reopen the folder, VS Code may show a notification at the bottom-right saying something like **"This workspace has MCP servers configured. Approve?"** — click **Approve** or **Trust**. If you don't see that popup, it might have appeared briefly and dismissed; not a problem, the next step verifies.

---

### Step 8 — Verify the MCP is connected and all 11 tools are available

In the Claude chat box, paste this prompt and send:

```
Check whether the Campaign Studio MCP is connected to this session.
List every MCP tool you can see by name and confirm there are exactly
11 tools total. Don't proceed with anything else until that's confirmed.
```

Claude should reply listing **11 tools by name**:

| # | Tool | What it does |
|---|------|--------------|
| 1 | `list_brands` | Show available brand presets |
| 2 | `deploy_landing_page` | Deploy a standard signup campaign |
| 3 | `update_landing_page` | Update an existing standard campaign |
| 4 | `upload_asset` | Upload images/media to a campaign |
| 5 | `teardown_landing_page` | Delete a standard campaign |
| 6 | `upload_dist` | Upload a built static site (custom-page mode) |
| 7 | `deploy_custom_page` | Deploy a custom-built page |
| 8 | `update_custom_page` | Update a custom-built page |
| 9 | `teardown_custom_page` | Delete a custom-built page |
| 10 | `setup_domain` | Wire a subdomain + SSL via GoDaddy + Cloud Run |
| 11 | `check_ssl_status` | Check whether a custom subdomain's SSL is live |

**What you should see:** Claude's reply lists all 11 tools by exact name and says something like "yes, all 11 tools are available, MCP is connected." If fewer than 11 appear, OR Claude says it can't see the MCP at all, jump to [Troubleshooting](#troubleshooting-setup) — **don't skip ahead**.

---

### Step 9 — Start your first campaign

You're set up. From now on, every time you want to build a landing page:

1. Open VS Code.
2. Open the `landing-page-template` folder (File → Open Recent).
3. Click the Claude icon, then in the chat box type:

   ```
   /new-campaign
   ```
4. Press Enter. Claude takes over from there — it'll ask what brand, what subscriber provider (Klaviyo or Beehiiv for HSR), what copy, what variants, and so on. Just answer in plain English.

The first thing `/new-campaign` does is automatically re-run the 11-tools check from Step 8 — so even if something has drifted between sessions, you'll know before you start writing the brief.

---

### <a id="troubleshooting-setup"></a>Troubleshooting (setup)

If something didn't match the "what you should see" check at any step:

| Symptom | What's likely wrong | Fix |
|---|---|---|
| Claude panel doesn't appear after installing the extension | Extension didn't fully load | Reload window: **Cmd+Shift+P** → type "Reload Window" → Enter |
| "Sign in to Claude" button keeps reopening the browser | Sign-in didn't stick | Close VS Code completely, reopen, click Sign in again. If still failing, restart your machine and try once more. |
| `git clone` failed with "Repository not found" or "Permission denied" | You're not yet a collaborator OR your VS Code isn't authenticated to GitHub | Confirm Ziga has added you and you accepted the email invite. Then in VS Code: **Cmd+Shift+P** → "GitHub: Sign in" → authenticate. |
| `setup.sh` exits with "No service account key found" | The credentials file from Step 5 isn't where Claude expects it | Make sure the file's exact path is `mcp-server/credentials/steven-warehouse-dev-XXXXX.json` (any filename starting with `steven-warehouse-dev` and ending `.json` works). Then ask Claude to re-run setup.sh. |
| Step 8 shows fewer than 11 tools | VS Code wasn't fully quit between Step 6 and Step 7 | Quit VS Code completely (`Cmd+Q`, not just close window), reopen, repeat Step 8. |
| Step 8 shows zero tools / "MCP not connected" | `.mcp.json` wasn't generated, or Claude Code didn't see it | Tell Claude: `Check that .mcp.json exists at the repo root. If it doesn't, re-run ./scripts/setup.sh and tell me why it failed.` |
| The MCP approval popup didn't appear when you opened the folder | Sometimes the popup dismisses too fast or the workspace has been opened before | In VS Code: **Cmd+Shift+P** → "Claude Code: Manage MCP servers" → ensure Campaign Studio is listed and **enabled**. |
| `/new-campaign` slash command isn't recognised by Claude | Old version of the repo, or Claude Code missed the slash-commands folder | Tell Claude: `Run git pull origin main from the repo root.` Then close & reopen VS Code. Then try `/new-campaign` again. |

If none of those fix it, paste this into the Claude chat:

```
Setup is broken at step <N>. <Describe what you see — copy exact error
text or screenshot it.> Please diagnose the issue, suggest the fix,
and walk me through it step by step.
```

Claude will read the repo's diagnostics and walk you through. If it hits something it can't resolve, ping Ziga.

---

### Alternative: Claude Desktop (instead of VS Code with Claude Code)

If you'd rather use the standalone Claude Desktop app:

1. Install from [claude.ai/download](https://claude.ai/download), sign in.
2. Settings (gear icon) → **Connectors** → **+** → fill in:
   - **Name**: `Campaign Studio`
   - **Remote MCP server URL**: `https://campaign-studio-30219985459.europe-west1.run.app/mcp`
   - Leave OAuth fields blank
3. Click **Add**, then open the `landing-page-template` folder as a project (File → Open Folder) and switch to the **Code** tab.

Both paths give you the same 11 tools. Pick whichever editor you're already using. The rest of this README assumes the VS Code path.

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

**Imported HTML** — you have a single `.html` file from somewhere else (Claude Artifacts, Cloth, Webflow export, ChatGPT, an email designer) and you want it shipped as a Flight Studio page on a real subdomain. Drop the file (and any images it references) in `imports/<campaign-slug>/` at the repo root. When you describe what you've got to Claude, it'll adapt the HTML to Flight Studio standards — wire up the right Klaviyo / Beehiiv signup, inject analytics + brand fonts + OG tags, fix obvious brand-style mismatches — then package it as a static dist and deploy via `deploy_custom_page`. No build pipeline required on your end; the marketer's HTML stays the source of truth through every iteration.

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
