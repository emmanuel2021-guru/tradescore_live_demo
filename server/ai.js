// Claude-powered TradeScore assistant.
//
// Strategy:
//   - Haiku 4.5 for fast, cheap chat.
//   - Prompt caching on the (large, stable) system prompt: ~5x cost reduction
//     across a multi-turn session because the same context is reused per turn.
//   - System prompt grounds every answer in the user's real Squad data
//     (profile, score, factors, last 50 transactions). The model never invents
//     numbers — they're all in the context.

import 'dotenv/config';
import crypto from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import db from './db.js';
import { computeScore } from './score.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL  = 'claude-haiku-4-5-20251001';

function buildContext(user) {
  const scoreResult = computeScore(user.id);
  const txs = db.prepare(`
    SELECT direction, amount_kobo, description, occurred_at
      FROM transactions WHERE user_id = ?
      ORDER BY occurred_at DESC LIMIT 50
  `).all(user.id);
  const inventory = db.prepare(`
    SELECT name, category, price_kobo, qty
      FROM inventory_items WHERE user_id = ?
      ORDER BY (price_kobo * qty) DESC
  `).all(user.id);

  const txLines = txs.map(t =>
    `  ${t.occurred_at}  ${t.direction === 'in' ? '+' : '-'}₦${(t.amount_kobo / 100).toLocaleString()}  from ${t.description}`
  ).join('\n') || '  (no transactions yet)';

  const factorLines = scoreResult.factors.map(f =>
    `  - ${f.label} (${f.weight}% weight): ${f.value}/100 — ${f.desc}`
  ).join('\n');

  const inventoryLines = inventory.length
    ? inventory.map(it =>
        `  - ${it.name} (${it.category || 'uncategorised'}): ₦${(it.price_kobo / 100).toLocaleString()}/unit × ${it.qty} in stock`
      ).join('\n')
    : '  (no inventory items recorded yet)';
  const inventoryTotalValue = inventory.reduce((s, it) => s + (it.price_kobo / 100) * it.qty, 0);

  return `
=== TRADER PROFILE ===
Name: ${user.first_name} ${user.last_name}
Business: ${user.business_name || '(not set)'}
Category: ${user.category || '(not set)'}
Location: ${user.location || '(not set)'}
Member since: ${user.created_at}
Squad virtual account: ${user.virtual_account_number || '(provisioning)'}

=== LIVE TRADESCORE ===
Score: ${scoreResult.score}/850
Aggregates:
  - Transactions on file: ${scoreResult.aggregates.transactions}
  - Total inflows: ${scoreResult.aggregates.inflows}
  - Average monthly revenue: ₦${(scoreResult.aggregates.monthlyRevenue || 0).toLocaleString()}
  - MoM growth: ${scoreResult.aggregates.growthPct != null ? scoreResult.aggregates.growthPct + '%' : 'not enough data'}
  - Unique customers: ${scoreResult.aggregates.uniqueCustomers}

5-Factor Breakdown:
${factorLines}

=== INVENTORY (${inventory.length} ${inventory.length === 1 ? 'item' : 'items'}, ₦${inventoryTotalValue.toLocaleString()} total stock value) ===
${inventoryLines}

=== RECENT TRANSACTIONS (last ${txs.length}) ===
${txLines}
`.trim();
}

const ROLE_PROMPT = `You are the TradeScore AI assistant — a financial coach for Nigerian market traders. You help traders understand their TradeScore (a 350-850 alternative-credit score built from their Squad virtual-account transactions) and make better business decisions.

Rules you MUST follow:
1. Every number you cite must be sourced from the context below. NEVER invent figures.
2. If the trader asks something you can't answer from the context, say so plainly. Don't bluff.
3. Speak directly and warmly — like a friend who happens to know finance. Keep responses tight (3-5 sentences typical, more only when explicitly asked to elaborate).
4. When recommending an action, tie it to a specific factor the trader can move (Transaction Volume, Payment Consistency, Business Growth, Account Longevity, or Customer Diversity).
5. Currency is Naira (₦). Don't translate to USD.
6. Markdown is OK (**bold**, line breaks) but keep formatting minimal.`;

export async function chat({ user, message, history = [] }) {
  const context = buildContext(user);

  // History from the client comes as [{role, content}], no caching markers.
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: [
      // Role is small and stable — cache it.
      { type: 'text', text: ROLE_PROMPT, cache_control: { type: 'ephemeral' } },
      // Per-user data block — large and reused across a session, so cache it too.
      // (Claude allows up to 4 cache breakpoints; we use 2.)
      { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
    ],
    messages,
  });

  const text = resp.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  return {
    text,
    usage: resp.usage,
    model: MODEL,
  };
}

// ── Transaction categorisation ─────────────────────────────────
// Batch-categorises a list of transactions in one Claude call. We do this
// once per new-tx batch and persist the result in transactions.category, so
// repeated dashboard loads never re-call Claude for the same tx.
const CATEGORIZE_SYSTEM = `You categorise Nigerian SME transactions for a credit-scoring app.

You will receive a JSON array of transactions. For each one, assign EXACTLY ONE category from:
- Sales — inbound customer payments for goods/services
- Inventory — outbound payments for stock, raw materials, wholesale purchases
- Rent — rent, shop fees, market fees
- Logistics — transport, fuel, delivery, shipping
- Utilities — electricity, water, internet, phone, NEPA
- Loan — loan disbursements or repayments
- Wages — staff salaries or stipends
- Other — anything not fitting above

Rules:
- An inflow from a Nigerian personal name (e.g. "Tobi Achebe", "Aisha Lawal") is almost always Sales.
- An outflow with "Loan disbursement to ..." is Loan.
- "Rent Payment", "Stock Purchase", "Electricity Bill" map directly.
- When the description is ambiguous, prefer Sales for inflows and Other for outflows.

Output STRICT JSON only — no surrounding text, no code fences. A single array, one entry per input transaction in the SAME order, with the schema:
[{"ref": "<input ref>", "category": "<one of the categories above>"}]`;

export async function categorizeTransactionsBatch(txs) {
  if (!Array.isArray(txs) || !txs.length) return [];

  const compact = txs.map(t => ({
    ref: t.ref,
    direction: t.direction,
    amount: t.amount,
    description: t.description,
  }));

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: [
      { type: 'text', text: CATEGORIZE_SYSTEM, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: JSON.stringify(compact) }],
  });

  const raw = resp.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[categorize] Claude returned non-JSON:', cleaned.slice(0, 200));
    return [];
  }
}

// ── Gig matching (Claude) ──────────────────────────────────────
// Claude ranks a pool of onboarded workers against a free-text gig
// description. We pass minimal worker context (id, name, bio, score, gigs
// completed, location) and Claude returns a structured ranking with
// natural-language reasoning. This is the "intelligent matching" layer
// Challenge 02's brief asks for — same engine that powers the chat.
const MATCH_SYSTEM = `You match Nigerian informal-economy gig requests to a pool of vetted workers.

You will receive:
1. A short free-text description of the gig (what the trader needs done).
2. A JSON array of candidate workers, each with: id, name, bio (their skills in free text), location, tradeScore (350-850), gigsCompleted, distanceKm.

For each candidate, score how well they fit the gig from 0 to 100. Consider:
- Skill match: does their bio mention the kind of work the gig needs?
- Distance: closer is better (under 3km is excellent, over 6km is weak).
- Track record: more gigs completed = more reliable.
- TradeScore: workers with higher scores have proven payment-history reliability.

Output STRICT JSON only — no surrounding text, no code fences. Schema:
{
  "matches": [
    {
      "id": "<worker id from input>",
      "match_score": <integer 0-100>,
      "matched_skills": ["delivery", "market-run", ...],
      "why": "1 short sentence explaining the rank (max 110 chars). Mention the key skill match and one other signal (distance, track record, or score)."
    }
  ]
}

Return ALL candidates sorted by match_score descending. Don't drop any.`;

export async function matchWorkersWithAI({ gigText, workers, amount }) {
  if (!gigText || !Array.isArray(workers) || !workers.length) {
    return { matches: [], source: 'empty' };
  }
  const compact = workers.map(w => ({
    id:            w.id,
    name:          w.name,
    bio:           w.bio,
    location:      w.location,
    tradeScore:    w.tradeScore,
    gigsCompleted: w.gigsCompleted,
    distanceKm:    w.distanceKm,
  }));

  const userMsg = JSON.stringify({ gig: gigText, amount_naira: amount, candidates: compact });

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: [
        { type: 'text', text: MATCH_SYSTEM, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userMsg }],
    });
    const raw = resp.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed?.matches || !Array.isArray(parsed.matches)) {
      throw new Error('No matches array in response');
    }
    return { matches: parsed.matches, source: 'claude', usage: resp.usage, model: MODEL };
  } catch (e) {
    console.warn('[match] Claude matching failed:', e.message);
    return { matches: [], source: 'error', error: e.message };
  }
}

// ── Dashboard insights ─────────────────────────────────────────
// Generates Claude-written narratives for three dashboard cards (AI Insight
// banner, loan recommendation "why", smart-alert bodies) in ONE call returning
// structured JSON. Aggressively cached at three levels:
//   1. DB cache keyed by hash of score state — if nothing material changed,
//      no API call is made at all.
//   2. Anthropic prompt caching on the (stable) system prompt — first call
//      writes the cache, subsequent ones read it for ~5x cost reduction.
//   3. Frontend persists the response in localStorage to skip even the DB
//      round-trip on page reloads (see js/store.js).

const INSIGHTS_SYSTEM = `You are TradeScore's dashboard analyst — you write concise, accurate copy for cards on a Nigerian fintech app for informal market traders.

Rules:
- Every number you write must appear in the input. Never invent figures.
- Use Nigerian Naira (₦) for currency.
- Address the trader by first name.
- Markdown **bold** is fine. No headers, no lists in body text.
- Stay within the character limits implied below.

You will receive: the trader's TradeScore, factor breakdown, 30-day aggregates, a recommended loan offer, a list of alert kinds + titles needing body copy, a list of boost-tip skeletons, and (when present) a list of inventory items.

Output STRICT JSON only — no surrounding text, no code fences. Schema:
{
  "insight": {
    "headline": "string ≤ 70 chars, references the score and tone",
    "body": ["paragraph 1", "paragraph 2", "paragraph 3"]
  },
  "loan_why": "1–2 sentences explaining the recommended amount in terms of cashflow safety",
  "alert_bodies": ["string for alert 1", "string for alert 2", ...],
  "boost_tips": ["one-sentence action for tip 1", "one-sentence action for tip 2", ...],
  "restock_tips": [
    { "item": "<exact item name from input>", "suggested_units": <integer>, "estimated_cost": <number, naira>, "reason": "one short sentence" }
  ]
}

For "insight.body": paragraph 1 — what the score reflects. Paragraph 2 — strongest factor with value. Paragraph 3 — biggest lever with value and one action.

For "boost_tips": one short, concrete sentence per skeleton (in the same order). The sentence must name the specific action this trader can take in the next 30 days to move that factor from its current value to the target. Use Nigerian market context (e.g. "Squad QR at the till", "WhatsApp Status with payment link", "repeat-buy discount for 10 unique customers"). Do not restate the factor name or the numbers — just the action.

For "restock_tips": output up to 3 entries. Pick items the trader should re-stock soon based on: total inventory value tied up, monthly revenue (don't recommend cost > 30% of monthly revenue), and stock levels (lower qty = higher priority). Use the EXACT item name from the input. "suggested_units" is the number of additional units to buy. "estimated_cost" = suggested_units × unit price. "reason" is one sentence saying WHY this item now (sales velocity, low stock, high margin). If there are no inventory items, return an empty array.`;

function buildInsightsUserMessage(user, scoreResult, loanOffer, alertSkeletons, boostSkeletons, inventory) {
  const agg = scoreResult.aggregates || {};
  const factorLines = (scoreResult.factors || []).map(f =>
    `- ${f.label}: ${f.value}/100 (${f.weight}% weight)`
  ).join('\n');
  const alertsBlock = (alertSkeletons || []).length
    ? `\n\nALERTS NEEDING BODY COPY (write one body sentence for each, in order):\n` +
      alertSkeletons.map((a, i) => `${i + 1}. kind=${a.kind} · title="${a.title}"`).join('\n')
    : '';
  const boostBlock = (boostSkeletons || []).length
    ? `\n\nBOOST-TIP SKELETONS (write one action sentence for each, in order):\n` +
      boostSkeletons.map((b, i) =>
        `${i + 1}. ${b.factor}: currently ${b.current}/100, target ${b.target}/100 (gain ≈ +${b.gainPoints} score points)`
      ).join('\n')
    : '';
  const inventoryBlock = (inventory || []).length
    ? `\n\nINVENTORY (${inventory.length} ${inventory.length === 1 ? 'item' : 'items'}):\n` +
      inventory.map(it =>
        `- ${it.name} (${it.category || 'uncategorised'}): ₦${(it.price || 0).toLocaleString()}/unit × ${it.qty} in stock = ₦${((it.price || 0) * it.qty).toLocaleString()} value`
      ).join('\n')
    : '\n\nINVENTORY: (none recorded yet — return restock_tips: [])';

  return `${user.first_name || 'The trader'} runs ${user.business_name || 'a small business'}${user.location ? ' in ' + user.location : ''}.

TRADESCORE: ${scoreResult.score}/850
${factorLines}

LAST 30 DAYS: ${agg.transactions || 0} transactions, ₦${(agg.monthlyRevenue || 0).toLocaleString()} inflow, ${agg.uniqueCustomers || 0} unique payers${agg.growthPct != null ? `, ${agg.growthPct}% MoM growth` : ''}.

LOAN OFFER: ₦${(loanOffer.amount || 0).toLocaleString()} over ${loanOffer.term} at ${loanOffer.rate}%/month. Monthly repayment ≈ ${loanOffer.repaymentPct}% of revenue.${alertsBlock}${boostBlock}${inventoryBlock}

Return the JSON now.`;
}

function buildCacheKey(user, scoreResult, loanOffer, alertSkeletons, boostSkeletons, inventory) {
  const sig = {
    s: scoreResult.score,
    f: (scoreResult.factors || []).map(f => f.value),
    a: scoreResult.aggregates,
    l: { amt: loanOffer.amount, rate: loanOffer.rate, term: loanOffer.term },
    al: (alertSkeletons || []).map(a => `${a.kind}:${a.title}`),
    bs: (boostSkeletons || []).map(b => `${b.factor}:${b.current}->${b.target}`),
    iv: (inventory || []).map(it => `${it.name}:${it.qty}:${it.price}`),
  };
  return crypto.createHash('sha256').update(JSON.stringify(sig)).digest('hex').slice(0, 24);
}

export async function generateDashboardInsights({ user, scoreResult, loanOffer, alertSkeletons, boostSkeletons, inventory }) {
  // No score → no narratives. Frontend handles its own empty state.
  if (!scoreResult || scoreResult.score == null) {
    return { cached: false, skipped: true, payload: null };
  }

  const cacheKey = buildCacheKey(user, scoreResult, loanOffer, alertSkeletons, boostSkeletons, inventory);
  const cached = db.prepare(`
    SELECT payload_json, model, usage_json FROM insights_cache
    WHERE user_id = ? AND cache_key = ?
  `).get(user.id, cacheKey);

  if (cached) {
    return {
      cached: true,
      cache_key: cacheKey,
      payload: JSON.parse(cached.payload_json),
      model: cached.model,
      usage: cached.usage_json ? JSON.parse(cached.usage_json) : null,
    };
  }

  // Cache miss → call Claude with prompt caching on the system message.
  const userMessage = buildInsightsUserMessage(user, scoreResult, loanOffer, alertSkeletons, boostSkeletons, inventory);

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: [
      { type: 'text', text: INSIGHTS_SYSTEM, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  const rawText = resp.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  // Strip code fences if Claude wrapped the JSON despite instructions.
  const cleaned = rawText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();

  let payload;
  try {
    payload = JSON.parse(cleaned);
  } catch (e) {
    console.warn('[insights] Claude returned non-JSON; aborting cache:', cleaned.slice(0, 200));
    return { cached: false, error: 'parse_failed', raw: cleaned, payload: null };
  }

  // Persist for future hits
  db.prepare(`
    INSERT INTO insights_cache (user_id, cache_key, payload_json, model, usage_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    user.id,
    cacheKey,
    JSON.stringify(payload),
    MODEL,
    JSON.stringify(resp.usage || {}),
  );

  return {
    cached: false,
    cache_key: cacheKey,
    payload,
    model: MODEL,
    usage: resp.usage,
  };
}
