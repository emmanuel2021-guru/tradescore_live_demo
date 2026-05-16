// Demo-data seeder for the live presentation.
// Creates a single trader account with ~7 months of realistic transaction
// history, a populated inventory, a fresh score snapshot, AND a real Squad
// sandbox virtual account so judges can see the integration is live.
//
//   Run:   npm run seed
//   Login: demo@tradescore.ng  /  demo1234
//
// Idempotent — deletes the existing demo user (CASCADE drops everything
// linked) and re-creates it from scratch, so you can re-run before each demo.

import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import db from './db.js';
import { recomputeAndSave } from './score.js';
import { squad } from './squad.js';

// ── Persona ──────────────────────────────────────────────────────
// BVN / DOB / gender match the sandbox-validated combo Squad accepts.
// Override any field via env (SEED_BVN, SEED_DOB, ...) if you regenerate
// new sandbox test BVNs from your Squad dashboard.
const PERSONA = {
  email:          process.env.SEED_EMAIL      || 'demo@tradescore.ng',
  password:       process.env.SEED_PASSWORD   || 'demo1234',
  first_name:     process.env.SEED_FIRST_NAME || 'Tunde',
  last_name:      process.env.SEED_LAST_NAME  || 'Adebayo',
  business_name:  process.env.SEED_BUSINESS   || 'Adebayo Fashion Hub',
  category:       'Fashion',
  location:       'Yaba, Lagos',
  mobile_num:     process.env.SEED_MOBILE     || '08031234567',
  dob:            process.env.SEED_DOB        || '10/30/1990',
  bvn:            process.env.SEED_BVN        || '22110011001',
  gender:         process.env.SEED_GENDER     || '1',  // 1 = Male, 2 = Female (Squad's enum)
  address:        '14 Herbert Macaulay Way, Yaba, Lagos',
};

const newCustomerId = () =>
  'ts_seed_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');

// ── Customer payment senders (drives Customer Diversity factor) ─
const CUSTOMERS = [
  'Customer Payment · Tunde A.',
  'Customer Payment · Kemi O.',
  'Customer Payment · Folake B.',
  'Customer Payment · Bisi A.',
  'Customer Payment · Chioma E.',
  'Customer Payment · Ngozi M.',
  'Customer Payment · Aisha B.',
  'Customer Payment · Funmi K.',
  'Customer Payment · Yetunde S.',
  'Customer Payment · Zainab L.',
  'Customer Payment · Ada N.',
  'Customer Payment · Halima A.',
  'Customer Payment · Ifeoma E.',
  'Customer Payment · Blessing O.',
  'Customer Payment · Sade J.',
];

// ── Monthly profile: 7 months of growth ──────────────────────────
// [inflows count, target revenue ₦, recurring outflows ₦]
// Order: oldest → most-recent. The last entry is the CURRENT calendar month
// (partial — we're partway through it), and additional fresh recent activity
// is stacked on top of it after this loop.
const MONTHLY = [
  { inflows:  6, revenue:  380_000, stock:  85_000, rent: 80_000, utilities: 12_500, logistics:  6_500 },
  { inflows:  7, revenue:  470_000, stock: 110_000, rent: 80_000, utilities: 11_800, logistics:  7_200 },
  { inflows:  6, revenue:  460_000, stock:  95_000, rent: 80_000, utilities: 13_200, logistics:  5_800 },
  { inflows:  8, revenue:  590_000, stock: 145_000, rent: 80_000, utilities: 12_400, logistics:  8_500 },
  { inflows:  8, revenue:  620_000, stock: 130_000, rent: 80_000, utilities: 11_500, logistics:  7_900 },
  { inflows: 10, revenue:  710_000, stock: 165_000, rent: 80_000, utilities: 12_800, logistics:  9_100 },
  { inflows: 11, revenue:  770_000, stock: 195_000, rent: 80_000, utilities: 13_500, logistics: 10_400 },
];

// ── Worker accounts (job-seeker side of the loop) ────────────────
// Each one gets a real Squad VA + a small earnings history so judges can
// log in as them and see a populated dashboard. They reuse the same BVN
// triplet because Squad's sandbox lets a single test BVN back many VAs.
const WORKERS = [
  {
    email: 'tunde.worker@tradescore.ng', password: 'demo1234',
    first_name: 'Tunde',    last_name: 'Bello',
    business_name: 'Delivery, market runs, load-bearing',
    location: 'Yaba, Lagos',
    gigs: [22000, 18500, 15000, 12500, 9500, 11000, 7500, 8500],
  },
  {
    email: 'chiamaka.worker@tradescore.ng', password: 'demo1234',
    first_name: 'Chiamaka', last_name: 'Eze',
    business_name: 'Shop help, cashier, customer service',
    location: 'Surulere, Lagos',
    gigs: [14000, 11500, 9200, 8400, 12000],
  },
  {
    email: 'ibrahim.worker@tradescore.ng', password: 'demo1234',
    first_name: 'Ibrahim',  last_name: 'Musa',
    business_name: 'Delivery, stock running, market runs',
    location: 'Mushin, Lagos',
    gigs: [20000, 16800, 13200, 15500, 11900, 10000, 8800, 12400, 9100, 7600],
  },
];

// ── Inventory (10 items from Fashion catalog) ────────────────────
const INVENTORY = [
  { name: 'Ankara fabric',  category: 'Fashion', price: 4500,  qty: 38 },
  { name: 'Lace fabric',    category: 'Fashion', price: 8500,  qty: 22 },
  { name: 'T-shirt',        category: 'Fashion', price: 3500,  qty: 64 },
  { name: 'Trouser',        category: 'Fashion', price: 6500,  qty: 27 },
  { name: 'Senator wear',   category: 'Fashion', price: 18000, qty: 14 },
  { name: 'Aso-oke',        category: 'Fashion', price: 25000, qty:  9 },
  { name: 'Shoes',          category: 'Fashion', price: 12000, qty: 18 },
  { name: 'Bag',            category: 'Fashion', price:  9500, qty: 21 },
  { name: 'Headtie',        category: 'Fashion', price:  4000, qty: 31 },
  { name: 'Cap',            category: 'Fashion', price:  3000, qty: 25 },
];

// ── Helpers ──────────────────────────────────────────────────────
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function randInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Splits a target total into N positive parts that vary ±25% around the mean.
function splitAmount(total, n) {
  const mean = total / n;
  const raw = Array.from({ length: n }, () => mean * (0.75 + Math.random() * 0.5));
  const sum = raw.reduce((s, v) => s + v, 0);
  return raw.map(v => Math.round((v / sum) * total / 100) * 100); // round to ₦100
}

// Drops a timestamp at a random hour inside the given day-of-month window.
// For the current month, clamps the day so we never emit future timestamps.
function timestampInMonth(monthsBack, dayInMonth) {
  const now = new Date();
  if (monthsBack === 0) {
    dayInMonth = Math.min(dayInMonth, Math.max(1, now.getDate() - 1));
  }
  const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, dayInMonth,
                     randInt(8, 19), randInt(0, 59));
  return d.toISOString();
}

// ── Squad VA provisioning ────────────────────────────────────────
// Same flow the live signup endpoint uses. On Squad failure we fall back
// to a deterministic fake VA so the seed still produces a usable account.
// `profile` defaults to the trader PERSONA but workers pass their own
// first_name/last_name/email (BVN+DOB are shared because Squad sandbox
// allows the same test BVN across many virtual accounts).
async function provisionVirtualAccount(customer_identifier, profile = PERSONA) {
  if (!process.env.SQUAD_SECRET_KEY) {
    console.warn('  ⚠ SQUAD_SECRET_KEY not set — falling back to demo VA');
    return { number: '90' + Math.floor(Math.random() * 1e8).toString().padStart(8, '0'),
             bank: 'GTB-DEMO', demo: true };
  }
  try {
    const payload = {
      customer_identifier,
      first_name: profile.first_name,
      last_name:  profile.last_name,
      mobile_num: profile.mobile_num || PERSONA.mobile_num,
      dob:        profile.dob        || PERSONA.dob,
      email:      profile.email,
      bvn:        profile.bvn        || PERSONA.bvn,
      gender:     profile.gender     || PERSONA.gender,
      address:    profile.address    || PERSONA.address,
      beneficiary_account: process.env.SQUAD_BENEFICIARY_ACCOUNT,
    };
    console.log('  → calling Squad /virtual-account …');
    const resp = await squad.createVirtualAccount(payload);
    const va = resp?.data || {};
    if (!va.virtual_account_number) {
      throw new Error('Squad did not return a virtual_account_number');
    }
    console.log('  ✓ Squad VA: ' + va.virtual_account_number + ' (' + (va.bank_code || va.bank || 'GTB') + ')');
    return {
      number: va.virtual_account_number,
      bank:   va.bank_code || va.bank || 'GTB',
      demo:   false,
    };
  } catch (e) {
    console.warn('  ✗ Squad VA creation failed:', e.message);
    if (e.squad) console.warn('    detail:', JSON.stringify(e.squad));
    console.warn('  → falling back to demo VA');
    return { number: '90' + Math.floor(Math.random() * 1e8).toString().padStart(8, '0'),
             bank: 'GTB-DEMO', demo: true };
  }
}

// ── Seed ─────────────────────────────────────────────────────────
async function seed() {
  console.log('▸ Seeding demo data…');

  // 1. Wipe any previous demo user (CASCADE removes txs, inv, loans, etc.)
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(PERSONA.email);
  if (existing) {
    db.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
    console.log('  cleared previous demo account (id=' + existing.id + ')');
  }

  // 2. Provision a real Squad virtual account before inserting the user row,
  //    so the customer_identifier matches what Squad has on file.
  const customer_identifier = newCustomerId();
  const va = await provisionVirtualAccount(customer_identifier);

  // 3. Insert user
  const password_hash = bcrypt.hashSync(PERSONA.password, 10);
  const userInsert = db.prepare(`
    INSERT INTO users (
      customer_identifier, email, password_hash, role,
      first_name, last_name, mobile_num, dob, bvn, gender, address,
      business_name, category, location,
      virtual_account_number, virtual_account_bank,
      created_at
    ) VALUES (
      @customer_identifier, @email, @password_hash, 'trader',
      @first_name, @last_name, @mobile_num, @dob, @bvn, @gender, @address,
      @business_name, @category, @location,
      @virtual_account_number, @virtual_account_bank,
      @created_at
    )
  `);
  const createdAt = new Date(Date.now() - 7 * 30 * MS_PER_DAY).toISOString();
  const info = userInsert.run({
    customer_identifier,
    email: PERSONA.email,
    password_hash,
    first_name: PERSONA.first_name,
    last_name: PERSONA.last_name,
    mobile_num: PERSONA.mobile_num,
    dob: PERSONA.dob,
    bvn: PERSONA.bvn,
    gender: PERSONA.gender,
    address: PERSONA.address,
    business_name: PERSONA.business_name,
    category: PERSONA.category,
    location: PERSONA.location,
    virtual_account_number: va.number,
    virtual_account_bank:   va.bank,
    created_at: createdAt,
  });
  const userId = info.lastInsertRowid;
  console.log('  created user ' + PERSONA.email + ' (id=' + userId + ', cid=' + customer_identifier + ')');

  // 3. Transactions — 7 months of history
  const txInsert = db.prepare(`
    INSERT INTO transactions (
      user_id, squad_ref, direction, amount_kobo, description, category, occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let totalIn = 0, totalOut = 0, txCount = 0, refSeq = 1;
  const refFor = (kind) => `SEED-${kind}-${String(refSeq++).padStart(5, '0')}`;

  // Walk months oldest → newest so occurred_at order matches history.
  // idx 0 → 6 months ago (earliest), idx 6 → 0 (current calendar month).
  MONTHLY.forEach((m, idx) => {
    const monthsBack = (MONTHLY.length - 1 - idx);
    const amounts = splitAmount(m.revenue, m.inflows);

    // Customer payments, spread across the month.
    amounts.forEach(amt => {
      const day = randInt(2, 27);
      txInsert.run(userId, refFor('IN'), 'in', amt * 100,
        pick(CUSTOMERS), 'Sales', timestampInMonth(monthsBack, day));
      totalIn += amt;
      txCount++;
    });

    // Outflows
    [
      { name: 'Stock Purchase · Balogun Market', cat: 'Inventory', amt: m.stock,     day: randInt(3, 8)  },
      { name: 'Rent Payment',                    cat: 'Rent',      amt: m.rent,      day: randInt(1, 3)  },
      { name: 'Electricity Bill · IKEDC',        cat: 'Utilities', amt: m.utilities, day: randInt(15, 20) },
      { name: 'Transport / Logistics',           cat: 'Logistics', amt: m.logistics, day: randInt(10, 25) },
    ].forEach(o => {
      txInsert.run(userId, refFor('OUT'), 'out', o.amt * 100,
        o.name, o.cat, timestampInMonth(monthsBack, o.day));
      totalOut += o.amt;
      txCount++;
    });
  });

  // 4. Current-month fresh activity (today / yesterday / this week)
  const now = new Date();
  const todayBase = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).getTime();
  const recent = [
    { dir: 'in',  name: 'Customer Payment · Tunde A.',  cat: 'Sales',     amt: 15500, hoursAgo:  2 },
    { dir: 'in',  name: 'Customer Payment · Chioma E.', cat: 'Sales',     amt:  8200, hoursAgo:  5 },
    { dir: 'in',  name: 'Customer Payment · Folake B.', cat: 'Sales',     amt: 22000, hoursAgo: 27 },
    { dir: 'out', name: 'Stock Purchase · Balogun Market', cat: 'Inventory', amt: 45000, hoursAgo: 30 },
    { dir: 'in',  name: 'Customer Payment · Bisi A.',   cat: 'Sales',     amt:  9800, hoursAgo: 52 },
    { dir: 'in',  name: 'Customer Payment · Kemi O.',   cat: 'Sales',     amt: 18400, hoursAgo: 76 },
    { dir: 'out', name: 'Transport',                    cat: 'Logistics', amt:  5500, hoursAgo: 96 },
  ];
  recent.forEach(r => {
    const occurredAt = new Date(todayBase - r.hoursAgo * 60 * 60 * 1000).toISOString();
    txInsert.run(userId, refFor(r.dir === 'in' ? 'IN' : 'OUT'),
      r.dir, r.amt * 100, r.name, r.cat, occurredAt);
    if (r.dir === 'in') totalIn += r.amt; else totalOut += r.amt;
    txCount++;
  });

  console.log('  inserted ' + txCount + ' transactions');
  console.log('    inflow total:  ₦' + totalIn.toLocaleString('en-NG'));
  console.log('    outflow total: ₦' + totalOut.toLocaleString('en-NG'));
  console.log('    wallet balance: ₦' + Math.max(0, totalIn - totalOut).toLocaleString('en-NG'));

  // 5. Inventory
  const invInsert = db.prepare(`
    INSERT INTO inventory_items (user_id, name, category, price_kobo, qty)
    VALUES (?, ?, ?, ?, ?)
  `);
  INVENTORY.forEach(i =>
    invInsert.run(userId, i.name, i.category, i.price * 100, i.qty));
  console.log('  inserted ' + INVENTORY.length + ' inventory items');

  // 6. Live Squad inflows — only when we have a real VA. These are real
  //    sandbox transactions: they show up on the Squad dashboard AND get
  //    synced back into our local DB below, so the dashboard reflects them
  //    immediately on first login.
  if (!va.demo) {
    const liveAmounts = [3500, 7200, 5400];
    console.log('  → pushing ' + liveAmounts.length + ' live inflows to Squad sandbox …');
    for (const amount of liveAmounts) {
      try {
        await squad.simulatePayment({
          virtual_account_number: va.number,
          amount: String(amount),
        });
        console.log('    ✓ simulated ₦' + amount.toLocaleString('en-NG'));
        // Squad needs a beat to register the tx before it appears in listings.
        await new Promise(r => setTimeout(r, 700));
      } catch (e) {
        console.warn('    ✗ simulate failed (₦' + amount + '):', e.message);
      }
    }

    // 7. Pull what Squad just recorded back into the local DB so the
    //    dashboard shows it without waiting for the first /api/transactions sync.
    try {
      const refreshed = await squad.getCustomerTransactions(customer_identifier);
      const list = Array.isArray(refreshed?.data) ? refreshed.data : [];
      const upsert = db.prepare(`
        INSERT INTO transactions (user_id, squad_ref, direction, amount_kobo, description, category, occurred_at)
        VALUES (?, ?, 'in', ?, ?, 'Sales', ?)
        ON CONFLICT(squad_ref) DO UPDATE SET amount_kobo = excluded.amount_kobo
      `);
      let synced = 0;
      for (const tx of list) {
        const ref = tx.transaction_reference || tx.reference || tx.id;
        if (!ref) continue;
        const amountNaira = tx.principal_amount ?? tx.amount ?? tx.settled_amount ?? 0;
        const amountKobo  = Math.round(Number(amountNaira) * 100) || 0;
        const description = tx.sender_name || tx.remarks || tx.narration || 'Customer Payment · Squad';
        const occurredAt  = tx.transaction_date || tx.created_at || new Date().toISOString();
        upsert.run(userId, String(ref), amountKobo, description, occurredAt);
        synced++;
      }
      console.log('  ✓ synced ' + synced + ' live transactions from Squad');
    } catch (e) {
      console.warn('  ✗ Squad sync failed:', e.message);
    }
  } else {
    console.log('  ⓘ skipping live Squad inflows (demo VA)');
  }

  // 8. Compute + persist score snapshot for the trader
  const result = recomputeAndSave(userId);
  console.log('  TradeScore: ' + result.score + ' / 850');
  console.log('    monthly revenue: ₦' + (result.aggregates.monthlyRevenue || 0).toLocaleString('en-NG'));
  console.log('    unique customers: ' + result.aggregates.uniqueCustomers);
  console.log('    growth: ' + (result.aggregates.growthPct ?? '—') + '%');

  // 9. Seed worker (job-seeker) accounts so the two-sided story is real.
  //    Each worker gets a real Squad VA and a small earnings history.
  console.log('\n▸ Seeding ' + WORKERS.length + ' worker accounts…');
  const workerSummaries = [];
  for (const w of WORKERS) {
    const summary = await seedWorker(w);
    workerSummaries.push(summary);
  }

  console.log('\n✓ Demo seed complete.');
  console.log('  Trader login:');
  console.log('    email:    ' + PERSONA.email);
  console.log('    password: ' + PERSONA.password);
  console.log('    VA:       ' + va.number + ' (' + va.bank + (va.demo ? ' · demo' : '') + ')');
  console.log('  Worker logins (all password: demo1234):');
  workerSummaries.forEach(w => {
    console.log('    ' + w.email.padEnd(34) + ' · TradeScore ' + (w.score ?? '—') + ' · VA ' + w.va);
  });
}

// Creates one worker user with a real Squad VA and a backdated earnings
// history. Workers share the trader's BVN — Squad sandbox allows it.
async function seedWorker(w) {
  // Wipe any prior worker with this email so the seed is idempotent.
  const prev = db.prepare('SELECT id FROM users WHERE email = ?').get(w.email);
  if (prev) db.prepare('DELETE FROM users WHERE id = ?').run(prev.id);

  const customer_identifier = newCustomerId();
  const va = await provisionVirtualAccount(customer_identifier, {
    first_name: w.first_name,
    last_name:  w.last_name,
    email:      w.email,
  });

  const password_hash = bcrypt.hashSync(w.password, 10);
  const createdAt = new Date(Date.now() - (4 + Math.floor(Math.random() * 4)) * 30 * MS_PER_DAY).toISOString();
  const info = db.prepare(`
    INSERT INTO users (
      customer_identifier, email, password_hash, role,
      first_name, last_name, mobile_num, dob, bvn, gender, address,
      business_name, category, location,
      virtual_account_number, virtual_account_bank, created_at
    ) VALUES (
      @customer_identifier, @email, @password_hash, 'worker',
      @first_name, @last_name, @mobile_num, @dob, @bvn, @gender, @address,
      @business_name, @category, @location,
      @virtual_account_number, @virtual_account_bank, @created_at
    )
  `).run({
    customer_identifier,
    email: w.email,
    password_hash,
    first_name: w.first_name,
    last_name:  w.last_name,
    mobile_num: PERSONA.mobile_num,
    dob:        PERSONA.dob,
    bvn:        PERSONA.bvn,
    gender:     PERSONA.gender,
    address:    PERSONA.address,
    business_name: w.business_name,
    category: 'Services',
    location: w.location,
    virtual_account_number: va.number,
    virtual_account_bank:   va.bank,
    created_at: createdAt,
  });
  const workerId = info.lastInsertRowid;

  // Earnings history — one gig per slot, spread across the last ~4 months.
  // Descriptions vary so Customer Diversity factor lands above zero.
  const traders = [
    'Gig from Funmi Adeyemi · delivery',
    'Gig from Adebayo Hub · stock run',
    'Gig from Kemi Stores · shop help',
    'Gig from Yetunde Mart · market run',
    'Gig from Mama Bola · errand',
  ];
  const txInsert = db.prepare(`
    INSERT INTO transactions (user_id, squad_ref, direction, amount_kobo, description, category, occurred_at)
    VALUES (?, ?, 'in', ?, ?, 'Sales', ?)
  `);
  let refSeq = 1;
  w.gigs.forEach((amt, i) => {
    const monthsBack = Math.max(0, w.gigs.length - 1 - i) % 4;
    const day = 1 + Math.floor(Math.random() * 26);
    const ts = timestampInMonth(monthsBack, day);
    txInsert.run(workerId,
      'WSEED-' + workerId + '-' + String(refSeq++).padStart(3, '0'),
      amt * 100, pick(traders), ts);
  });

  const score = recomputeAndSave(workerId);
  console.log('  ✓ ' + w.first_name + ' ' + w.last_name + ' (' + w.email + ')');
  console.log('     VA: ' + va.number + (va.demo ? ' (demo)' : '') + ' · TradeScore: ' + (score.score ?? '—'));

  return { email: w.email, score: score.score, va: va.number };
}

seed().then(
  () => process.exit(0),
  (err) => { console.error('\n✗ Seed failed:', err); process.exit(1); }
);
