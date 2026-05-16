// Backend client. Talks to the Express server in /server.
//
// When served by the same Express that hosts these JS files (the production
// path: visit http://localhost:3000/), API_BASE is empty so requests are
// same-origin. Override at runtime via window.__API_BASE__ for split setups
// (e.g. still using Live Server on :5500 → API_BASE = 'http://localhost:3000').

const inSameOrigin = typeof window !== 'undefined'
  && window.location
  && !['5500', '5501', '5502'].includes(window.location.port);

const API_BASE = (typeof window !== 'undefined' && window.__API_BASE__)
  || (inSameOrigin ? '' : 'http://localhost:3000');

const CID_KEY = 'tradescore_cid';
export const getCid    = () => localStorage.getItem(CID_KEY);
export const setCid    = (cid) => localStorage.setItem(CID_KEY, cid);
export const clearCid  = () => localStorage.removeItem(CID_KEY);

async function req(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const cid = getCid();
    if (!cid) {
      const err = new Error('Not signed in');
      err.status = 401;
      throw err;
    }
    headers['x-customer-id'] = cid;
  }

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const err = new Error('Cannot reach backend at ' + API_BASE + ' — is `npm run dev` running?');
    err.network = true;
    throw err;
  }

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.data = json;
    err.status = res.status;
    throw err;
  }
  return json;
}

// Opens a Server-Sent Events stream for real-time pushes from the backend.
// Returns the EventSource so the caller can attach handlers and reconnect.
// Auth flows through ?cid=… since EventSource can't send custom headers.
export function openEventStream() {
  const cid = getCid();
  if (!cid) return null;
  return new EventSource(`${API_BASE}/api/events?cid=${encodeURIComponent(cid)}`);
}

export const api = {
  signup:          (data)   => req('/api/signup', { method: 'POST', body: data }),
  login:           (data)   => req('/api/login',  { method: 'POST', body: data }),
  me:              ()       => req('/api/me', { auth: true }),
  transactions:    ()       => req('/api/transactions', { auth: true }),
  score:           ()       => req('/api/score', { auth: true }),
  scoreHistory:    ()       => req('/api/score/history', { auth: true }),
  insights:        ()       => req('/api/insights', { auth: true }),
  chat:            (body)   => req('/api/chat', { method: 'POST', body, auth: true }),
  simulatePayment: (amount) => req('/api/dev/simulate-payment', { method: 'POST', body: { amount }, auth: true }),

  loans: {
    banks:         ()      => req('/api/loans/banks'),
    list:          ()      => req('/api/loans', { auth: true }),
    lookupAccount: (body)  => req('/api/loans/lookup-account', { method: 'POST', body, auth: true }),
    apply:         (body)  => req('/api/loans/apply', { method: 'POST', body, auth: true }),
  },

  inventory: {
    list:   ()         => req('/api/inventory', { auth: true }),
    add:    (body)     => req('/api/inventory', { method: 'POST', body, auth: true }),
    update: (id, body) => req(`/api/inventory/${id}`, { method: 'PATCH', body, auth: true }),
    remove: (id)       => req(`/api/inventory/${id}`, { method: 'DELETE', auth: true }),
  },

  payments: {
    initiate: (body) => req('/api/payments/initiate', { method: 'POST', body, auth: true }),
  },

  wallet:      ()     => req('/api/wallet', { auth: true }),
  withdrawals: {
    list:   ()        => req('/api/withdrawals', { auth: true }),
    apply:  (body)    => req('/api/withdrawals', { method: 'POST', body, auth: true }),
  },

  workers:     ()     => req('/api/workers', { auth: true }),
  gigs: {
    match:     (body) => req('/api/gigs/match',      { method: 'POST', body, auth: true }),
    payWorker: (body) => req('/api/gigs/pay-worker', { method: 'POST', body, auth: true }),
  },
  network:     ()     => req('/api/network', { auth: true }),
};
