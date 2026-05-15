import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(join(__dirname, 'tradescore.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Allow `{ field: value }` instead of forcing `{ '@field': value }` at every call site.
const _prepare = db.prepare.bind(db);
db.prepare = (sql) => {
  const stmt = _prepare(sql);
  stmt.setAllowBareNamedParameters(true);
  return stmt;
};

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_identifier TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'trader',

  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  mobile_num TEXT,
  dob TEXT,
  bvn TEXT,
  gender TEXT,
  address TEXT,

  business_name TEXT,
  category TEXT,
  location TEXT,

  virtual_account_number TEXT,
  virtual_account_bank TEXT,
  beneficiary_bank TEXT,
  beneficiary_account TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  squad_ref TEXT UNIQUE,
  direction TEXT NOT NULL,
  amount_kobo INTEGER NOT NULL,
  description TEXT,
  category TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_kobo INTEGER NOT NULL,
  term_days INTEGER NOT NULL,
  rate_monthly REAL NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payout_ref TEXT,
  nip_ref TEXT,
  disbursed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_kobo INTEGER NOT NULL,
  bank_code TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payout_ref TEXT,
  nip_ref TEXT,
  disbursed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS score_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  factors_json TEXT NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User's shop catalogue. Replaces the localStorage-only store so inventory
-- survives device wipes and can feed into AI context + restock suggestions.
CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  price_kobo INTEGER NOT NULL DEFAULT 0,
  qty INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_inv_user ON inventory_items(user_id, id DESC);

-- Inventory items the trader sells. Used by the Inventory tab, fed into
-- the chat assistant's context, and used to generate restock-tip narratives.
CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  price_kobo INTEGER NOT NULL DEFAULT 0,
  qty INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inv_user ON inventory_items(user_id, id DESC);

-- LLM-generated dashboard narratives, cached by (user_id, cache_key).
-- cache_key is a hash of the score state + aggregates + the input data we
-- pass to Claude. If those don't change, we never re-call the model.
CREATE TABLE IF NOT EXISTS insights_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  model TEXT,
  usage_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, cache_key)
);
`);

export default db;
