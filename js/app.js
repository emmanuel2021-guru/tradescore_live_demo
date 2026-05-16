import { init, register, start } from './router.js';
import { Landing } from './pages/landing.js';
import { Signup }  from './pages/signup.js';
import { Login }   from './pages/login.js';
import { Shell }   from './dashboard/shell.js';
import { refreshUserFromServer, refreshTxsFromServer, refreshScoreFromServer, refreshInsightsFromServer, refreshInventoryFromServer, onScoreUpdated, onInventoryUpdated } from './store.js';
import { openEventStream } from './api.js';
import { toastForInflow, toastForOutflow, toastForScore } from './toast.js';

console.log('[app] boot', new Date().toISOString(), 'path=', location.pathname);

// Fire-and-forget: pull the latest user, then transactions (which also
// recompute + return the score), then a final score refresh, then the
// inventory, then Claude-generated insights (which the backend caches by
// score+inventory state — no API call when nothing has changed).
refreshUserFromServer()
  .then(() => refreshTxsFromServer())
  .then(() => refreshScoreFromServer())
  .then(() => refreshInventoryFromServer())
  .then(() => refreshInsightsFromServer());

// Whenever the score genuinely changes, regenerate insights. The server
// cache prevents repeated Claude calls for the same score state.
let lastSeenScore = null;
onScoreUpdated((s) => {
  const sig = s ? `${s.score}|${(s.factors || []).map(f => f.value).join(',')}` : null;
  if (sig && sig !== lastSeenScore) {
    lastSeenScore = sig;
    refreshInsightsFromServer();
  }
});

// Same idea for inventory: when items change, restock_tips may need to
// regenerate. The server cache prevents repeats when the signature matches.
let lastSeenInv = null;
onInventoryUpdated((items) => {
  const sig = (items || [])
    .filter(it => typeof it.id === 'number') // skip optimistic temp items
    .map(it => `${it.id}:${it.qty}:${it.price}`).join('|');
  if (sig !== lastSeenInv) {
    lastSeenInv = sig;
    refreshInsightsFromServer();
  }
});

// ── Real-time push from backend (SSE) ───────────────────────────
// Opens an EventSource when signed in; reconnects on drop. Every server-side
// money event (inflow / outflow) triggers a toast and refreshes the tx store
// so the bell badge + transactions list + score all update without a poll.
let _es = null;
let _esRetryMs = 1500;
function connectEvents() {
  if (!localStorage.getItem('tradescore_cid')) return;
  if (_es) { try { _es.close(); } catch {} }

  _es = openEventStream();
  if (!_es) return;

  _es.addEventListener('open', () => { _esRetryMs = 1500; });

  _es.addEventListener('message', (e) => {
    let ev = null;
    try { ev = JSON.parse(e.data); } catch { return; }
    if (!ev || !ev.kind) return;

    if (ev.kind === 'inflow') {
      toastForInflow({ amount: ev.amount, sender: ev.sender });
      refreshTxsFromServer();
    } else if (ev.kind === 'outflow') {
      toastForOutflow({
        amount: ev.amount, recipient: ev.recipient,
        demo: ev.demo, reason: ev.reason,
      });
      refreshTxsFromServer();
    } else if (ev.kind === 'score_changed') {
      toastForScore({ score: ev.score, delta: ev.delta });
    }
  });

  _es.addEventListener('error', () => {
    try { _es.close(); } catch {}
    _es = null;
    // Exponential-ish backoff, capped at 30s
    setTimeout(connectEvents, _esRetryMs);
    _esRetryMs = Math.min(_esRetryMs * 1.6, 30_000);
  });
}
connectEvents();

const app = document.getElementById('app');
init(app);

// Public pages
register('/',         (ctx) => Landing(ctx));
register('/signup',   (ctx) => Signup(ctx));
register('/login',    (ctx) => Login(ctx));

// Dashboard panels — all share the same shell, just different inner panel.
// Auth-guarded: if there's no customer_identifier in localStorage we bounce to
// /login so an unauthenticated user never sees the dashboard with stale/mock data.
const DASH_PATH = /^\/app(?:\/(?<panel>overview|score|loans|inventory|transactions|assistant|network|profile))?$/;
register(DASH_PATH, (ctx) => {
  if (!localStorage.getItem('tradescore_cid')) {
    queueMicrotask(() => ctx.navigate('/login'));
    return Shell({ panel: 'overview', navigate: ctx.navigate }); // brief shell while redirecting
  }
  return Shell({
    panel: ctx.params.panel || 'overview',
    navigate: ctx.navigate,
  });
});

// Hide the pre-JS loader once routes are wired.
const loader = document.getElementById('loading');
if (loader) {
  loader.classList.add('hidden');
  setTimeout(() => loader.remove(), 400);
}

start();
