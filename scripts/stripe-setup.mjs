// Creates the Stripe Products that api/donate.js references. Safe to re-run:
// existing products are left alone.
//
// Sandbox (from the repo root):
//   node --env-file=.env.local scripts/stripe-setup.mjs
//
// Live, at go-live, in your own terminal so the key never lands in a file or chat:
//   read -s STRIPE_SECRET_KEY && export STRIPE_SECRET_KEY
//   node scripts/stripe-setup.mjs
//   unset STRIPE_SECRET_KEY
//
// This file holds no secrets; the key only ever comes from the environment.

import Stripe from 'stripe';

const DESCRIPTION = 'Funds roofing materials and labor for homeowners in need.';

const PRODUCTS = [
  { id: 'esh_gift_once', name: 'One-time gift to Every Shingle Heart', description: DESCRIPTION },
  { id: 'esh_gift_monthly', name: 'Monthly gift to Every Shingle Heart', description: DESCRIPTION },
  {
    id: 'esh_fee_cover',
    name: 'Added to cover processing fees',
    description: 'An optional amount the donor adds to help cover payment processing fees.',
  },
];

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set. See the comment at the top of this file.');
  process.exit(1);
}
const mode = /^(sk|rk)_live_/.test(key) ? 'LIVE' : /^(sk|rk)_test_/.test(key) ? 'test' : null;
if (!mode) {
  console.error('STRIPE_SECRET_KEY is not a Stripe secret or restricted key.');
  process.exit(1);
}
console.log(`Stripe ${mode} mode`);

const stripe = new Stripe(key);
let failed = false;

for (const product of PRODUCTS) {
  try {
    const existing = await stripe.products.retrieve(product.id);
    const note = existing.active ? '' : '  WARNING: archived, Checkout will fail until it is reactivated';
    console.log(`exists   ${product.id}  "${existing.name}"${note}`);
  } catch (err) {
    if (err && err.code === 'resource_missing') {
      try {
        const created = await stripe.products.create(product);
        console.log(`created  ${created.id}  "${created.name}"`);
      } catch (createErr) {
        failed = true;
        console.error(`failed   ${product.id}  ${createErr.type || ''} ${createErr.code || ''} ${createErr.message}`);
      }
    } else {
      failed = true;
      console.error(`failed   ${product.id}  ${err.type || ''} ${err.code || ''} ${err.message}`);
    }
  }
}

process.exit(failed ? 1 : 0);
