You are setting up a new landing page campaign. Read `.claude/commands/CAMPAIGN_LEARNINGS.md` for deeper context and rationale, and apply those learnings throughout this process.

Guide the user through these five phases. Move through them naturally — don't number them or say "Phase 1". Just have a conversation.

## Phase 1: Brief

Collect the information you need. Group related questions — don't ask one at a time.

### Campaign Type (ask first — determines the build)
- "Is this a signup page, a quiz, a competition entry, or something else?"
- "Is there a spec document or brief I should work from?"

### Brand & Basics
- Which brand? Check `src/brands/` for available presets (currently **doac** and **wntt**).
- Campaign name (human readable, e.g. "WNTT Love Island Quiz")
- What Klaviyo list should signups go to? If they don't know: "You can find it in Klaviyo > Audience > Lists & Segments — click the list and grab the short code from the URL."

### Page Content
For signup: headline, body copy, button text, post-submission message.
For quiz: what's the quiz about, how many questions, what are the result types?

### A/B Variants
- What do they want to test? Name variants descriptively — never use "a"/"b".

**You figure out these technical fields yourself** (don't ask the user):
- Campaign slug (from the campaign name, lowercase hyphenated)
- Consent source (format: YYYYMM_BrandCampaign)
- Service name (same as slug)

## Phase 2: Build

Once you have everything:

### Signup campaigns
```bash
./scripts/scaffold.sh "<Campaign Name>"
```

### Quiz campaigns
```bash
./scripts/scaffold.sh "<Campaign Name>" --type quiz
```

Then:
1. Edit `src/campaign.config.js` — replace all TODOs with collected values. Change the brand import to the right preset. Meta Pixel ID comes from the brand preset automatically.
2. For quiz campaigns: edit `src/quizData.js` with questions, results, gate content, and `src/scoring.js` with scoring rules.
3. Add OG fields to config: `OG_DESCRIPTION` (social sharing text) and `OG_IMAGE_PATH`. Remind the user they'll need a 1200x630 OG image.
4. Run `npm run dev` — the preview opens automatically.
5. Say: "Here's your page — take a look and tell me what you'd like to change."

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

Use the **Campaign Studio MCP** tools (remote, on Cloud Run):

1. **Deploy**: Use `deploy_landing_page` with the campaign config values. This builds, deploys to Cloud Run, and returns a live URL (~2 min).
2. **Custom domain**: Use `setup_domain` to add a subdomain (e.g. `quiz.needtotalkshow.com`).
3. **SSL check**: Use `check_ssl_status` to verify SSL is provisioned (15-30 min after domain setup).
4. **Post-deploy updates**: If changes are needed after deploy, edit locally, preview, then use `deploy_landing_page` again.

After deploy, remind the user to:
- Test the live URL
- Check OG image renders (Facebook Sharing Debugger)
- Set `OG_URL` in campaign.config.js to the live domain, rebuild if needed

## Important Notes
- Each campaign gets its own project directory (sibling to this template repo)
- Brand presets contain all shared values — don't duplicate them in campaign config
- RudderStack write key and dataplane URL are shared across ALL brands — never change these
- The campaign slug is how you filter this campaign's data in BigQuery
- Use `updateKlaviyoProfile()` (Client API) for critical data — `identifyKlaviyo()` only works after cookie consent
- Always use lowercase snake_case for all Klaviyo custom properties
- Use `${CAMPAIGN_SLUG}_variant` to namespace variant data per campaign
