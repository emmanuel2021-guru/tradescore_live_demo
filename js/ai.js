// ── Mock AI engine ────────────────────────────────────────────────
// Pretends to be a model. Returns deterministic but realistic responses
// so judges can experience the integration without an API key. Swap each
// function below with a real LLM call (Claude, GPT, etc.) when ready.
import { TRADER, TXS, FACTORS, REV, MONS } from './data.js';

// Simulated network latency (ms). Used by the chat panel for typing effect.
const MIN_DELAY = 450;
const MAX_DELAY = 950;
export const aiDelay = () =>
  new Promise(r => setTimeout(r, MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)));

// ── 1. Score insight ────────────────────────────────────────────
// "Why is my score 742?" — multi-factor, business-aware narrative.
export function generateScoreInsight() {
  const top = [...FACTORS].sort((a, b) => b.value - a.value)[0];
  const weak = [...FACTORS].sort((a, b) => a.value - b.value)[0];
  return {
    headline: `Your score is in the top 18% of Lagos market traders.`,
    body: [
      `${TRADER.firstName}, your TradeScore of ${TRADER.score} reflects ${TRADER.streak} months of strong, consistent inflows from ${TRADER.transactions} customers.`,
      `Your strongest factor is **${top.label}** (${top.value}/100) — ${top.desc.toLowerCase()}.`,
      `The biggest lift remaining is **${weak.label}** (${weak.value}/100). If you can grow this 6 points, your score should cross 760 within 4–6 weeks, unlocking the ₦1M tier at 1.8% / month.`,
    ],
    delta: '+12 points this week',
    confidence: 0.92,
  };
}

// ── 2. Loan recommendation ──────────────────────────────────────
// Suggests an amount + term grounded in the trader's cashflow pattern.
export function recommendLoan(purpose = 'stock') {
  const monthly = TRADER.monthlyRevenue;
  const safeRepayMonthly = Math.round(monthly * 0.18); // ~18% of revenue
  const recommended = Math.round(safeRepayMonthly * 2 / 5000) * 5000; // round to ₦5K

  const reasons = {
    stock: [
      'Stock-up loans match your inflow rhythm — you historically clear inventory in 35–45 days.',
      `At ₦${recommended.toLocaleString()}, monthly repayment stays under 18% of average revenue.`,
      'Lower default risk → 2.2% / month rate available.',
    ],
    rent: [
      'Rent loans should match your highest-income month so cash isn’t tight after.',
      'Your strongest months are typically Mar/Apr — schedule disbursement accordingly.',
    ],
    expansion: [
      'Expansion loans need 90+ day terms — your growth (+18.4% MoM) suggests this is sustainable.',
      'We project ₦1.06M monthly revenue by August — comfortably absorbs a ₦300K instalment.',
    ],
  };

  return {
    amount: Math.min(recommended * 2, TRADER.loanEligible || 1_000_000),
    term: '60 days',
    rate: 2.2,
    reasons: reasons[purpose] || reasons.stock,
    confidence: 0.88,
  };
}

// ── 3. Anomaly / opportunity alerts ─────────────────────────────
export function detectAlerts() {
  return [
    {
      kind: 'opportunity',
      icon: '🌱',
      title: 'Inflow spike detected',
      body: 'Customer payments jumped 24% over the last 7 days vs. your monthly average. This is a good window to re-stock — judging by the pattern, demand should hold for 10–14 more days.',
    },
    {
      kind: 'risk',
      icon: '⚠️',
      title: 'Outflow concentration',
      body: 'Stock purchases are 53% of outflows this month — historically you sit at ~38%. If a wholesaler delays, your buffer thins by Apr 26.',
    },
    {
      kind: 'tip',
      icon: '💡',
      title: 'Score boost available',
      body: 'Encouraging 8 more unique customers to pay via your Squad QR over the next 21 days will lift your Customer Diversity factor by 6+ points.',
    },
  ];
}

// ── 4. Auto-categorise a transaction ────────────────────────────
// Server categorises new transactions via Claude and persists the result in
// transactions.category. This function prefers the server-assigned category;
// the regex rules below are a fallback for the brief window between insert
// and the next refresh, and for unauthenticated demo previews.
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
  { match: /loan disbursement/i, category: 'Loan' },
  { match: /stock|wholesale|inventory/i, category: 'Inventory' },
  { match: /rent/i, category: 'Rent' },
  { match: /transport|fuel/i, category: 'Logistics' },
  { match: /electric|water|nepa/i, category: 'Utilities' },
];
export function categorize(tx) {
  if (tx.category) {
    return { category: tx.category, color: CAT_COLORS[tx.category] || CAT_COLORS.Other };
  }
  for (const r of CAT_RULES) {
    if (r.match.test(tx.name)) return { category: r.category, color: CAT_COLORS[r.category] };
  }
  return { category: 'Other', color: CAT_COLORS.Other };
}

// ── 5. Revenue forecast ─────────────────────────────────────────
// Linear projection from last 7 months — looks like an ML output.
export function forecastNextMonths(n = 3) {
  const xs = REV.map((_, i) => i);
  const ys = REV;
  const xm = xs.reduce((a, b) => a + b) / xs.length;
  const ym = ys.reduce((a, b) => a + b) / ys.length;
  const slope = xs.reduce((s, x, i) => s + (x - xm) * (ys[i] - ym), 0) /
                xs.reduce((s, x) => s + (x - xm) ** 2, 0);
  const intercept = ym - slope * xm;
  return Array.from({ length: n }, (_, i) => Math.round(intercept + slope * (xs.length + i)));
}

// ── 6. Conversational AI assistant ──────────────────────────────
// Light keyword router → contextual responses. Replace with a real
// LLM call (Claude / GPT) and the chat UI keeps working unchanged.
export async function chatRespond(message, _history = []) {
  await aiDelay();
  const m = message.toLowerCase();

  if (/score|trade.?score|credit/.test(m)) {
    const ins = generateScoreInsight();
    return `Your TradeScore is **${TRADER.score}** — ${ins.headline.toLowerCase()} The biggest single factor is your transaction volume (${FACTORS[0].value}/100). To push higher, focus on growing unique customers — 8 more this month adds about 6 points.`;
  }
  if (/loan|borrow|credit/.test(m)) {
    const r = recommendLoan('stock');
    return `Based on your cashflow, I'd recommend ₦${r.amount.toLocaleString()} over ${r.term} at ${r.rate}% / month. ${r.reasons[0]} Want me to draft the application?`;
  }
  if (/revenue|sales|income/.test(m)) {
    const f = forecastNextMonths(1)[0];
    return `Your average monthly revenue is ₦${(TRADER.monthlyRevenue || 0).toLocaleString()}, growing ${TRADER.growth}% MoM. My forecast for next month is ~₦${f.toLocaleString()} — a healthy continuation of the upward trend you've held since December.`;
  }
  if (/customer|client|payer/.test(m)) {
    return `You served ${TRADER.transactions} unique customer interactions this month, mostly between 11am–3pm. Repeat-customer rate is ~62% — strong for ${TRADER.business.toLowerCase()}. Promoting your Squad QR at the till would push Customer Diversity higher.`;
  }
  if (/rate|interest|fee/.test(m)) {
    return `Because your score is above 720, you qualify for our **Growth Credit** tier: 2.2% / month over 90 days. That's roughly 1/16th the cost of typical Nigerian loan apps for the same amount.`;
  }
  if (/repay|pay back|installment/.test(m)) {
    return `Repayments auto-debit from your Squad wallet on the day of each scheduled instalment — you don't have to remember anything. If your inflow dips, we offer a one-time grace period without affecting your score.`;
  }
  if (/help|how|what can/.test(m)) {
    return `I can help you understand your TradeScore, plan loans around your cashflow, spot risks in your spending pattern, and forecast your revenue. Try: *"How can I improve my score?"* or *"How much can I safely borrow?"*`;
  }
  if (/hi|hello|hey/.test(m)) {
    return `Hello ${TRADER.firstName}! I'm your TradeScore assistant. I've reviewed your last ${TRADER.transactions} transactions — your business is in great shape. What would you like to know?`;
  }
  // Default: echo a thoughtful, business-grounded answer.
  return `That's a good question. Based on what I see in your Squad data — ₦${(TRADER.monthlyRevenue || 0).toLocaleString()} monthly inflow, ${TRADER.streak}-month consistency streak, ${TRADER.growth}% growth — I'd give a more specific answer if you tell me more about what you're trying to do. Are you thinking about a loan, growth, or risk?`;
}

// ── 7. Streaming-style typed-out responder ──────────────────────
// Used by the chat panel: emits tokens char-by-char to feel like an LLM.
export async function* streamReply(text, charDelay = 14) {
  for (const ch of text) {
    yield ch;
    await new Promise(r => setTimeout(r, charDelay + Math.random() * 18));
  }
}
