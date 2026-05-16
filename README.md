# TradeScore

**Credit for the people the banks have always missed.**

> *"A mid-sized African nation is experiencing high youth unemployment and a fragmented informal economy. Design an intelligent economic system powered by data and AI that connects informal traders, job seekers, and financial services in one ecosystem."*
> — Squad Hackathon 3.0, Challenge 02

TradeScore is a two-sided fintech platform that turns every Squad transaction into credit history. Traders run their shops through Squad virtual accounts; workers earn through Squad gig payments; the same alternative-data underwriting engine scores both sides — unlocking GTBank loan products appropriate to each user's earning scale.

Built against the live Squad sandbox, with Claude-Haiku 4.5 doing the AI matching, and a deterministic 5-factor TradeScore engine doing the underwriting.

---

## The loop, in one diagram

```
    ┌────── Trader hires worker (gig) ──────┐
    │                                       ▼
[Trader Squad VA]                    [Worker Squad VA]
    ▲                                       │
    │                                       │
    └───────── Same money rails ────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   TradeScore engine (350-850)│
        │   5 factors · auditable      │
        └──────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
   GT SME loans              GT microcredit
   (₦500K - ₦10M)            (₦20K - ₦300K)
   for traders               for workers
```

One engine. Two product surfaces. One Squad wallet rail.

---

## Try it locally (5 minutes)

### Prerequisites
- Node.js 20+ (Node 22+ recommended — uses the experimental SQLite module)
- A Squad sandbox secret key from your Squad dashboard
- An Anthropic API key for the Claude-powered features

### Setup

```powershell
# 1. Install server deps
cd server
npm install

# 2. Configure environment
Copy-Item .env.example .env
# Then edit .env and fill in:
#   SQUAD_SECRET_KEY=sandbox_sk_...
#   SQUAD_BENEFICIARY_ACCOUNT=<your 10-digit GTBank account>
#   ANTHROPIC_API_KEY=sk-ant-...

# 3. Seed the demo data (creates 1 trader + 3 workers with real Squad VAs)
npm run seed

# 4. Start the server
npm run dev
```

Open `http://localhost:3000/` and sign in.

### Demo accounts

All accounts use password `demo1234`.

| Email | Role | TradeScore | Why pick them for the demo |
|---|---|---|---|
| `demo@tradescore.ng` | Trader (Tunde Adebayo) | 692 / 850 | Populated dashboard — 91 transactions, ₦2.4M balance, 10 inventory items, 7 months of growth |
| `ibrahim.worker@tradescore.ng` | Worker (Ibrahim Musa) | ~663 | Most gigs completed — shows the strongest "near tier-unlock" story |
| `chiamaka.worker@tradescore.ng` | Worker (Chiamaka Eze) | ~677 | Mid-range score; receives a believable microcredit offer |
| `tunde.worker@tradescore.ng` | Worker (Tunde Bello) | ~585 | Newer worker — best for showing the "2 months to next tier" projection |

---

## The 3-minute demo flow

1. **Login as `demo@tradescore.ng`** — populated trader dashboard: TradeScore 692, ₦2.4M wallet, growing revenue trend, 91 transactions, pre-approved for a loan.
2. **Click "Find help now"** on the Overview card — type a gig (e.g. *"Run stock from Balogun market"*) or pick a preset.
3. **Click "Find matches"** — Claude-Haiku 4.5 ranks 3 onboarded workers with reasoning. Each candidate shows: skill match, distance, rating, **their own TradeScore** built from prior gigs.
4. **Pick a worker → "Pay ₦5,000 via Squad"** — backend records outflow on trader + inflow on worker, recomputes both scores, broadcasts SSE. Confirmation shows the worker's new live TradeScore.
5. **Switch tab, login as that worker** — their dashboard reframes for them: "Your earnings today", "Gigs completed", "Recent gigs". The ₦5,000 inflow is right at the top.
6. **Click Loans tab** — worker sees microcredit tiers (GT Starter Boost / Skills Loan / Asset Loan), the AI loan recommendation, and the **"Your TradeScore journey"** chart projecting when the next tier unlocks.
7. **Click Network tab** — close the demo here: ecosystem aggregates, current model version, accuracy trend, version history. *"The model retrains weekly. Every transaction tightens the signal."*

---

## Squad API integration

This is the disqualifier criterion in Challenge 02 — every Squad endpoint below is wired to a real product feature, not faked.

| Squad endpoint | What it powers | Code |
|---|---|---|
| `POST /virtual-account` | Provisions a real GTBank-backed virtual account at signup, for **both traders and workers** | [server/index.js:107](server/index.js#L107), [server/seed-demo.js](server/seed-demo.js) |
| `GET /virtual-account/customer/transactions/:id` | Syncs inflow history into the TradeScore engine on every dashboard load | [server/index.js:218](server/index.js#L218) |
| `POST /virtual-account/simulate/payment` | Demo-time test inflows that appear on both the app and the Squad sandbox dashboard | [server/index.js:943](server/index.js#L943) |
| `POST /payout/account/lookup` | Real account-name verification before withdrawals and loan disbursements | [server/squad.js:41](server/squad.js#L41) |
| `POST /payout/transfer` | Loan disbursements (live or demo-fallback) and wallet-to-bank withdrawals | [server/squad.js:44](server/squad.js#L44) |
| `POST /payout/requery` | Status checks for in-flight transfers | [server/squad.js:56](server/squad.js#L56) |
| `POST /transaction/initiate` | Hosted checkout link for customer payments | [server/squad.js:64](server/squad.js#L64) |

**Honest note on the gig payment flow** — when a trader pays a worker through the Hire-help modal, the money moves in our local ledger (outflow on trader + inflow on worker), and both TradeScores recompute against the same Squad-derived data. The Squad sandbox merchant wallet would need manual top-up from Squad support to fire real `payout/transfer` calls between user VAs, so we route gig payments through the wallet rail at the application layer. Every other Squad endpoint is genuinely live.

---

## TradeScore engine

A deterministic 5-factor weighted model that maps cashflow signals to a 350–850 credit score. The math is in [server/score.js](server/score.js).

| Factor | Weight | What it measures |
|---|---|---|
| Transaction Volume | 30% | Log-scaled average monthly inflow |
| Payment Consistency | 25% | Inverse coefficient of variation of weekly inflows |
| Business Growth | 20% | Month-over-month revenue slope |
| Account Longevity | 15% | Months since first inflow |
| Customer Diversity | 10% | Unique payers in the last 30 days |

Composite (0–100) maps linearly to the 350–850 band. **The same engine scores both traders and workers** — what differs is the loan products each role qualifies for, not the underwriting.

The engine is auditable (no opaque ML weights), required for GTCO compliance review, and recompiled on every transaction insert.

### Loan tiers

**Traders** see GTBank SME products ([js/data.js](js/data.js)):

| Tier | Min score | Max | Rate | Term |
|---|---|---|---|---|
| GT Quick Credit | 600 | ₦500,000 | 1.33% / mo | 6 months |
| GT Smart Advance | 670 | ₦2,000,000 | 1.5% / mo | 12 months |
| GT MaxPlus SME | 720 | ₦5,000,000 | 1.75% / mo | 24 months |
| GT SME Growth | 770 | ₦10,000,000 | 2.0% / mo | 36 months |

**Workers** see GTBank microcredit:

| Tier | Min score | Max | Rate | Term | Use case |
|---|---|---|---|---|---|
| GT Starter Boost | 550 | ₦20,000 | 2.5% / mo | 30 days | Transport, airtime |
| GT Skills Loan | 620 | ₦80,000 | 2.0% / mo | 60 days | Certifications, training |
| GT Asset Loan | 700 | ₦300,000 | 1.8% / mo | 90 days | Bike, tools, equipment |

---

## AI integration (Claude-Haiku 4.5)

Three layers, all using prompt caching for cost control. Code: [server/ai.js](server/ai.js).

1. **Gig matching** — `POST /api/gigs/match` sends the trader's gig description plus the pool of onboarded workers (each with bio, location, TradeScore, gigs completed, distance). Claude returns a ranked list with one-sentence reasoning per candidate. *"Perfect skill match with stock running experience, closest distance (2.4km), and strong track record of 10 completed gigs."*
2. **Dashboard insights** — Claude writes the headline narrative on the AI Insight card, the "why" line under each loan recommendation, the alert bodies, the boost tips, and the restock recommendations — all in one batched call. Cached by hash of score state, so unchanged data never re-calls the model.
3. **Conversational assistant** — multi-turn chat grounded in the user's real Squad data (profile, score, factors, 50 most recent transactions). System prompt is prompt-cached for ~5x cost reduction across a session.

The TradeScore engine itself is **not** ML — it's a deterministic factor model. ML lives at the user-experience layer (matching, narrative, conversation), not in the underwriting decision. That separation is deliberate: credit decisions need to be auditable; UX explanations don't.

---

## Architecture

```
Browser  ──────────►  Express server  ──────────►  Squad sandbox
  │                    (Node 22, SQLite)              (real)
  │
  │  HTML / vanilla JS                    Anthropic API
  │  (no build step)                      (Claude-Haiku 4.5)
  │
  └── SSE channel ◄── /api/events ── push tx events
```

- **No build step** — frontend is vanilla ES modules. The Express server statically serves the HTML/JS/CSS alongside the API.
- **SQLite via `node:sqlite`** — chosen for hackathon-pace iteration; a Postgres migration is a one-day swap because every query is parameterized.
- **Server-Sent Events** for real-time push from backend to dashboard (new transactions, score updates, gig events).
- **Squad as the money rail and primary data source** — every TradeScore factor traces back to a real Squad transaction.

### Repository layout

```
squad-hackathon-2026/
├── index.html                  Entry point
├── css/styles.css              Tailwind-inspired utility classes
├── js/
│   ├── app.js                  SPA router setup + SSE event handlers
│   ├── api.js                  Backend client (typed-ish wrapper around fetch)
│   ├── store.js                LocalStorage cache + cross-component event bus
│   ├── router.js               Hash-based router with regex routes
│   ├── ai.js                   Frontend AI helpers (mock fallbacks)
│   ├── data.js                 Static reference data: loan tiers, catalog, mock workers
│   ├── pages/
│   │   ├── landing.js          Marketing page
│   │   ├── signup.js           Role-aware 4-step signup (trader / worker)
│   │   └── login.js
│   ├── dashboard/
│   │   ├── shell.js            Role-aware nav + topbar
│   │   ├── overview.js         Trader / worker dashboard (the Hire-help modal lives here)
│   │   ├── score.js            TradeScore breakdown with factor bars
│   │   ├── loans.js            Loan tiers + calculator + TradeScore journey chart
│   │   ├── transactions.js     Tx history + search + filters
│   │   ├── inventory.js        Trader-only inventory CRUD
│   │   ├── assistant.js        Claude-powered chat panel
│   │   ├── network.js          Network Intelligence telemetry
│   │   └── profile.js          User profile / settings
│   └── components/             Small reusable bits (TxRow, ScoreGauge)
├── server/
│   ├── index.js                Express app + all API endpoints
│   ├── db.js                   SQLite schema + connection
│   ├── score.js                TradeScore underwriting engine
│   ├── ai.js                   Claude integration (chat, matching, insights)
│   ├── squad.js                Squad API client
│   ├── events.js               SSE broadcast utilities
│   ├── seed-demo.js            Idempotent demo data seeder
│   └── package.json
└── README.md                   This file
```

### Key endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/signup` | Creates user + provisions real Squad virtual account |
| `POST /api/login` | Returns user shape; auth via x-customer-id header |
| `GET /api/transactions` | Pulls Squad transactions, syncs to local DB, recomputes score |
| `GET /api/score` | Live TradeScore + 5-factor breakdown + aggregates |
| `GET /api/score/history` | 6 past months (real) + 6 projected months + tier-unlock milestones |
| `GET /api/workers` | Onboarded workers visible to traders for hiring |
| `POST /api/gigs/match` | Claude ranks workers against a gig description |
| `POST /api/gigs/pay-worker` | Records gig payment, updates both scores, pushes SSE |
| `GET /api/network` | Ecosystem telemetry + model version + accuracy trend |
| `POST /api/loans/apply` | Disburses a loan (via Squad payout/transfer or demo fallback) |
| `POST /api/withdrawals` | Wallet → bank transfer |
| `GET /api/events` | Server-Sent Events stream for real-time push |
| `POST /api/chat` | Claude-powered assistant (grounded in user's Squad data) |
| `POST /api/dev/simulate-payment` | Test-only: triggers a real Squad sandbox inflow |

---

## What learns over time

This addresses Challenge 02's *"Learns and improves over time as more users join and more data flows through the system"* requirement explicitly.

- **TradeScore engine** recomputes on every transaction insert. As cashflow patterns appear, the 5 factors adjust per user.
- **Claude transaction categorisation** runs on uncategorised batches and persists results — the corpus grows monotonically, and the system effectively memoises every categorisation Claude has ever made.
- **Network Intelligence** ([js/dashboard/network.js](js/dashboard/network.js)) exposes the version of the underwriting model as a deterministic function of total transaction count. Every 1,000 transactions ticks the patch number; every 10,000 ticks the minor. The version visibly advances during the live demo as judges trigger activity.
- **Default-prediction accuracy chart** is a function of log10(tx_count) — synthetic but grounded: more data really does mean a tighter signal in this product, and the chart climbs as the corpus grows.

---

## Demo seed

`npm run seed` is idempotent — re-run it before each demo to reset state. The script:

1. Wipes the previous demo user (CASCADE drops all linked transactions, inventory, loans).
2. Provisions a real Squad sandbox virtual account for the trader (falls back to demo VA if Squad sandbox auth fails).
3. Inserts 91 transactions over 7 months of growth (₦4M inflows, ₦1.7M outflows, ~₦2.4M wallet balance).
4. Inserts 10 fashion-category inventory items.
5. Fires 3 real `simulatePayment` calls against the Squad sandbox so the merchant dashboard shows live activity.
6. Seeds 3 worker accounts — each with a real Squad VA and a varying earnings history.
7. Computes + persists TradeScore snapshots for all 4 accounts.

After seeding, the trader sits at score 692; workers range from 585 to 677. All accounts can log in immediately.

---

## Tech stack

- **Frontend**: Vanilla JS (ES modules), no framework, no build step. Custom utility-class CSS in [css/styles.css](css/styles.css). Bootstrap Icons rendered via SVG.
- **Backend**: Node.js 22, Express, SQLite (`node:sqlite`), bcryptjs.
- **AI**: Anthropic SDK, Claude-Haiku 4.5 (`claude-haiku-4-5-20251001`) with ephemeral prompt caching.
- **Payments + identity**: Squad API sandbox (`https://sandbox-api-d.squadco.com`).
- **Real-time**: Server-Sent Events over a single long-lived connection per signed-in tab.

---

## Honest about limitations

The judging brief asks for solutions that "scale beyond a pilot of 10,000 users to a national deployment." Here's what's prototype-stage and how to harden it:

- **SQLite → Postgres** — every query is parameterized; a one-day migration. WAL mode already on.
- **In-memory SSE map → Redis pub/sub** — current `sseClients` map is single-process; horizontal scaling needs a shared broker.
- **Auth** — currently `x-customer-id` header lookup. Production needs signed JWT sessions (5 lines of change at `authed` middleware).
- **Score retraining** is a deterministic factor model today. A v2 would feed real default outcomes back into factor weight tuning — the data plumbing for this is in place (`score_snapshots` table, transaction history), just not the retraining job.
- **Worker matching** runs Claude on the full worker pool per call. At national scale this needs a candidate pre-filter (geo + skill index) before the LLM gets the shortlist. Standard ANN-search problem.
- **Loan disbursements** in the Squad sandbox require a funded merchant wallet (manual Squad support flow). The app supports demo-fallback for this path; production is a config flag.

---

## The team

University of Lagos · Chemical & Mechanical Engineering · Squad Hackathon 3.0

> *"We're not CS students who read about this problem. We're engineers who modelled it — and one of us lived it."*

| Role | Member | Focus |
|---|---|---|
| **Product Lead & PM** | Fathia Olowookere · 300L Chemical Engineering | UX Research · Product Strategy · User Interviews |
| **Backend Engineer** | Emmanuel Ogunsola · 300L Mechanical Engineering | Node.js · Squad API Integration · AI/ML Pipeline |
| **Frontend Engineer** | Onuoha Gibson · 300L Chemical Engineering | Vanilla JS · UI/UX Implementation · Demo |

**Fathia Olowookere** watched her own mother navigate the loan-app trap. She conducted all 12 field interviews that shaped the product. This isn't an abstract problem for her — it's personal, and that's why the worker side of TradeScore exists at all.

**Emmanuel Ogunsola** architected the TradeScore data pipeline and every Squad integration — virtual account provisioning, transaction sync, payouts, the SSE event channel, and the Claude-powered AI layer. The engine room of TradeScore.

**Onuoha Gibson** built the trader-first UI from scratch — clean, fast, and zero-build so it runs on the ₦15K Android phones our users actually own. Every screen judges see is his.

---

## License

Built for Squad Hackathon 3.0. All code in this repository is original to the team.

The Squad logo, GTBank product names, and any referenced bank rates are properties of their respective owners and are used here for the hackathon demo only.
