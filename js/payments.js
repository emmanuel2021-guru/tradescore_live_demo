// ─────────────────────────────────────────────────────────────────
// Payments integration — backend-backed.
//
// `createPaymentLink` calls POST /api/payments/initiate on our Express
// backend, which in turn calls Squad's /transaction/initiate and returns a
// real hosted-checkout URL (https://sandbox-pay.squadco.com/<hash>) that the
// customer can actually pay at. The inventory cash-sale modal reads the
// `url` field from the resolved object and renders share buttons around it.
// ─────────────────────────────────────────────────────────────────

import { api } from './api.js';

// Client-side fallback reference generator. The backend issues its own
// reference and returns it in the response, but we generate one here so
// callers that want a stable id pre-call can pass it through.
export function generateReference(prefix = 'TS') {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand  = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

// Creates a real Squad hosted-checkout link for `amount` NGN. The customer
// pays at the returned URL — money lands in the merchant's virtual account.
// Return shape:
//   { url, reference, expiresAt, provider, status, meta }
export async function createPaymentLink({ item, qty, amount, currency = 'NGN', reference, customer }) {
  const resp = await api.payments.initiate({
    amount,                          // backend expects naira; converts to kobo
    currency,
    reference,                       // optional; backend regenerates if absent
    item_name: item?.name,
    qty,
    customer_name: customer?.name,
    customer_email: customer?.email,
  });

  return {
    url:       resp.url,
    reference: resp.reference,
    expiresAt: resp.expiresAt || (Date.now() + 30 * 60 * 1000),
    provider:  resp.provider  || 'squad',
    status:    resp.status    || 'pending',
    meta: { itemId: item?.id, itemName: item?.name, qty, amount, currency, customer },
  };
}

// Status poll placeholder — Squad uses webhooks, but the dashboard's
// SSE stream already surfaces inflows in real time, so this is mostly a
// stub kept for API parity.
export async function checkPaymentStatus(reference) {
  return { reference, status: 'pending' };
}
