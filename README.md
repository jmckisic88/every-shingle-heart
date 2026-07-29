# Every Shingle Heart Foundation

Landing page for [everyshingleheart.com](https://everyshingleheart.com) — a national roofing foundation partnering with roofing companies to give free roof replacements and repairs to homeowners in need.

**Founder**: Miriam McKisic
**Founding partner**: Happy Roof (Tampa Bay)

## Structure

Single-page site. Two files:

- `index.html` — the entire page (styles inline, all sections)
- `miriam.jpg` — founder portrait (800×996, ~156 KB)
- `favicon.svg` — heart-with-shingle-texture mark

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (Vercel)

Auto-deploys on push to `main` once you connect the repo in Vercel. First-time setup:

```bash
npx vercel
# Follow prompts: link this directory to a new Vercel project
# Framework preset: Other (static)
# Build command: (leave blank)
# Output directory: ./
```

Then add `everyshingleheart.com` and `www.everyshingleheart.com` as custom domains in the Vercel project settings, and update DNS at GoDaddy per Vercel's instructions.

## Updating the fund progress bar

The homepage has a live fund tracker (`$X raised toward $100,000 goal by 2026`).
To update the raised amount, edit `index.html` and search for `FUND_RAISED`:

```js
var FUND_RAISED = 0;              // update this
var FUND_GOAL = 100000;
var LAST_UPDATED = '2026-07-29';  // display date; ISO YYYY-MM-DD
```

Change the three values, `git commit && git push`, Vercel auto-deploys. The
bar animates from empty into the new percentage on first scroll into view.

**Future automation**: swap the static `FUND_RAISED` for a `fetch()` call to
Donorbox's public campaign totals (once you have a Donorbox campaign), or to
a small JSON file you keep updated (`funds.json` in this repo, updated by a
GitHub Action on Donorbox webhook). Either approach is a ~10-line change.

## Go-live checklist

Items marked ⚠️ block public promotion of the domain.

- [ ] ⚠️ **Wire a real donation processor.** In `index.html`, search for `DONORBOX_CAMPAIGN_ID` and replace with your Donorbox campaign slug (recommended: sign up at [donorbox.org](https://donorbox.org), create a campaign, use the slug from your campaign URL). Alternatives: Stripe Payments, PayPal Giving Fund, GoFundMe Charity.
- [ ] ⚠️ **Set up `hello@everyshingleheart.com`.** Easiest path: GoDaddy → Email Forwarding → forward `hello@` to your existing inbox (free, ~2 minutes). Or use a real inbox provider (Google Workspace, iCloud+ custom domain).
- [ ] ⚠️ **Legal review on the 501(c)(3) copy.** The trust bar + donate footer both say "501(c)(3) status pending." Once the IRS determination letter is issued, swap for actual language and add the EIN. Until then, gifts are **not** tax-deductible and the copy must be clear about that. Have a nonprofit-specialist CPA or attorney review.
- [ ] **Upgrade the nomination flow.** Currently `mailto:` — works immediately but a Google Form or Typeform gives you a structured intake, database, and file uploads. Swap the `<a href="mailto:...">` under the Nominate card.
- [ ] **Replace the placeholder logo.** The current SVG is a first-pass shingled heart. Swap the two inline SVG blocks in `index.html` (search for `shingleCourseSmall` and `shingleCourseHero`) when the real logo is ready.
- [ ] **Add real projects / testimonials as they happen.** Reserve section-space just above the Story block.
- [ ] **Google Analytics or Plausible.** Add whichever tracker you want at the bottom of `<head>` before deploying to a public URL.

## Design tokens (for reference)

Palette lives in `:root` and `@media (prefers-color-scheme: dark)` CSS custom properties at the top of `index.html`.

- `--warm` **#C25E31** — primary accent (heart / rust / CTA)
- `--accent` **#234037** — deep evergreen (stewardship, framing)
- `--wheat` **#E9B96E** — golden highlight (vision-section stats)
- `--ground` **#FBF8F1** — warm cream base (light theme)
- Dark theme flips ground to **#141C18** and warm to a slightly brighter **#E67450** for contrast

Type: Cochin / Big Caslon / Palatino / Georgia stack for display; system sans for body.

Both light + dark themes fully supported. The theme toggle in the header cycles system → light → dark → system.

## Contact

Site issues: [jmckisic@gmail.com](mailto:jmckisic@gmail.com)
Foundation: hello@everyshingleheart.com (pending setup)
