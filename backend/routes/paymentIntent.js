const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../db');

const USDC_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// ── Helpers (no external deps) ───────────────────────────────────────────────
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function toBase58(buf) {
  const d = [0];
  for (const byte of buf) {
    let c = byte;
    for (let i = 0; i < d.length; i++) { c += d[i] << 8; d[i] = c % 58; c = (c / 58) | 0; }
    while (c > 0) { d.push(c % 58); c = (c / 58) | 0; }
  }
  return d.reverse().map(x => B58[x]).join('');
}
function generateReference() { return toBase58(crypto.randomBytes(32)); }
function buildSolanaPayUrl({ recipient, amount, splToken, reference, label, message }) {
  const p = new URLSearchParams();
  if (amount    != null) p.set('amount',    String(amount));
  if (splToken)          p.set('spl-token', splToken);
  if (reference)         p.set('reference', reference);
  if (label)             p.set('label',     label);
  if (message)           p.set('message',   message);
  return `solana:${recipient}?${p.toString()}`;
}

// ── POST /api/payments ───────────────────────────────────────────────────────
async function handleCreatePayment(req, res) {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || isNaN(amount) || amount <= 0)
      return res.status(400).json({ error: 'invalid amount' });

    const recipient = req.body.recipient || process.env.MERCHANT_WALLET || 'DEMO_WALLET';
    const currency  = (req.body.currency || 'SOL').toUpperCase();
    if (!['SOL', 'USDC'].includes(currency))
      return res.status(400).json({ error: 'currency must be SOL or USDC' });

    const label     = req.body.label   || process.env.MERCHANT_NAME || 'Merchant';
    const message   = req.body.message || `${currency} payment to ${label}`;
    const reference = generateReference();

    await db.createPayment({ reference, recipient, amount, label, currency });

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
    console.error('payment error:', err.message);
    return res.status(500).json({ error: 'internal' });
  }
}
router.post('/payments',       handleCreatePayment);
router.post('/payment-intent', handleCreatePayment);

// ── DELETE /api/payments/:reference ─────────────────────────────────────────
router.delete('/payments/:reference', async (req, res) => {
  try {
    if (!db.dbAvailable())
      return res.status(503).json({ error: 'database not connected' });

    const { reference } = req.params;
    const payment = await db.getPaymentByReference(reference);
    if (!payment)                        return res.status(404).json({ error: 'not found' });
    if (payment.status === 'completed')  return res.status(400).json({ error: 'cannot delete completed payment' });

    await db.pool.query('DELETE FROM payments WHERE reference=$1', [reference]);
    return res.json({ success: true });
  } catch (err) {
    console.error('delete error:', err.message);
    return res.status(500).json({ error: 'internal' });
  }
});

// ── GET /api/payments/status ─────────────────────────────────────────────────
router.get('/payments/status', async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ error: 'reference required' });

    const payment = await db.getPaymentByReference(reference);
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
    console.error('status error:', err.message);
    return res.status(500).json({ error: 'internal' });
  }
});

// ── GET /api/payments ────────────────────────────────────────────────────────
router.get('/payments', async (_req, res) => {
  try {
    if (!db.dbAvailable()) return res.json([]);   // empty list, not an error

    const result = await db.pool.query(
      'SELECT * FROM payments ORDER BY created_at DESC LIMIT 100'
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('list error:', err.message);
    return res.json([]);
  }
});

module.exports = router;
