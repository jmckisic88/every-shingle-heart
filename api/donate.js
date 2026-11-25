// Every Shingle Heart donations: one Vercel function, Stripe-hosted Checkout.
//
//   POST /api/donate                    {frequency, amount, coverFees} -> 200 {url}
//   GET  /api/donate?session_id=cs_...  minimal gift summary for /thank-you.html
//   GET  /api/donate?manage=1           302 to the Stripe customer portal login page
//
// Env vars:
//   STRIPE_SECRET_KEY        required. A test-mode secret or restricted key everywhere
//                            except production, which only accepts a live-mode key.
//   STRIPE_PORTAL_LOGIN_URL  optional. Hosted customer portal login link for monthly donors.
//   VERCEL_ENV               set by Vercel ('production', 'preview' or 'development').
//
// Every Stripe parameter is built here. The only client input used is frequency,
// a whole-dollar amount and the cover-fees flag; everything else in the body is ignored.
// Logs carry only the session id, frequency and cents: never a name, email or address.

import Stripe from 'stripe';

const LIMITS = { onetime: { min: 5, max: 10000 }, monthly: { min: 5, max: 1000 } }; // whole dollars
const PRODUCTS = { onetime: 'esh_gift_once', monthly: 'esh_gift_monthly', fees: 'esh_fee_cover' };
const FEE = { onetime: 0.033, monthly: 0.036, fixedCents: 30 };
const MAX_BODY_BYTES = 1024;
const SOURCE = 'everyshingleheart.com';
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,}$/;

// PLACEHOLDER: [City] (principal office city) and [pending] (FDACS registration
// number) must be replaced before go-live, together with the same text in
// index.html and thank-you.html. The legal name is also a default until confirmed.
const SUBMIT_TEXT =
  'By completing this gift, you confirm you are not a foreign source of concern as defined in ' +
  'section 496.404, Florida Statutes. Every Shingle Heart Foundation, [City], Florida. ' +
  'Florida registration no. [pending]. A COPY OF THE OFFICIAL REGISTRATION AND FINANCIAL ' +
  'INFORMATION MAY BE OBTAINED FROM THE DIVISION OF CONSUMER SERVICES BY CALLING TOLL-FREE ' +
  'WITHIN THE STATE. REGISTRATION DOES NOT IMPLY ENDORSEMENT, APPROVAL, OR RECOMMENDATION BY ' +
  'THE STATE. 1-800-HELP-FLA (435-7352), FDACS.gov.';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function log(level, event, fields) {
  console[level](JSON.stringify({ event, ...fields }));
}

// Fails closed: a missing key, a test key in production or a live key anywhere
// else all return null, and the caller answers 503.
function stripeKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const production = process.env.VERCEL_ENV === 'production';
  const ok = production ? /^(sk|rk)_live_/.test(key) : /^(sk|rk)_test_/.test(key);
  if (!ok) {
    log('error', 'stripe_key_mode_mismatch', { vercelEnv: process.env.VERCEL_ENV || null });
    return null;
  }
  return key;
}

// Returns the request's Origin when its host matches the host that served the
// request, so previews, the apex domain and www each send donors back to themselves.
function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return host && parsed.host.toLowerCase() === host ? parsed.origin : null;
}

// Reads at most MAX_BODY_BYTES; returns null when the body is larger.
async function readBody(request) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function lineItem(product, unitAmount, monthly) {
  const priceData = { currency: 'usd', unit_amount: unitAmount, product };
  if (monthly) priceData.recurring = { interval: 'month' };
  return { quantity: 1, price_data: priceData };
}

function checkoutParams({ frequency, giftCents, feeCents, origin }) {
  const monthly = frequency === 'monthly';
  const meta = {
    gift_type: frequency,
    gift_cents: String(giftCents),
    fee_cover_cents: String(feeCents),
    source: SOURCE,
  };
  const lineItems = [lineItem(monthly ? PRODUCTS.monthly : PRODUCTS.onetime, giftCents, monthly)];
  if (feeCents > 0) lineItems.push(lineItem(PRODUCTS.fees, feeCents, monthly));

  const common = {
    submit_type: 'donate',
    line_items: lineItems,
    billing_address_collection: 'required',
    metadata: meta,
    success_url: origin + '/thank-you.html?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: origin + '/#donate',
  };

  if (!monthly) {
    return {
      mode: 'payment',
      ...common,
      customer_creation: 'always',
      invoice_creation: {
        enabled: true,
        invoice_data: { metadata: { gift_type: 'onetime', source: SOURCE } },
      },
      payment_intent_data: { description: 'One-time gift to Every Shingle Heart', metadata: meta },
      custom_text: { submit: { message: SUBMIT_TEXT } },
    };
  }

  const customText = { submit: { message: SUBMIT_TEXT } };
  const portal = process.env.STRIPE_PORTAL_LOGIN_URL;
  if (portal) {
    customText.after_submit = {
      message: 'Need to change or cancel later? Use our [donor portal](' + portal + ').',
    };
  }
  return {
    mode: 'subscription',
    ...common,
    subscription_data: { description: 'Monthly gift to Every Shingle Heart', metadata: meta },
    custom_text: customText,
  };
}

export async function POST(request) {
  // 1-2. A key is set, and its mode matches this environment.
  const key = stripeKey();
  if (!key) return json(503, { error: 'unavailable' });

  // 3. Same-origin browser request.
  const origin = sameOrigin(request);
  if (!origin) return json(403, { error: 'forbidden' });

  // 4. Small JSON body.
  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') return json(415, { error: 'unsupported_media_type' });
  const text = await readBody(request);
  if (text === null) return json(413, { error: 'payload_too_large' });

  // 5. Parses as a JSON object.
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(400, { error: 'invalid_json' });
  }

  // 6. Frequency (the form's data-donate-type values).
  const { frequency, amount, coverFees } = body;
  if (frequency !== 'onetime' && frequency !== 'monthly') {
    return json(400, { error: 'invalid_frequency' });
  }

  // 7. Whole dollars within the limits for that frequency.
  const { min, max } = LIMITS[frequency];
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < min || amount > max) {
    return json(400, { error: 'amount_out_of_range', min, max });
  }

  // 8. Optional boolean.
  if (coverFees !== undefined && typeof coverFees !== 'boolean') {
    return json(400, { error: 'invalid_cover_fees' });
  }

  const giftCents = amount * 100;
  const rate = FEE[frequency];
  const feeCents = coverFees ? Math.ceil((giftCents + FEE.fixedCents) / (1 - rate)) - giftCents : 0;

  const stripe = new Stripe(key);
  try {
    const session = await stripe.checkout.sessions.create(
      checkoutParams({ frequency, giftCents, feeCents, origin }),
    );
    log('log', 'checkout_session_created', { session: session.id, frequency, giftCents, feeCents });
    return json(200, { url: session.url });
  } catch (err) {
    log('error', 'checkout_session_failed', {
      type: err && err.type,
      code: err && err.code,
      requestId: err && err.requestId,
      frequency,
      giftCents,
      feeCents,
    });
    return json(502, { error: 'checkout_failed' });
  }
}

function cents(value) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export async function GET(request) {
  const params = new URL(request.url, 'http://localhost').searchParams;

  if (params.get('manage') === '1') {
    const portal = process.env.STRIPE_PORTAL_LOGIN_URL;
    if (!portal) return json(404, { error: 'not_found' });
    return new Response(null, { status: 302, headers: { Location: portal, 'Cache-Control': 'no-store' } });
  }

  const id = params.get('session_id');
  if (!id || !SESSION_ID.test(id)) return json(400, { error: 'invalid_session_id' });

  const key = stripeKey();
  if (!key) return json(503, { error: 'unavailable' });

  // A live session id can't exist in test mode (and the reverse), so skip the API call.
  if (id.startsWith('cs_live_') !== /^(sk|rk)_live_/.test(key)) return json(404, { error: 'not_found' });

  const stripe = new Stripe(key);
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(id);
  } catch (err) {
    if (err && (err.code === 'resource_missing' || err.statusCode === 404)) {
      return json(404, { error: 'not_found' });
    }
    log('error', 'checkout_session_lookup_failed', {
      session: id,
      type: err && err.type,
      code: err && err.code,
      requestId: err && err.requestId,
    });
    return json(502, { error: 'lookup_failed' });
  }

  const meta = session.metadata || {};
  const frequency =
    meta.gift_type === 'monthly' || meta.gift_type === 'onetime'
      ? meta.gift_type
      : session.mode === 'subscription'
        ? 'monthly'
        : 'onetime';

  // Amounts and status only: never the donor's name, email or address.
  const summary = {
    frequency,
    giftCents: cents(meta.gift_cents),
    feeCents: cents(meta.fee_cover_cents),
    amountTotal: session.amount_total,
    currency: session.currency,
    status: session.status,
    paymentStatus: session.payment_status,
  };
  if (frequency === 'monthly') summary.portalUrl = process.env.STRIPE_PORTAL_LOGIN_URL || null;
  return json(200, summary);
}
