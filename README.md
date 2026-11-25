# Every Shingle Heart Foundation

Landing page for [everyshingleheart.com](https://everyshingleheart.com) — a national roofing foundation partnering with roofing companies to give free roof replacements and repairs to homeowners in need.

**Founder**: Miriam McKisic
**Founding partner**: Happy Roof (Tampa Bay)

## Structure

A static site plus one serverless function for donations:

- `index.html`: the landing page (styles and scripts inline, all sections, including the `#donate` forms)
- `thank-you.html`: the confirmation page Stripe returns donors to
- `api/donate.js`: the Vercel function that starts Stripe Checkout (see [Payments](#payments-stripe))
- `scripts/stripe-setup.mjs`: creates the Stripe Products the function uses
- `package.json` / `package-lock.json`: the one runtime dependency, `stripe`
- `miriam.jpg`: founder portrait (800×996, ~156 KB)
- `favicon.svg`: heart-with-shingle-texture mark

## Local preview

Static pages only (the donate buttons need the function, see [Local development](#local-development)):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (Vercel)

The repo is connected to Vercel. A push to `main` deploys production (everyshingleheart.com). A push to any other branch builds a preview behind Vercel Authentication.

Project settings: Framework preset **Other**, no build command, output directory `./`. Vercel installs `package.json` dependencies for the function in `api/` and serves everything else as static files.

Custom domains `everyshingleheart.com` and `www.everyshingleheart.com` point at the project (DNS at GoDaddy).

## Payments (Stripe)

### How a gift flows

1. In the `#donate` section of `index.html`, the donor picks monthly or one-time, an amount, and optionally "cover processing fees".
2. `donateHandoff()` POSTs `{frequency, amount, coverFees}` to `/api/donate`.
3. `api/donate.js` validates the request, builds every Checkout parameter on the server, and returns the URL of a Stripe-hosted Checkout page.
4. The donor pays on Stripe Checkout. Payment methods (card, Apple Pay, Google Pay, Link, US bank account) are switched on and off in the Stripe Dashboard, not in code. Stripe creates the Customer, the payment or the monthly subscription, and the receipt.
5. Stripe sends the donor to `/thank-you.html?session_id=...`, which reads a minimal summary (amount, frequency, status; never name, email or address) from `GET /api/donate?session_id=...`. Cancelling on Checkout returns the donor to `/#donate` with nothing charged.

Monthly donors manage or cancel their gift in Stripe's customer portal. `/api/donate?manage=1` redirects to the portal login page.

There is no webhook yet. Add one only when something needs it (branded receipts, gift alerts, a Stripe-fed fund total).

### Limits and fees

- Whole dollars only: $5 to $1,000 a month, $5 to $10,000 one-time. The server re-checks every request. Larger gifts go through the "Corporate match & major gifts" email.
- "Cover processing fees" is unchecked by default. The estimate is `ceil((gift + 30 cents) / (1 - rate)) - gift`, with a rate of 3.3% for one-time gifts and 3.6% for monthly gifts. The function adds it as a separate "Added to cover processing fees" line, so Checkout and receipts show it apart from the gift.
- The function needs three Products in the Stripe account: `esh_gift_once`, `esh_gift_monthly` and `esh_fee_cover`. `scripts/stripe-setup.mjs` creates them and is safe to re-run.

### Environment variables

| Variable | Local (`.env.local`) | Preview | Production |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | sandbox secret key | sandbox secret key (Sensitive) | not set until go-live, then a restricted live-mode key (Sensitive) |
| `STRIPE_PORTAL_LOGIN_URL` | sandbox portal login link | sandbox portal login link | live portal login link |

`VERCEL_ENV` comes from Vercel. The function only accepts a live key in Production and only a test key everywhere else. A missing or mismatched key returns 503, and the page shows "Online giving is paused right now."

Keys never go in the repo (it is public). `.env*` is git-ignored. Before every push:

```bash
git grep -nE 'sk_(test|live)_|rk_(test|live)_|whsec[_]'   # must print nothing
git status                                              # no .env files listed
```

### Local development

```bash
npm install
# .env.local (git-ignored):
#   STRIPE_SECRET_KEY=<sandbox secret key>
#   STRIPE_PORTAL_LOGIN_URL=https://billing.stripe.com/p/login/test_...
node --env-file=.env.local scripts/stripe-setup.mjs   # once per Stripe account
(set -a; . ./.env.local; set +a; vercel dev --local)  # http://localhost:3000
```

`vercel dev` reads `.env` (or the project's Development variables), not `.env.local`, so the subshell exports `.env.local` for that one run. `--local` starts it without linking to the Vercel project, so the project's Development variables can't override yours.

### Test cards (sandbox only)

Any future expiry, any CVC, any name, US ZIP such as 33602.

| Card | Result |
| --- | --- |
| 4242 4242 4242 4242 | succeeds |
| 4000 0025 0000 3155 | succeeds after 3D Secure |
| 4000 0000 0000 9995 | declined (insufficient funds) |
| 4000 0000 0000 0002 | declined (generic) |
| 4100 0000 0000 0019 | blocked by Radar |

US bank account: the Stripe test bank, or routing `110000000` with account `000123456789` (succeeds) or `000222222227` (fails later). Test mode never emails receipts; use "Send receipt" on the payment in the Dashboard.

### Placeholders

The Florida disclosure carries `[City]` and `[pending]` (FDACS registration number), and the IRS status sentence is default wording. All are tagged in code:

```bash
grep -rn PLACEHOLDER index.html thank-you.html api/donate.js
```

Replace them before go-live (see the checklist below).

## Updating the fund progress bar

The homepage fund tracker shows dollars raised, plus dollars pledged on signed-pending contracts, toward the $50,000 2026 goal. To update it, edit `index.html` and search for `FUND_RAISED`:

```js
var FUND_RAISED = 1400;           // dollars actually in the fund
var FUND_PLEDGED = 2600;          // dollars pledged on signed-pending contracts
var FUND_GOAL = 50000;            // 2026 dollar goal
var LAST_UPDATED = '2026-10-06';  // display date; ISO YYYY-MM-DD
```

Change the values, commit and push to `main`, and Vercel deploys. The bar animates in on first scroll into view. If the goal changes, also update the goal text in the fund card ($50,000, plus `aria-valuemax`), the vision copy and the $50k stat.

Stripe gifts don't move the bar automatically yet. A Stripe-fed total is planned for a later phase; offline money and pledges will stay manual.

## Go-live checklist

Items marked ⚠️ block public promotion of the domain or live payments.

- [ ] ⚠️ **Florida charity registration.** FDACS approves the registration and issues a number before any live payments.
- [ ] ⚠️ **Counsel or CPA sign-off** on the donate copy, the Checkout text, the thank-you page, the receipt memo and footer, and the deductibility wording.
- [ ] ⚠️ **Placeholders replaced** (legal name, city, FDACS number, IRS status sentence). `grep -rn PLACEHOLDER index.html thank-you.html api/donate.js` prints nothing, and the live invoice memo in Stripe matches the site.
- [ ] ⚠️ **Live Stripe account** activated under ESH's own EIN and bank account (never Happy Roof's), industry MCC 8398, 2FA on, least-privilege roles. Public details: legal name, support email, support URL and privacy policy URL. Statement descriptor `EVERY SHINGLE HEART`. Donation disclosure OFF until the IRS letter arrives.
- [ ] ⚠️ **Live Dashboard settings** (sandbox settings don't carry over): payment methods (card, Apple Pay, Google Pay, Link, US bank account ON; Affirm, Klarna, Cash App Pay, Amazon Pay OFF), invoice default memo and footer, Successful payments and Refunds emails, Smart Retries and billing emails, branding, and the customer portal with its login link activated.
- [ ] ⚠️ **Live Products**: run `scripts/stripe-setup.mjs` with the live key in your own terminal (instructions at the top of the script).
- [ ] ⚠️ **Production env vars**: a restricted live-mode key added with `vercel env add STRIPE_SECRET_KEY production --sensitive` and pasted at the prompt, plus the live `STRIPE_PORTAL_LOGIN_URL`. Roll the sandbox key used during testing.
- [ ] ⚠️ **Set up `hello@everyshingleheart.com`.** It becomes the support email on every Stripe receipt. Easiest path: GoDaddy → Email Forwarding → forward `hello@` to your existing inbox (free, ~2 minutes). Or use a real inbox provider (Google Workspace, iCloud+ custom domain).
- [ ] ⚠️ **Legal review on the 501(c)(3) copy.** The trust bar and footer both say "501(c)(3) status pending." Once the IRS determination letter is issued, swap for actual language and add the EIN. Until then, gifts are **not** tax-deductible and the copy must be clear about that. Have a nonprofit-specialist CPA or attorney review.
- [ ] **Abuse controls**: Vercel Firewall rate limit on `/api/donate` (10 requests per 60 s per IP) switched from Log to 429, and GitHub secret-scanning push protection on.
- [ ] **Live smoke test**: a real $5 one-time gift and a $5 monthly gift, check Checkout, the thank-you page and the receipt emails, then refund and cancel.
- [ ] **Upgrade the nomination flow.** Currently `mailto:`. It works immediately, but a Google Form or Typeform gives you a structured intake, database, and file uploads. Swap the `<a href="mailto:...">` under the Nominate card.
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
