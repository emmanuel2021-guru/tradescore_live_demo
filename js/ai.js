// ── Local AI helpers (mock fallbacks for offline / unauthed paths) ──
// The real assistant runs on the backend via /api/chat (Claude). The helpers
// below stay around for two reasons:
//   1. Loans / Overview panels call recommendLoan() synchronously to render a
//      starter offer before the backend's Claude-narrated insight arrives.
//   2. assistant.js falls back to chatRespond() when the network is down.
// All numbers should come from the LIVE store (getUser + getScore), never
// from the all-null TRADER mock in data.js — otherwise we get "₦0" and
// "TradeScore null" leaking into the UI.

import { LOAN_TIERS, WORKER_LOAN_TIERS, WORKERS } from './data.js';
import { getUser, getScore } from './store.js';

// Picks the right product family based on user role. Traders see SME products
// (GT Smart Advance, MaxPlus, etc.); workers see microcredit (Starter Boost,
// Skills Loan, Asset Loan). Same TradeScore underwrites both.
export function loanTiersFor(role) {
  return role === 'worker' ? WORKER_LOAN_TIERS : LOAN_TIERS;
}

// Simulated network latency (ms). Used by the chat panel for typing effect.
const MIN_DELAY = 450;
const MAX_DELAY = 950;
export const aiDelay = () =>
  new Promise(r => setTimeout(r, MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)));

// ── 1. Score insight ────────────────────────────────────────────
export function generateScoreInsight() {
  const user = getUser();
  const live = getScore();
  const firstName = user.firstName || 'Hi';
  const score = live?.score;
  const factors = live?.factors || [];
  const agg = live?.aggregates || {};

  if (score == null) {
    return {
      headline: 'Your TradeScore will appear here once payments start landing.',
      body: [
        `${firstName}, your virtual account is ready — share it with your customers.`,
        `Once we see your **first 3 payments**, we compute a score on the 350–850 scale and explain every factor.`,
        `Try the **Receive money** button on the Overview tab to share your account, or simulate a test inflow.`,
      ],
      delta: null,
      confidence: 0.92,
    };
  }

  const top  = [...factors].sort((a, b) => b.value - a.value)[0];
  const weak = [...factors].sort((a, b) => a.value - b.value)[0];
  const txN = agg.transactions ?? 0;
  const uN  = agg.uniqueCustomers ?? 0;
  const body = [
    `${firstName}, your TradeScore of ${score} reflects ${txN} ${txN === 1 ? 'transaction' : 'transactions'} from ${uN} unique ${uN === 1 ? 'customer' : 'customers'} on your Squad virtual account.`,
  ];
  if (top)  body.push(`Your strongest factor is **${top.label}** (${top.value}/100) — ${top.desc.toLowerCase()}.`);
  if (weak && weak.label !== top?.label) {
    body.push(`The biggest lift remaining is **${weak.label}** (${weak.value}/100). A 6-point gain here typically lifts the score 8–10 points and could unlock a higher GTBank tier.`);
  }
  return {
    headline: score >= 750 ? `Your score is in the top tier — ${score}/850.`
            : score >= 650 ? `Solid base at ${score}/850 — room to climb.`
            :                `Early days at ${score}/850 — let's build it.`,
    body,
    delta: live?.delta ?? null,
    confidence: 0.92,
  };
}

// ── 2. Loan recommendation ──────────────────────────────────────
// Pulls real cashflow from the live store and picks an amount the user
// can comfortably repay. Falls back to a sensible starter offer for
// brand-new accounts (no inflows yet) instead of returning ₦0.
export function recommendLoan(purpose = 'stock') {
  const live    = getScore();
  const score   = live?.score ?? 700;
  const monthly = live?.aggregates?.monthlyRevenue ?? 0;
  const role    = getUser().role || 'trader';
  const tiers   = loanTiersFor(role);

  // Pick the lowest-rate tier the user qualifies for.
  const tier = [...tiers]
    .filter(t => score >= t.minScore)
    .sort((a, b) => a.rateMonthly - b.rateMonthly)[0] || tiers[0];

  // Workers cap at much smaller principals — match their earning rhythm.
  const minStarter = role === 'worker' ? 5_000  : 50_000;
  const fallback   = role === 'worker' ? 15_000 : 100_000;

  let amount;
  if (monthly > 0) {
    // 18% of monthly cashflow covers the instalment; back out the principal
    // for the tier's term, rounded to the nearest ₦1k (worker) / ₦5k (trader).
    const safeInstal = Math.round(monthly * 0.18);
    const months = Math.max(1, parseInt(tier.term, 10) || 12) /
                   (tier.term.includes('day') ? 30 : 1);
    const principal = Math.round((safeInstal * months) / (1 + tier.rateMonthly * months / 100));
    const round = role === 'worker' ? 1_000 : 5_000;
    amount = Math.min(tier.max, Math.max(minStarter, Math.round(principal / round) * round));
  } else {
    amount = Math.min(tier.max, fallback);
  }

  const workerReasons = [
    monthly > 0
      ? `${tier.name} matches your earning rhythm — at ₦${amount.toLocaleString('en-NG')}, the instalment stays under 18% of your ₦${monthly.toLocaleString('en-NG')} monthly gig income.`
      : `Complete a few more gigs to unlock larger tiers. Every gig paid via Squad lifts your TradeScore.`,
    `${tier.name} — ${tier.rateMonthly}% / month over ${tier.term}. ${tier.desc}.`,
    'Repayments auto-debit from your Squad wallet on each pay-out.',
  ];
  const traderReasons = {
    stock: [
      monthly > 0
        ? `Stock-up loans match your inflow rhythm — at ₦${amount.toLocaleString('en-NG')}, the monthly instalment stays under 18% of your ₦${monthly.toLocaleString('en-NG')} average revenue.`
        : `A small starter loan helps build a repayment history before larger tiers unlock. Send a few real payments first to qualify for more.`,
      `${tier.name} fits your TradeScore — ${tier.rateMonthly}% / month over ${tier.term}.`,
      'Repayments auto-debit from your Squad wallet — no missed instalments.',
    ],
    rent: [
      'Rent loans should match your highest-income month so cash isn\'t tight after.',
      'Your strongest months are typically Mar/Apr — schedule disbursement accordingly.',
    ],
    expansion: [
      'Expansion loans need 90+ day terms.',
      `At your current pace, repayment stays comfortable within the tier limit.`,
    ],
  };
  const reasons = role === 'worker'
    ? workerReasons
    : (traderReasons[purpose] || traderReasons.stock);

  return {
    amount,
    term: tier.term,
    rate: tier.rateMonthly,
    product: tier.name,
    reasons,
    confidence: 0.88,
  };
}

// ── 3. Anomaly / opportunity alerts ─────────────────────────────
export function detectAlerts() {
  return [
    { kind: 'opportunity', icon: '🌱', title: 'Inflow spike detected',
      body: 'Customer payments jumped 24% over the last 7 days vs. your monthly average. This is a good window to re-stock.' },
    { kind: 'risk', icon: '⚠️', title: 'Outflow concentration',
      body: 'Stock purchases are 53% of outflows this month — historically you sit at ~38%.' },
    { kind: 'tip', icon: '💡', title: 'Score boost available',
      body: 'Encouraging 8 more unique customers to pay via your Squad QR over the next 21 days will lift your Customer Diversity factor by 6+ points.' },
  ];
}

// ── 4. Auto-categorise a transaction ────────────────────────────
// Server categorises new transactions via Claude and persists the result in
// transactions.category. This function prefers the server-assigned category;
// the regex rules below are a fallback for the brief window between insert
// and the next refresh.
const CAT_COLORS = {
  'Sales':     '#27AE60',
  'Inventory': '#E89B2A',
  'Rent':      '#6C5CE7',
  'Logistics': '#1F8A65',
  'Utilities': '#E74C3C',
  'Loan':      '#0B6E4F',
  'Wages':     '#1F8A65',
  'Other':     '#9AA8A2',
};
const CAT_RULES = [
  { match: /customer payment|loan disbursement to/i, category: 'Sales' },
  { match: /loan disbursement/i,        category: 'Loan' },
  { match: /stock|wholesale|inventory/i, category: 'Inventory' },
  { match: /rent/i,                      category: 'Rent' },
  { match: /transport|fuel/i,            category: 'Logistics' },
  { match: /electric|water|nepa/i,       category: 'Utilities' },
];
export function categorize(tx) {
  if (tx.category) {
    return { category: tx.category, color: CAT_COLORS[tx.category] || CAT_COLORS.Other };
  }
  for (const r of CAT_RULES) {
    if (r.match.test(tx.name || '')) return { category: r.category, color: CAT_COLORS[r.category] };
  }
  return { category: 'Other', color: CAT_COLORS.Other };
}

// ── 5. Revenue forecast ─────────────────────────────────────────
// Linear projection from whatever revenue history the live score exposes,
// falling back to a flat projection when we have no data.
export function forecastNextMonths(n = 3) {
  const hist = getScore()?.aggregates?.revenueHistory || [];
  const ys = hist.map(h => h.value).filter(v => Number.isFinite(v));
  if (ys.length < 2) {
    const monthly = getScore()?.aggregates?.monthlyRevenue || 0;
    return Array.from({ length: n }, () => Math.round(monthly));
  }
  const xs = ys.map((_, i) => i);
  const xm = xs.reduce((a, b) => a + b) / xs.length;
  const ym = ys.reduce((a, b) => a + b) / ys.length;
  const slope = xs.reduce((s, x, i) => s + (x - xm) * (ys[i] - ym), 0) /
                xs.reduce((s, x) => s + (x - xm) ** 2, 0);
  const intercept = ym - slope * xm;
  return Array.from({ length: n }, (_, i) => Math.round(intercept + slope * (xs.length + i)));
}

// ── 6. Conversational fallback ──────────────────────────────────
// Only used when /api/chat is unreachable. Light keyword router → contextual
// responses, all grounded in live store data so we never echo "₦0" or
// "TradeScore null" when the network drops.
export async function chatRespond(message, _history = []) {
  await aiDelay();
  const m = message.toLowerCase();
  const user = getUser();
  const live = getScore();
  const firstName = user.firstName || 'there';
  const score = live?.score;
  const agg = live?.aggregates || {};
  const monthly = agg.monthlyRevenue;
  const txN = agg.transactions ?? 0;

  if (/score|trade.?score|credit/.test(m)) {
    if (score == null) {
      return `You don't have a TradeScore yet — we need a few payments to land in your virtual account first. Share your account number with a customer (or use **Receive money** on the Overview tab) and your score will appear within seconds of the first inflow.`;
    }
    const factors = live?.factors || [];
    const top = [...factors].sort((a, b) => b.value - a.value)[0];
    return `Your TradeScore is **${score}**, built from ${txN} ${txN === 1 ? 'transaction' : 'transactions'} on your Squad virtual account.${top ? ` Your strongest factor right now is **${top.label}** (${top.value}/100).` : ''} Growing unique customers and keeping inflows consistent are the fastest ways to push it higher.`;
  }
  if (/loan|borrow/.test(m)) {
    const r = recommendLoan('stock');
    return `Based on your cashflow, I'd recommend **₦${r.amount.toLocaleString('en-NG')}** over ${r.term} at ${r.rate}% / month (${r.product}). ${r.reasons[0]}`;
  }
  if (/revenue|sales|income/.test(m)) {
    if (!monthly) {
      return `I'll be able to forecast revenue once a few payments come in. Right now there's no inflow history to project from.`;
    }
    const f = forecastNextMonths(1)[0];
    const growth = agg.growthPct;
    return `Your monthly revenue is **₦${monthly.toLocaleString('en-NG')}**${growth != null ? `, ${growth > 0 ? 'growing' : 'down'} ${Math.abs(growth)}% MoM` : ''}. My forecast for next month is ~**₦${(f || monthly).toLocaleString('en-NG')}**.`;
  }
  if (/customer|client|payer/.test(m)) {
    const uN = agg.uniqueCustomers ?? 0;
    if (!uN) return `No unique customers yet — once payments start arriving I'll be able to break down repeat vs new payers.`;
    return `You've had **${uN}** unique payer${uN === 1 ? '' : 's'} so far across ${txN} ${txN === 1 ? 'transaction' : 'transactions'}. Growing this number lifts your Customer Diversity factor fastest.`;
  }
  if (/rate|interest|fee/.test(m)) {
    const tier = (score != null && [...LOAN_TIERS].filter(t => score >= t.minScore).sort((a, b) => a.rateMonthly - b.rateMonthly)[0]) || LOAN_TIERS[0];
    return `Your best GTBank rate right now is **${tier.rateMonthly}% / month** under **${tier.name}** (${tier.aprNote || ''}), up to ₦${tier.max.toLocaleString('en-NG')}. Higher TradeScores unlock cheaper tiers.`;
  }
  if (/repay|pay back|installment|instalment/.test(m)) {
    return `Repayments auto-debit from your Squad wallet on the day of each scheduled instalment — you don't have to remember anything. If your inflow dips, we offer a one-time grace period without affecting your score.`;
  }
  if (/help|how|what can/.test(m)) {
    return `I can explain your TradeScore, recommend a loan grounded in your cashflow, spot risks, and forecast your revenue. Try: *"How can I improve my score?"* or *"How much can I safely borrow?"*`;
  }
  if (/hi|hello|hey/.test(m)) {
    return score != null
      ? `Hello ${firstName}! I've reviewed your last ${txN} ${txN === 1 ? 'transaction' : 'transactions'} — TradeScore ${score}. What would you like to know?`
      : `Hello ${firstName}! Your dashboard is ready — once a few payments land we'll start grounding answers in real data. What would you like to know?`;
  }
  // Default
  return monthly
    ? `Based on your Squad data — ₦${monthly.toLocaleString('en-NG')} monthly across ${txN} ${txN === 1 ? 'transaction' : 'transactions'}${score != null ? `, TradeScore ${score}` : ''} — I can answer more specifically if you tell me whether you're thinking about a loan, growth, or risk.`
    : `Tell me a bit more about what you're trying to do — a loan, understanding your score, planning growth, or spotting risks. Once payments start landing I'll also have your real numbers to ground the advice in.`;
}

// ── 7. Worker matching (job-seeker side of the ecosystem) ───────
// Trader describes a gig in free text; we pick the best 3 workers from the
// pool by scoring skill overlap, proximity, rating, and language match.
// Same AI primitive as loan recommendation — different objective.
const SKILL_KEYWORDS = {
  delivery:        ['deliver', 'drop', 'send', 'bring', 'take to', 'courier'],
  'load-bearer':   ['load', 'heavy', 'lift', 'carry', 'bags', 'cartons'],
  'market-run':    ['market', 'balogun', 'idumota', 'mile 12', 'oyingbo', 'stock from'],
  'stock-running': ['stock', 'restock', 'replenish', 'inventory', 'goods'],
  errand:          ['errand', 'run', 'pick up', 'collect', 'fetch'],
  'shop-help':     ['shop', 'store', 'attend', 'help in', 'busy day', 'extra hand'],
  cashier:         ['cashier', 'till', 'collect payment', 'pos'],
  'customer-service': ['customer', 'serve', 'attend to'],
  'inventory-count':  ['count', 'audit', 'stocktake', 'stock take'],
  bookkeeping:     ['books', 'record', 'ledger', 'account'],
  'social-media':  ['post', 'instagram', 'whatsapp status', 'flyer', 'photo'],
  driver:          ['drive', 'car', 'long distance'],
};
function extractSkills(text) {
  const t = (text || '').toLowerCase();
  const hits = new Set();
  for (const [skill, words] of Object.entries(SKILL_KEYWORDS)) {
    if (words.some(w => t.includes(w))) hits.add(skill);
  }
  return [...hits];
}
export function matchWorkers(gigText, { maxResults = 3 } = {}) {
  const user = getUser();
  const traderLang = (user.language || 'English').toLowerCase();
  const requested = extractSkills(gigText);

  const scored = WORKERS.map(w => {
    const skillOverlap = requested.length
      ? requested.filter(s => w.skills.includes(s)).length / requested.length
      : 0.4; // no keywords picked up — give every worker a baseline shot
    const proximity = Math.max(0, 1 - w.distanceKm / 8); // 0km→1, 8km→0
    const rating = (w.rating - 4) / 1;                   // 4.0★→0, 5.0★→1
    const language = w.languages.some(l => l.toLowerCase() === traderLang) ? 1 : 0.5;

    const score = Math.round(
      (skillOverlap * 0.50 + proximity * 0.25 + rating * 0.15 + language * 0.10) * 100
    );

    const matchedSkills = requested.filter(s => w.skills.includes(s));
    const whyParts = [];
    if (matchedSkills.length) {
      whyParts.push(`matches ${matchedSkills.map(s => `**${s.replace(/-/g, ' ')}**`).join(' + ')}`);
    } else if (w.skills.length) {
      whyParts.push(`general fit (${w.skills.slice(0, 2).join(', ')})`);
    }
    whyParts.push(`${w.distanceKm}km away`);
    whyParts.push(`${w.rating}★ across ${w.gigsCompleted} gigs`);

    return { ...w, matchScore: score, why: whyParts.join(' · '), matchedSkills };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);
  return { requestedSkills: requested, candidates: scored.slice(0, maxResults) };
}

// ── 8. Streaming-style typed-out responder ──────────────────────
export async function* streamReply(text, charDelay = 14) {
  for (const ch of text) {
    yield ch;
    await new Promise(r => setTimeout(r, charDelay + Math.random() * 18));
  }
}
