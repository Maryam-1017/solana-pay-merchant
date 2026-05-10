const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { createPayment, getPaymentByReference } = require('../db');

const USDC_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// ── Solana base58 helpers (replaces @solana/web3.js + @solana/pay) ──────────
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function toBase58(buf) {
  const digits = [0];
  for (const byte of buf) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let leading = 0;
  for (const b of buf) { if (b === 0) leading++; else break; }
  return '1'.repeat(leading) + digits.reverse().map(d => B58[d]).join('');
}

// Generate a unique 32-byte base58 reference that looks like a Solana pubkey
function generateReference() {
  return toBase58(crypto.randomBytes(32));
}

// Build a Solana Pay transfer-request URL without any Solana SDK
// Spec: solana:<recipient>?amount=<n>&spl-token=<mint>&reference=<ref>&label=<l>&message=<m>
function buildSolanaPayUrl({ recipient, amount, splToken, reference, label, message }) {
  const p = new URLSearchParams();
  if (amount    != null)  p.set('amount',    String(amount));
  if (splToken)           p.set('spl-token', splToken);
  if (reference)          p.set('reference', reference);
  if (label)              p.set('label',     label);
  if (message)            p.set('message',   message);
  return `solana:${recipient}?${p.toString()}`;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /api/payments  (alias: /api/payment-intent)
async function handleCreatePayment(req, res) {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || isNaN(amount) || amount <= 0)
      return res.status(400).json({ error: 'invalid amount' });

    const recipient = req.body.recipient || process.env.MERCHANT_WALLET;
    if (!recipient)
      return res.status(400).json({ error: 'no recipient — set MERCHANT_WALLET in Railway env' });

    const currency = (req.body.currency || 'SOL').toUpperCase();
    if (!['SOL', 'USDC'].includes(currency))
      return res.status(400).json({ error: 'currency must be SOL or USDC' });

    const label     = req.body.label   || process.env.MERCHANT_NAME || 'Merchant';
    const message   = req.body.message || `${currency} payment to ${label}`;
    const reference = generateReference();

    await createPayment({ reference, recipient, amount, label, currency });

    const url = buildSolanaPayUrl({
      recipient,
      amount,
      splToken:  currency === 'USDC' ? USDC_DEVNET_MINT : undefined,
      reference,
      label,
      message,
    });

    return res.json({ reference, url, recipient, amount, currency });
  } catch (err) {
    console.error('payment-intent error', err);
    return res.status(500).json({ error: 'internal' });
  }
}

router.post('/payments',       handleCreatePayment);
router.post('/payment-intent', handleCreatePayment);

// DELETE /api/payments/:reference — only pending payments can be deleted
router.delete('/payments/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const { pool } = require('../db');

    const check = await pool.query('SELECT * FROM payments WHERE reference=$1', [reference]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'not found' });
    if (check.rows[0].status === 'completed')
      return res.status(400).json({ error: 'cannot delete a completed payment' });

    await pool.query('DELETE FROM payments WHERE reference=$1', [reference]);
    return res.json({ success: true });
  } catch (err) {
    console.error('delete payment error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// GET /api/payments/status?reference=<ref>
router.get('/payments/status', async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ error: 'reference required' });

    const payment = await getPaymentByReference(reference);
    if (!payment) return res.status(404).json({ error: 'not found' });

    return res.json({
      status:    payment.status,
      currency:  payment.currency,
      signature: payment.signature || null,
      amount:    payment.amount,
      recipient: payment.recipient,
      createdAt: payment.created_at,
    });
  } catch (err) {
    console.error('payment status error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// GET /api/payments — list all (for history page)
router.get('/payments', async (_req, res) => {
  try {
    const { pool } = require('../db');
    const result = await pool.query(
      'SELECT * FROM payments ORDER BY created_at DESC LIMIT 100'
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('payments list error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
