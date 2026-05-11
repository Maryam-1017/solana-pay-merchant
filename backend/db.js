const { Pool } = require('pg');

let pool = null;
let dbAvailable = false;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    dbAvailable = true;
  } catch (e) {
    console.warn('[db] Failed to create pool:', e.message);
  }
} else {
  console.warn('[db] DATABASE_URL not set — running without database (demo mode)');
}

async function init() {
  if (!dbAvailable) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS merchants (
        id             SERIAL PRIMARY KEY,
        name           TEXT NOT NULL,
        wallet_address TEXT UNIQUE NOT NULL,
        category       TEXT DEFAULT 'general',
        email          TEXT,
        reward_rate    NUMERIC DEFAULT 1,
        created_at     TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id               SERIAL PRIMARY KEY,
        reference        TEXT UNIQUE,
        recipient        TEXT,
        amount           NUMERIC,
        label            TEXT,
        currency         TEXT DEFAULT 'SOL',
        solana_url       TEXT,
        loyalty_points   NUMERIC DEFAULT 0,
        expires_at       TIMESTAMP,
        status           TEXT DEFAULT 'pending',
        signature        TEXT,
        created_at       TIMESTAMP DEFAULT NOW()
      );
    `);
    // Idempotent migrations for existing tables
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency       TEXT DEFAULT 'SOL';`);
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS solana_url     TEXT;`);
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS loyalty_points NUMERIC DEFAULT 0;`);
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS expires_at     TIMESTAMP;`);
    await pool.query(`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS reward_rate   NUMERIC DEFAULT 1;`);
    console.log('[db] Tables ready');
  } catch (e) {
    console.warn('[db] Init failed:', e.message);
    dbAvailable = false;
  }
}

async function registerMerchant({ name, walletAddress, category, email }) {
  if (!dbAvailable) return { name, wallet_address: walletAddress, category: category || 'general', email, reward_rate: 1 };
  const res = await pool.query(
    `INSERT INTO merchants(name, wallet_address, category, email)
     VALUES($1,$2,$3,$4)
     ON CONFLICT (wallet_address) DO UPDATE
       SET name=EXCLUDED.name, category=EXCLUDED.category, email=EXCLUDED.email
     RETURNING *`,
    [name, walletAddress, category || 'general', email || null]
  );
  return res.rows[0];
}

async function getMerchantByWallet(walletAddress) {
  if (!dbAvailable) return null;
  const res = await pool.query('SELECT * FROM merchants WHERE wallet_address=$1', [walletAddress]);
  return res.rows[0];
}

// Returns the most recently registered merchant — used as the default
// payment recipient when no specific wallet is supplied in the request.
async function getFirstMerchant() {
  if (!dbAvailable) return null;
  const res = await pool.query('SELECT * FROM merchants ORDER BY created_at DESC LIMIT 1');
  return res.rows[0] || null;
}

async function createPayment({ reference, recipient, amount, label, currency = 'SOL', solanaUrl = null, loyaltyPoints = 0, expiresAt = null }) {
  if (!dbAvailable) return { reference, recipient, amount, label, currency, solana_url: solanaUrl, loyalty_points: loyaltyPoints, status: 'pending' };
  const res = await pool.query(
    `INSERT INTO payments(reference, recipient, amount, label, currency, solana_url, loyalty_points, expires_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (reference) DO UPDATE
       SET recipient=EXCLUDED.recipient, amount=EXCLUDED.amount,
           label=EXCLUDED.label, currency=EXCLUDED.currency,
           solana_url=EXCLUDED.solana_url, loyalty_points=EXCLUDED.loyalty_points
     RETURNING *`,
    [reference, recipient, amount, label || null, currency.toUpperCase(), solanaUrl, loyaltyPoints, expiresAt]
  );
  return res.rows[0];
}

async function markPaymentCompleted(reference, signature) {
  if (!dbAvailable) return null;
  const res = await pool.query(
    'UPDATE payments SET status=$1, signature=$2 WHERE reference=$3 RETURNING *',
    ['completed', signature, reference]
  );
  return res.rows[0];
}

async function getPaymentByReference(reference) {
  if (!dbAvailable) return null;
  const res = await pool.query('SELECT * FROM payments WHERE reference=$1', [reference]);
  return res.rows[0];
}

module.exports = {
  pool,
  init,
  dbAvailable: () => dbAvailable,
  registerMerchant,
  getMerchantByWallet,
  getFirstMerchant,
  createPayment,
  markPaymentCompleted,
  getPaymentByReference,
};
