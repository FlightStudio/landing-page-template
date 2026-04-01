# Campaign Build Learnings

Accumulated from the WNTT Attachment Style Survey build (March 2026) and ongoing campaigns. Reference this document during every `/new-campaign` build.

---

## 1. Campaign Type Detection

The scaffold produces a standard signup landing page (LandingPage.jsx + SignupForm.jsx). Not every campaign is a signup page.

**Ask upfront:** "Is this a signup page, a quiz, a competition entry, or something else?"

- **Signup page** — `./scripts/scaffold.sh "Name"` — use as-is
- **Quiz** — `./scripts/scaffold.sh "Name" --type quiz` — includes EmailGate, QuizQuestion, QuizPage, ResultsPage, quizData.js, scoring.js. Fill in quizData.js with questions/results.
- **Other** — scaffold for toolchain, plan bespoke components before building

---

## 2. Spec Accuracy

**Always ask for the canonical spec document before building.** A user's summary of the spec may differ from the actual spec in critical ways:

- Number of results/outcomes (3 vs 4)
- Answer-to-category mappings (A/B/C ordering)
- Scoring logic (tie-breaking rules, combo types like Fearful-Avoidant)
- Whether fields are optional or required (e.g. email gate)

Don't assume the first description is complete. Ask: "Is there a spec document or brief I should work from directly?"

---

## 3. Klaviyo Integration

### Cookie consent dependency
`identifyKlaviyo()` uses `window._learnq` (Klaviyo onsite JS) which only loads after cookie consent. **Critical data like quiz results must NOT rely on this.** Use `updateKlaviyoProfile()` (Client API at `/client/profiles/`) instead — it works without cookie consent.

### Property casing
The two Klaviyo functions historically used different conventions (`Landing Page` vs `landing_page`, `Variant` vs `variant`). **Always use lowercase snake_case for all custom properties.** Old capitalised properties may persist on existing profiles but new code must be consistent.

### Data minimalism
Ask upfront: "What data do you actually need in Klaviyo for segmentation?" Don't send raw scores or intermediate data — only send what marketing will actually use. For a quiz, `attachment_style` (the result) is useful; individual scores usually aren't.

### Custom objects vs properties
For a single campaign, custom properties are sufficient. Custom objects (Klaviyo's relational data) only make sense when:
- Running multiple quizzes and want per-quiz history
- Need to store arrays of results per profile
- Plan to do segmentation like "took quiz X AND got result Y"

Don't introduce custom objects complexity unless the use case demands it.

---

## 4. Analytics Consent Model (Updated March 2026)

**All analytics load unconditionally on page init.** No consent gating. The data controller approved this approach because users weren't accepting cookie consent, which meant we were losing critical tracking data.

`initConsent()` loads everything immediately:
- **Klaviyo** — onsite JS
- **Meta Pixel** — granted mode, fires PageView on load
- **RudderStack** — full SDK + page views + click tracking

The cookie consent banner still appears but only:
1. Records the user's preference cookie
2. Replays `identifyKlaviyo()` if a form was already submitted
3. Tracks a `"Cookie Consent"` event (accepted or rejected)

**No script loading, no event replay, no revoke/grant cycles.** Form/quiz submission events fire directly — `ensureRudderStackSDK()` is just a safety net in case the SDK hasn't finished loading yet.

---

## 5. Meta Pixel Integration

### Per-brand, not per-campaign
The Meta Pixel ID lives in the **brand preset** (`src/brands/doac.js`, `src/brands/wntt.js`), not in `campaign.config.js`. The pixel is the same for all campaigns under a brand. `campaign.config.js` re-exports it from the brand.

If a brand preset doesn't have a pixel ID yet, prompt during `/new-campaign`:
- "Does this brand have a Meta Pixel? Check Meta Events Manager → Data Sources → select the pixel → the ID is the number at the top of the page."
- Add the ID to the brand preset once — all future campaigns for that brand will use it automatically.

### No consent gating
The pixel loads in **granted mode** unconditionally on page init via `loadMetaPixel()` in `initConsent()`. No revoke/grant cycle. PageView fires on load. Data controller approved this.

### Standard events to fire
| Event | When | Purpose |
|-------|------|---------|
| `PageView` | Pixel init (automatic) | Audience building |
| `Lead` | Email/form submission | Lead tracking |
| `CompleteRegistration` | Quiz completion / signup confirmation | Conversion tracking |

Use `window.fbq?.("track", "Lead")` with optional chaining — silently no-ops if pixel isn't loaded.

### Don't wait for the pixel ID
If the media team hasn't provided it yet, leave `metaPixelId` empty in the brand preset. `loadMetaPixel()` early-returns when falsy — everything else is already wired up.

---

## 6. Social Sharing & OG Tags (add during initial setup)

### OG meta tags
Every campaign should have Open Graph tags in `index.html`. Add during initial setup, not as an afterthought:
- `og:title`, `og:description`, `og:image` (1200x630 jpg/png), `og:url`
- Matching `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- The OG image must be at the public deploy URL (crawlers can't reach localhost)

### Share button
For quizzes and interactive content, add a share button on the results page:
- Use Web Share API (native share sheet on mobile) with clipboard fallback on desktop
- **Don't share the user's personal result** — people may not want that exposed. Default to generic share text like "What's your attachment style? Take the quiz to find out."
- Share URL should be the clean campaign URL, not a result-specific URL

### Testing OG tags
OG tags can only be tested on the live deployed URL. Use Facebook Sharing Debugger, Twitter Card Validator, or LinkedIn Post Inspector after deployment.

---

## 7. Brand & Styling

### Logo context awareness
Brand presets define a single logo, but it may be invisible depending on background:
- Teal logo on teal background = invisible
- Pink logo on pink background = invisible

**Check logo visibility against every background it appears on.** The results page, email gate, and quiz page may all have different backgrounds. Use variant logos (white, black, coloured) as needed.

### Typography
- Marketing may have specific font-weight preferences per variant (e.g. `font-semibold` not `font-bold`)
- Avoid em dashes in copy — marketing flags these. Use regular dashes or rephrase.
- Ask about text casing (uppercase headings are common for WNTT brand)

### Image/layout iterations
Rather than iterating through layouts (rounded card → side-by-side → collage → no images), ask upfront:
- "Does marketing want images on the landing page?"
- "If yes, what layout? Full-width hero, side-by-side, or card?"
- This avoids 4+ rounds of "try this / no go back"

---

## 8. Deployment & Infrastructure

### Git repo
Initialise a git repo in every new campaign project at scaffold time (`git init && git add -A && git commit -m "Initial scaffold"`). Without version control, it's impossible to know which version is deployed or roll back changes.

### Deploy via Campaign Studio MCP
The Campaign Studio MCP server is hosted on Cloud Run. Use its tools for deployment — no manual gcloud commands needed:

1. **`deploy_landing_page`** — builds, deploys to Cloud Run, returns a live URL (~2 min). Uses timestamped image tags to ensure new revisions are created.
2. **`setup_domain`** — creates GoDaddy CNAME, verifies domain with Google, creates Cloud Run domain mapping. Checks for existing CNAMEs to avoid duplicates and reports mapping status (including permission errors).
3. **`check_ssl_status`** — checks DNS + HTTPS to verify SSL provisioning (takes 15-30 min after domain setup).
4. **`update_landing_page`** — for post-deploy config changes (headline, content, etc.). Same URL, new revision.

### Domain gotchas
- Ensure the correct domain (e.g. `needtotalkshow.com` vs `weneedtotalk.com`)
- The 503 "unable to handle this request" error during SSL provisioning is expected and temporary
- The service account needs **Owner** permission in Google Search Console for the domain (not just "Full" — that's insufficient for Cloud Run domain verification)
- If `setup_domain` reports a permission error on the mapping, check Search Console permissions first

---

## 9. Variant Naming

**Never use `"a"` / `"b"` as variant names.** These are meaningless in Klaviyo, BigQuery, and RudderStack. Variant names should describe what's being tested so that anyone reading the data understands the experiment without a lookup table.

**Good examples:**
- `"headline-long"` / `"headline-short"`
- `"hero-video"` / `"hero-image"`
- `"headline-question"` / `"headline-statement"`

**Bad examples:**
- `"a"` / `"b"` — meaningless
- `"variant1"` / `"variant2"` — still meaningless

The variant value flows through to:
- Klaviyo profile properties (`variant`)
- RudderStack events (`variant` field in every event)
- BigQuery (via RudderStack warehouse sync)
- URL params (`?variant=headline-long`)

Ask upfront: "What should we call these variants? Something descriptive so the data makes sense later."

Update `VARIANTS` in `campaign.config.js` and all references in `VariantRedirect.jsx`.

---

## 10. Upfront Questions Checklist

Ask these during initial campaign setup to avoid mid-build surprises:

- [ ] "Is this a signup page, quiz, competition, or something else?"
- [ ] "Is there a canonical spec document or brief?"
- [ ] "Do you have a Meta Pixel ID?"
- [ ] "What data does marketing actually need in Klaviyo?"
- [ ] "Is email required or optional?"
- [ ] "Does marketing want images? If yes, what layout?"
- [ ] "What are the A/B variants testing, and what should we name them?" (see Variant Naming below)
- [ ] "What domain/subdomain will this live on?"
- [ ] "Any specific copy/typography requirements (casing, font weights, no em dashes)?"

---

## 11. Pre-Launch Checklist

Before sending to customers, verify:

- [ ] A/B variants load correctly (`?variant=a` and `?variant=b`)
- [ ] RudderStack events fire in Network tab — page views on load, form/quiz events on interaction
- [ ] Meta Pixel fires in Network tab (`fbevents.js` loaded, `tr?` requests for PageView/Lead/CompleteRegistration)
- [ ] Klaviyo subscription creates profile with correct list + properties
- [ ] Klaviyo custom properties use lowercase snake_case consistently
- [ ] Cookie consent banner appears and records preference; all analytics fire regardless of choice
- [ ] Email validation works (required vs optional as spec demands)
- [ ] Full user flow end-to-end (gate → content → result/confirmation)
- [ ] OG tags present in `index.html` with correct 1200x630 image
- [ ] OG image not squashed (check source aspect ratio vs 1200x630 crop)
- [ ] Test OG preview via Facebook Sharing Debugger after deploy
- [ ] Mobile responsiveness
- [ ] Footer links (Terms, Privacy, Cookie Policy) all correct
- [ ] No em dashes or incorrect typography in copy
- [ ] Logo visible on all background contexts (check against every bg colour)
- [ ] Share button works (if applicable) — generic text, not personal results
- [ ] `npx vite build` succeeds without errors
- [ ] Deploy via Campaign Studio MCP `deploy_landing_page` (handles build + deploy automatically)
