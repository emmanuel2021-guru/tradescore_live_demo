// Server-Sent Events broadcaster.
//
// Each connected dashboard holds an open HTTP response keyed by user_id.
// When something happens to that user's data (new inflow, outflow,
// disbursement) we write a single `data: {...}` line to every connection
// for that user. The browser's EventSource emits a `message` event per line.
//
// We do NOT persist events — the dashboard always has a refresh path (poll
// /api/transactions, /api/score) that catches anything missed during a
// reconnect. SSE is purely the "feels live" layer.

const clients = new Map(); // userId → Set<res>

export function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
}

export function removeClient(userId, res) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (!set.size) clients.delete(userId);
}

export function broadcast(userId, event) {
  const set = clients.get(userId);
  if (!set || !set.size) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of set) {
    try { res.write(payload); }
    catch { set.delete(res); }
  }
}

export function clientCount(userId) {
  return clients.get(userId)?.size || 0;
}
