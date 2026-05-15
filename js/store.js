// localStorage-backed user + inventory store.
// After a real /api/signup, the server-returned user is merged on top of the
// mock TRADER so dashboard panels keep working until we wire each one to live data.

import { TRADER } from './data.js';
import { api, getCid, clearCid } from './api.js';

const USER_KEY     = 'tradescore_user';
const INV_KEY      = 'tradescore_inventory';
const TXS_KEY      = 'tradescore_txs';
const SCORE_KEY    = 'tradescore_score';
const SYNC_KEY     = 'tradescore_last_sync';
const INSIGHTS_KEY = 'tradescore_insights';
const PREFS_KEY    = 'tradescore_prefs';
const SALES_KEY    = 'tradescore_sales';

// Records the moment the last successful tx refresh happened (ISO string).
// The dashboard reads this for its "Live · synced N min ago" badge.
export function getLastSync() {
  return read(SYNC_KEY);
}

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); }
  catch { return null; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota */ }
}

// ── User profile ────────────────────────────────────────────────
export function getUser() {
  const saved = read(USER_KEY) || {};
  const merged = { ...TRADER, ...saved };

  // Derived
  if (saved.name && !saved.firstName) merged.firstName = saved.name.split(/\s+/)[0];
  if (saved.name) {
    merged.avatar = saved.name
      .split(/\s+/).filter(Boolean).slice(0, 2)
      .map(p => p[0]?.toUpperCase()).join('') || TRADER.avatar;
  }
  if (saved.business) merged.business = saved.business;
  return merged;
}
export function saveUser(partial) {
  const cur = read(USER_KEY) || {};
  write(USER_KEY, { ...cur, ...partial });
  return getUser();
}
export function clearUser() {
  clearUserScopedStorage();
  clearCid();
}

// Wipes every per-user cache so a fresh signup / login on the same browser
// doesn't inherit the previous account's transactions, sales, score, etc.
// Called from clearUser() (logout) and from the signup / login pages before
// they stamp a new customer_identifier.
export function clearUserScopedStorage() {
  [USER_KEY, INV_KEY, TXS_KEY, SCORE_KEY, SYNC_KEY, INSIGHTS_KEY, SALES_KEY]
    .forEach(k => localStorage.removeItem(k));
}

// Pulls the latest user from the backend (uses x-customer-id from localStorage).
// Returns null if not signed in or backend unreachable. Non-throwing — the
// caller decides whether to fall back to cached mock data.
export async function refreshUserFromServer() {
  if (!getCid()) return null;
  try {
    const { user } = await api.me();
    saveUser({
      customer_identifier: user.customer_identifier,
      name: `${user.first_name} ${user.last_name}`,
      firstName: user.first_name,
      email: user.email,
      business: user.business_name || `${user.first_name}’s Shop`,
      category: user.category,
      location: user.location,
      squadWallet: user.virtual_account_number || null,
      virtualAccountBank: user.virtual_account_bank || null,
    });
    return getUser();
  } catch {
    return null;
  }
}

// ── Transactions ────────────────────────────────────────────────
// Synchronous reader for dashboard panels. Returns whatever the backend
// last gave us — empty array for new/unauthed users — so the UI never
// displays fabricated history. MOCK_TXS is intentionally not used here.
export function getTxs() {
  return read(TXS_KEY) || [];
}

// Wallet balance from the live tx cache. Excludes loan disbursements
// (they don't move through the user's wallet — they go from the platform's
// merchant wallet straight to the user's personal bank).
const _isLoanDisbursement = (tx) =>
  ((tx?.name || '') + '').toLowerCase().startsWith('loan disbursement');

export function getWalletBalance() {
  const txs = getTxs();
  const inflow = txs
    .filter(t => t.type === 'in')
    .reduce((s, t) => s + (t.amount || 0), 0);
  const outflow = txs
    .filter(t => t.type === 'out' && !_isLoanDisbursement(t))
    .reduce((s, t) => s + (t.amount || 0), 0);
  return { available: Math.max(0, inflow - outflow), inflow, outflow };
}

// Async refresher: hits the backend, caches result, broadcasts an update event
// so any open panel can re-render. Non-throwing — falls back to whatever's cached.
// The /api/transactions response also includes a freshly-recomputed score, so
// we cache that and broadcast a score-update event in the same pass.
export async function refreshTxsFromServer() {
  if (!getCid()) return null;
  try {
    const resp = await api.transactions();
    if (Array.isArray(resp.transactions)) {
      write(TXS_KEY, resp.transactions);
      window.dispatchEvent(new CustomEvent('tradescore:txs-updated', { detail: resp.transactions }));
    }
    if (resp.score) {
      write(SCORE_KEY, resp.score);
      window.dispatchEvent(new CustomEvent('tradescore:score-updated', { detail: resp.score }));
    }
    // Stamp the moment we got real data back — used by the "Live · synced N min ago" pill.
    write(SYNC_KEY, new Date().toISOString());
    return resp.transactions;
  } catch {
    return null;
  }
}

export function onTxsUpdated(cb) {
  const handler = (ev) => cb(ev.detail);
  window.addEventListener('tradescore:txs-updated', handler);
  return () => window.removeEventListener('tradescore:txs-updated', handler);
}

// ── Score ───────────────────────────────────────────────────────
// Shape: { score, factors:[{label,weight,value,desc}], composite,
//          aggregates:{transactions,inflows,monthlyRevenue,growthPct,uniqueCustomers},
//          previous, delta }
export function getScore() {
  return read(SCORE_KEY) || null;
}

export async function refreshScoreFromServer() {
  if (!getCid()) return null;
  try {
    const score = await api.score();
    write(SCORE_KEY, score);
    window.dispatchEvent(new CustomEvent('tradescore:score-updated', { detail: score }));
    return score;
  } catch {
    return null;
  }
}

export function onScoreUpdated(cb) {
  const handler = (ev) => cb(ev.detail);
  window.addEventListener('tradescore:score-updated', handler);
  return () => window.removeEventListener('tradescore:score-updated', handler);
}

// ── AI insights (Claude-generated dashboard narratives) ─────────
// Returned by /api/insights and cached server-side. localStorage keeps the
// last successful response so a page reload doesn't even hit the backend
// when nothing has changed.
//
// Payload shape returned by the API:
//   { payload: { insight: {headline, body[]}, loan_why, alert_bodies[] },
//     loan_offer: {amount, rate, term, repaymentPct},
//     alert_skeletons: [{kind, title}],
//     cached: bool, model, usage }
export function getInsights() {
  return read(INSIGHTS_KEY) || null;
}

export async function refreshInsightsFromServer() {
  if (!getCid()) return null;
  try {
    const resp = await api.insights();
    if (resp && resp.payload) {
      write(INSIGHTS_KEY, resp);
      window.dispatchEvent(new CustomEvent('tradescore:insights-updated', { detail: resp }));
    }
    return resp;
  } catch (e) {
    // Silent fail — the dashboard falls back to templated narratives.
    return null;
  }
}

export function onInsightsUpdated(cb) {
  const handler = (ev) => cb(ev.detail);
  window.addEventListener('tradescore:insights-updated', handler);
  return () => window.removeEventListener('tradescore:insights-updated', handler);
}

// ── Inventory ──────────────────────────────────────────────────
// Backend-backed. localStorage is just a snappy cache so the UI updates
// instantly while the API call is in flight. The four mutating functions
// remain SYNCHRONOUS at the call site (UI snaps), but they also fire a
// background request to the server and broadcast a refresh event when it
// returns, so a slow network never blocks an edit.
function _saveInv(items) { write(INV_KEY, items); }
function _broadcastInv(items) {
  window.dispatchEvent(new CustomEvent('tradescore:inventory-updated', { detail: items }));
}

export function getInventory() {
  return read(INV_KEY) || [];
}

export function onInventoryUpdated(cb) {
  const h = (ev) => cb(ev.detail);
  window.addEventListener('tradescore:inventory-updated', h);
  return () => window.removeEventListener('tradescore:inventory-updated', h);
}

// Pulls the user's inventory from the server and rewrites the local cache.
// Called on boot; safe to call any time.
export async function refreshInventoryFromServer() {
  if (!getCid()) return null;
  try {
    const { items } = await api.inventory.list();
    _saveInv(items || []);
    _broadcastInv(items || []);
    return items;
  } catch { return null; }
}

// Optimistic add: shows the item locally with a temp id immediately, then
// replaces it with the server-assigned row when the API responds.
export function addInventoryItem(partial) {
  const tmpId = 'tmp_' + Date.now();
  const optimistic = { id: tmpId, qty: 1, ...partial };
  const next = [optimistic, ...getInventory()];
  _saveInv(next);
  _broadcastInv(next);

  if (getCid()) {
    api.inventory.add({ name: partial.name, category: partial.category, price: partial.price, qty: partial.qty })
      .then(({ item }) => {
        // Swap tmp item for the real server one
        const list = getInventory().map(it => it.id === tmpId ? item : it);
        _saveInv(list);
        _broadcastInv(list);
      })
      .catch(err => console.warn('[inventory.add] failed:', err));
  }
  return next;
}

export function updateInventoryItem(id, patch) {
  const next = getInventory().map(it => it.id === id ? { ...it, ...patch } : it);
  _saveInv(next);
  _broadcastInv(next);

  if (getCid() && typeof id === 'number') {
    api.inventory.update(id, patch).catch(err => console.warn('[inventory.update] failed:', err));
  }
  return next;
}

export function removeInventoryItem(id) {
  const next = getInventory().filter(it => it.id !== id);
  _saveInv(next);
  _broadcastInv(next);

  if (getCid() && typeof id === 'number') {
    api.inventory.remove(id).catch(err => console.warn('[inventory.remove] failed:', err));
  }
  return next;
}

// ── Preferences (notifications, AI tone, security PIN) ────────
// Pure localStorage — these aren't backend-synced. Used by the Profile
// panel's settings modals.
export function getPrefs() {
  return {
    notifications: { email: true, sms: false, push: true },
    ai: { tone: 'friendly', frequency: 'daily' },
    security: { pin: null, twoFA: false },
    ...(read(PREFS_KEY) || {}),
  };
}
export function savePrefs(partial) {
  const cur = getPrefs();
  const next = { ...cur, ...partial };
  write(PREFS_KEY, next);
  return next;
}

// ── Cash-sale ledger ──────────────────────────────────────────
// In-app cash sales recorded from the Inventory panel. These stack on top
// of backend transactions in the unified getAllTransactions() feed below.
export function getSales() { return read(SALES_KEY) || []; }

export function recordSale(item, qty = 1) {
  const items = getInventory();
  const found = items.find(i => i.id === item.id);
  if (!found || found.qty < qty) return { ok: false, reason: 'out_of_stock' };
  updateInventoryItem(item.id, { qty: found.qty - qty });
  const sale = {
    id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    itemId: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    qty,
    total: item.price * qty,
    at: Date.now(),
  };
  write(SALES_KEY, [sale, ...getSales()]);
  return { ok: true, sale };
}

export function getSalesToday() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return getSales().filter(s => s.at >= start.getTime());
}

function _saleToTx(s) {
  return {
    id: s.id,
    name: `${s.qty}× ${s.name}`,
    type: 'in',
    amount: s.total,
    time: _relativeTime(s.at),
    ref: 'INV-' + s.id.slice(-6).toUpperCase(),
    category: s.category,
    _sale: true,
    _at: s.at,
  };
}

function _relativeTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = ((hh + 11) % 12) + 1;
  const clock = `${h12}:${mm} ${ampm}`;
  if (sameDay) return `Today, ${clock}`;
  if (isYest) return `Yesterday, ${clock}`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' + clock;
}

// Unified transaction feed: in-app cash sales (newest first) + the live
// /api/transactions cache. Powers the Overview and Transactions panels.
export function getAllTransactions() {
  const sales = getSales().map(_saleToTx);
  return [...sales, ...getTxs()];
}

// ── Catalog of preset items per signup category ────────────────
export const CATALOG = {
  'Fashion':       ['T-shirt', 'Trouser', 'Ankara fabric', 'Lace fabric', 'Shoes', 'Bag', 'Wristwatch', 'Cap', 'Belt', 'Headtie', 'Senator wear', 'Aso-oke'],
  'Food & Drinks': ['Rice (50kg)', 'Beans (50kg)', 'Yam tuber', 'Cooking oil (5L)', 'Garri (bucket)', 'Bottled drink', 'Sachet water (bag)', 'Bread (loaf)', 'Pepper basket', 'Crate of eggs', 'Tomato basket', 'Plantain bunch'],
  'Electronics':   ['Phone charger', 'Earpiece', 'Power bank', 'USB cable', 'Phone case', 'Bluetooth speaker', 'Memory card', 'LED bulb', 'Extension box', 'Battery', 'HDMI cable', 'Iron'],
  'Beauty':        ['Body cream', 'Shampoo', 'Lipstick', 'Perfume', 'Hair extension', 'Soap', 'Powder', 'Hair cream', 'Deodorant', 'Nail polish', 'Hair dye', 'Body oil'],
  'Groceries':     ['Tomato paste', 'Maggi cube', 'Milo sachet', 'Indomie pack', 'Toothpaste', 'Salt (500g)', 'Sugar (500g)', 'Detergent', 'Tissue roll', 'Spaghetti', 'Cornflakes', 'Tinned milk'],
  'Other':         ['Service', 'Custom item'],
};
export const DEFAULT_PRICE = {
  'Fashion':       3500,
  'Food & Drinks': 1500,
  'Electronics':   2500,
  'Beauty':        2000,
  'Groceries':     800,
  'Other':         1000,
};
