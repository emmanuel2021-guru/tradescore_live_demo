import 'dotenv/config';

const BASE = process.env.SQUAD_BASE_URL || 'https://sandbox-api-d.squadco.com';
const SK = process.env.SQUAD_SECRET_KEY;

async function call(path, method = 'POST', body) {
  if (!SK) throw new Error('SQUAD_SECRET_KEY is not set in .env');

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SK}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

  if (!res.ok || json.success === false) {
    const err = new Error(json.message || `Squad API ${res.status}`);
    err.squad = json;
    err.status = res.status;
    throw err;
  }
  return json;
}

export const squad = {
  createVirtualAccount: (payload) => call('/virtual-account', 'POST', payload),

  getCustomerVirtualAccount: (customer_identifier) =>
    call(`/virtual-account/${customer_identifier}`, 'GET'),

  getCustomerTransactions: (customer_identifier) =>
    call(`/virtual-account/customer/transactions/${customer_identifier}`, 'GET'),

  lookupAccount: ({ bank_code, account_number }) =>
    call('/payout/account/lookup', 'POST', { bank_code, account_number }),

  transfer: async (payload) => {
    console.log('[squad.transfer] →', payload);
    try {
      const res = await call('/payout/transfer', 'POST', payload);
      console.log('[squad.transfer] ✓', res);
      return res;
    } catch (e) {
      console.warn('[squad.transfer] ✗', { message: e.message, status: e.status, squad: e.squad });
      throw e;
    }
  },

  requeryTransfer: (transaction_reference) =>
    call('/payout/requery', 'POST', { transaction_reference }),

  simulatePayment: (payload) =>
    call('/virtual-account/simulate/payment', 'POST', payload),

  // Initiate a hosted checkout link. Returns Squad's `data.checkout_url`
  // (a real https://sandbox-pay.squadco.com/<hash> URL the customer pays at).
  initiateTransaction: (payload) =>
    call('/transaction/initiate', 'POST', payload),
};
