// TradeScore engine — computes a 350–850 credit score from the user's
// transaction history (sourced from Squad virtual-account inflows).
//
// 5 factors with the same weights the frontend pitches in the UI:
//   30% Transaction Volume
//   25% Payment Consistency
//   20% Business Growth
//   15% Account Longevity
//   10% Customer Diversity
//
// All factor functions return 0–100. The weighted composite is then mapped
// to the 350–850 band so a first-time user gets a recognisable starting score
// instead of an embarrassing 0.

import db from './db.js';

const MS_PER_DAY   = 1000 * 60 * 60 * 24;
const MS_PER_WEEK  = MS_PER_DAY * 7;
const MS_PER_MONTH = MS_PER_DAY * 30;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const monthsAgo = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return 0;
  return (Date.now() - d.getTime()) / MS_PER_MONTH;
};

function getUserTxs(userId) {
  return db.prepare(`
    SELECT direction, amount_kobo, description, occurred_at
      FROM transactions
     WHERE user_id = ?
     ORDER BY occurred_at ASC
  `).all(userId);
}

// 1. Transaction Volume — average monthly inflow, log-scaled.
//    ₦10K/mo → ~30, ₦100K/mo → ~60, ₦1M/mo → ~85, ₦10M/mo → ~100
function transactionVolume(inflows) {
  if (!inflows.length) return 25;
  const firstMs = new Date(inflows[0].occurred_at).getTime();
  const months  = Math.max(1, (Date.now() - firstMs) / MS_PER_MONTH);
  const total   = inflows.reduce((s, t) => s + t.amount_kobo / 100, 0);
  const monthly = total / months;
  return Math.round(clamp(30 + 20 * Math.log10(Math.max(1000, monthly) / 1000), 0, 100));
}

// 2. Payment Consistency — inverse coefficient of variation across weeks.
//    Steady weekly inflows → high score. Spiky → low.
//    Sparse data (1-2 inflows) → scales 15→30 instead of jumping to 50.
function paymentConsistency(inflows) {
  if (inflows.length === 0) return 0;
  if (inflows.length < 3)   return 15 + inflows.length * 7;
  const weekly = {};
  inflows.forEach(t => {
    const wk = Math.floor(new Date(t.occurred_at).getTime() / MS_PER_WEEK);
    weekly[wk] = (weekly[wk] || 0) + t.amount_kobo / 100;
  });
  const vals = Object.values(weekly);
  if (vals.length < 2) return 50;
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  if (mean === 0) return 50;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.round(clamp(100 - cv * 60, 0, 100));
}

// 3. Business Growth — MoM revenue slope, normalised to %.
//    0% growth → 50, +20%/mo → ~85, -20%/mo → ~15.
//    Sparse data → low default; can't measure growth without ≥2 months.
function businessGrowth(inflows) {
  if (inflows.length === 0) return 0;
  if (inflows.length < 5)   return 25;
  const monthly = {};
  inflows.forEach(t => {
    const d = new Date(t.occurred_at);
    const k = d.getFullYear() * 12 + d.getMonth();
    monthly[k] = (monthly[k] || 0) + t.amount_kobo / 100;
  });
  const keys = Object.keys(monthly).map(Number).sort((a, b) => a - b);
  if (keys.length < 2) return 50;
  const ys = keys.map(k => monthly[k]);
  const xs = ys.map((_, i) => i);
  const xm = xs.reduce((s, v) => s + v, 0) / xs.length;
  const ym = ys.reduce((s, v) => s + v, 0) / ys.length;
  const num = xs.reduce((s, x, i) => s + (x - xm) * (ys[i] - ym), 0);
  const den = xs.reduce((s, x) => s + (x - xm) ** 2, 0);
  if (den === 0 || ym === 0) return 50;
  const slope = num / den;
  const pctMoM = (slope / ym) * 100;
  return Math.round(clamp(50 + pctMoM * 1.75, 0, 100));
}

// 4. Account Longevity — months since first inflow.
//    0 mo → 10, 6 mo → ~45, 12 mo → ~70, 24+ mo → 95.
function accountLongevity(allTxs) {
  if (!allTxs.length) return 10;
  const months = monthsAgo(allTxs[0].occurred_at);
  return Math.round(clamp(10 + months * 5.5, 10, 95));
}

// 5. Customer Diversity — unique senders in last 30 days, log-scaled.
function customerDiversity(inflows) {
  const cutoff = Date.now() - MS_PER_MONTH;
  const recent = inflows.filter(t => new Date(t.occurred_at).getTime() >= cutoff);
  const senders = new Set(recent.map(t => t.description));
  const n = senders.size;
  if (n === 0) return 15;
  return Math.round(clamp(15 + Math.log10(n) * 35, 15, 95));
}

const WEIGHTS = [
  { label: 'Transaction Volume',  weight: 30, fn: transactionVolume,  desc: 'Average monthly inflow size' },
  { label: 'Payment Consistency', weight: 25, fn: paymentConsistency, desc: 'Stability of weekly inflows' },
  { label: 'Business Growth',     weight: 20, fn: businessGrowth,     desc: 'Month-over-month revenue trend' },
  { label: 'Account Longevity',   weight: 15, fn: accountLongevity,   desc: 'Months since first inflow' },
  { label: 'Customer Diversity',  weight: 10, fn: customerDiversity,  desc: 'Unique payers in the last 30 days' },
];

// Maps composite 0–100 → 350–850
const scoreFromComposite = (c) => Math.round(350 + c * 5);

export function computeScore(userId) {
  return computeScoreFromTxs(getUserTxs(userId));
}

// Same scoring logic, but operates on a caller-supplied tx list. Used by the
// score-history endpoint to compute a *retrospective* score at each past
// month-end by filtering txs up to that date — that's what the "Your
// TradeScore journey" chart on the Loans panel renders.
export function computeScoreFromTxs(allTxs) {
  const inflows = allTxs.filter(t => t.direction === 'in');

  // No inflows → no credit signal. Returning null tells the UI to show
  // "—" / empty state instead of fabricating a mid-tier score. This matches
  // how real bureaus handle "credit invisibles": no file → no score.
  if (inflows.length === 0) {
    return {
      score: null,
      factors: WEIGHTS.map(w => ({ label: w.label, weight: w.weight, value: 0, desc: w.desc })),
      composite: 0,
      aggregates: {
        transactions: allTxs.length,
        inflows: 0,
        monthlyRevenue: 0,
        growthPct: null,
        uniqueCustomers: 0,
      },
    };
  }

  const factors = WEIGHTS.map(w => {
    const value = w.fn(w.label === 'Account Longevity' ? allTxs : inflows);
    return { label: w.label, weight: w.weight, value, desc: w.desc };
  });

  const composite = factors.reduce((s, f) => s + f.value * (f.weight / 100), 0);
  const score = clamp(scoreFromComposite(composite), 350, 850);

  // Convenience aggregates the dashboard panels reuse
  const monthlyRevenue = (() => {
    if (!inflows.length) return 0;
    const firstMs = new Date(inflows[0].occurred_at).getTime();
    const months  = Math.max(1, (Date.now() - firstMs) / MS_PER_MONTH);
    return Math.round(inflows.reduce((s, t) => s + t.amount_kobo / 100, 0) / months);
  })();

  const growthPct = (() => {
    if (inflows.length < 5) return null;
    const monthly = {};
    inflows.forEach(t => {
      const d = new Date(t.occurred_at);
      const k = d.getFullYear() * 12 + d.getMonth();
      monthly[k] = (monthly[k] || 0) + t.amount_kobo / 100;
    });
    const keys = Object.keys(monthly).map(Number).sort((a, b) => a - b);
    if (keys.length < 2) return null;
    const last = monthly[keys[keys.length - 1]];
    const prev = monthly[keys[keys.length - 2]];
    if (!prev) return null;
    return Math.round(((last - prev) / prev) * 1000) / 10;
  })();

  const uniqueCustomers = new Set(inflows.map(t => t.description)).size;

  // Revenue history — last 7 calendar months of inflow totals. Empty months
  // are emitted as zero so the chart renders a continuous timeline instead
  // of collapsing gaps. Powers the Overview "Revenue trend" chart.
  const revenueHistory = (() => {
    const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const buckets = {};
    inflows.forEach(t => {
      const d = new Date(t.occurred_at);
      const k = d.getFullYear() * 12 + d.getMonth();
      buckets[k] = (buckets[k] || 0) + t.amount_kobo / 100;
    });
    const now = new Date();
    const currentKey = now.getFullYear() * 12 + now.getMonth();
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const k = currentKey - i;
      const month = ((k % 12) + 12) % 12;
      out.push({ label: MONTH_LABELS[month], value: Math.round(buckets[k] || 0) });
    }
    return out;
  })();

  return {
    score,
    factors,
    composite: Math.round(composite),
    aggregates: {
      transactions: allTxs.length,
      inflows: inflows.length,
      monthlyRevenue,
      growthPct,
      uniqueCustomers,
      revenueHistory,
    },
  };
}

// Computes + persists a snapshot, returning the result with the previous
// score (if any) so the UI can show "+N pts" deltas.
// Skips persistence entirely when the score is null (no inflows yet) — the
// snapshots table is for tracking real score history, not "no data" rows.
export function recomputeAndSave(userId) {
  const prevRow = db.prepare(`
    SELECT score FROM score_snapshots WHERE user_id = ? ORDER BY id DESC LIMIT 1
  `).get(userId);
  const previous = prevRow?.score ?? null;

  const result = computeScore(userId);

  if (result.score != null) {
    db.prepare(`
      INSERT INTO score_snapshots (user_id, score, factors_json) VALUES (?, ?, ?)
    `).run(userId, result.score, JSON.stringify(result.factors));
  }

  return {
    ...result,
    previous,
    delta: (previous == null || result.score == null) ? null : result.score - previous,
  };
}
