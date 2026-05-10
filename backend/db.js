const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/solana_pay',
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS merchants (
      id             SERIAL PRIMARY KEY,
      name           TEXT NOT NULL,
      wallet_address TEXT UNIQUE NOT NULL,
      category       TEXT DEFAULT 'general',
      email          TEXT,
      created_at     TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id         SERIAL PRIMARY KEY,
      reference  TEXT UNIQUE,
      recipient  TEXT,
      amount     NUMERIC,
      label      TEXT,
      currency   TEXT DEFAULT 'SOL',
      status     TEXT DEFAULT 'pending',
      signature  TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Idempotent migration — adds currency column if upgrading from older schema
  await pool.query(`
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'SOL';
  `);
}

async function registerMerchant({ name, walletAddress, category, email }) {
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
  const res = await pool.query('SELECT * FROM merchants WHERE wallet_address=$1', [walletAddress]);
  return res.rows[0];
}

async function createPayment({ reference, recipient, amount, label, currency = 'SOL' }) {
  const res = await pool.query(
    `INSERT INTO payments(reference, recipient, amount, label, currency)
     VALUES($1,$2,$3,$4,$5)
     ON CONFLICT (reference) DO UPDATE
       SET recipient=EXCLUDED.recipient, amount=EXCLUDED.amount,
           label=EXCLUDED.label, currency=EXCLUDED.currency
     RETURNING *`,
    [reference, recipient, amount, label || null, currency.toUpperCase()]
  );
  return res.rows[0];
}

async function markPaymentCompleted(reference, signature) {
  const res = await pool.query(
    'UPDATE payments SET status=$1, signature=$2 WHERE reference=$3 RETURNING *',
    ['completed', signature, reference]
  );
  return res.rows[0];
}

async function getPaymentByReference(reference) {
  const res = await pool.query('SELECT * FROM payments WHERE reference=$1', [reference]);
  return res.rows[0];
}

module.exports = {
  pool,
  init,
  registerMerchant,
  getMerchantByWallet,
  createPayment,
  markPaymentCompleted,
  getPaymentByReference,
};
