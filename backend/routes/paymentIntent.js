const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../db');

const USDC_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const LINK_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

// Loyalty points: 1 point per 1 USDC, 10 points per 1 SOL (approx)
function calcLoyalty(amount, currency) {
  if (currency === 'USDC') return Math.floor(parseFloat(amount));
  if (currency === 'SOL')  return Math.floor(parseFloat(amount) * 10);
  return 0;
}

// ── POST /api/payments ───────────────────────────────────────────────────────
async function handleCreatePayment(req, res) {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || isNaN(amount) || amount <= 0)
      return res.status(400).json({ error: 'invalid amount' });

    // Resolve recipient: DB merchant → env var → demo fallback
    // Priority: explicit body.recipient > body.merchantWallet lookup >
    //           most-recently-registered merchant > MERCHANT_WALLET env > demo
    let recipient    = req.body.recipient || null;
    let merchantName = null;

    if (!recipient && req.body.merchantWallet) {
      const m = await db.getMerchantByWallet(req.body.merchantWallet);
      // Use DB wallet if registered, else use the submitted address directly
      recipient    = m?.wallet_address || req.body.merchantWallet;
      merchantName = m?.name           || null;
    }

    if (!recipient) {
      const m = await db.getFirstMerchant();
      recipient    = m?.wallet_address || process.env.MERCHANT_WALLET || 'DEMO_WALLET';
      merchantName = m?.name           || null;
    }

    const currency  = (req.body.currency || 'SOL').toUpperCase();
    if (!['SOL', 'USDC'].includes(currency))
      return res.status(400).json({ error: 'currency must be SOL or USDC' });

    const label          = req.body.label   || merchantName || process.env.MERCHANT_NAME || 'Merchant';
    const message        = req.body.message || `${currency} payment to ${label}`;
    const reference      = generateReference();
    const loyaltyPoints  = calcLoyalty(amount, currency);
    const expiresAt      = new Date(Date.now() + LINK_TTL_MS);

    const url = buildSolanaPayUrl({
      recipient,
      amount,
      splToken:  currency === 'USDC' ? USDC_DEVNET_MINT : undefined,
      reference,
      label,
      message,
    });

    await db.createPayment({ reference, recipient, amount, label, currency, solanaUrl: url, loyaltyPoints, expiresAt });

    const frontendBase = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',')[0].trim()
      : 'https://solana-pay-merchant.vercel.app';

    return res.json({
      reference,
      url,
      recipient,
      amount,
      currency,
      label,
      loyaltyPoints,
      expiresAt:   expiresAt.toISOString(),
      paymentLink: `${frontendBase}/pay/${reference}`,
    });
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
    if (!payment)                       return res.status(404).json({ error: 'not found' });
    if (payment.status === 'completed') return res.status(400).json({ error: 'cannot delete completed payment' });
    await db.pool.query('DELETE FROM payments WHERE reference=$1', [reference]);
    return res.json({ success: true });
  } catch (err) {
    console.error('delete error:', err.message);
    return res.status(500).json({ error: 'internal' });
  }
});

// ── GET /api/payments/status ─────────────────────────────────────────────────
// If DB says "pending", we also query the Solana RPC directly to detect
// payments that the Helius webhook may have missed. This is the critical
// fallback that makes the frontend polling reliable.
router.get('/payments/status', async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ error: 'reference required' });

    const payment = await db.getPaymentByReference(reference);
    if (!payment)   return res.status(404).json({ error: 'not found' });

    // Check expiry
    if (payment.expires_at && new Date(payment.expires_at) < new Date() && payment.status === 'pending') {
      return res.json({ status: 'expired', ...baseFields(payment) });
    }

    // ── On-chain fallback ─────────────────────────────────────────────────
    // If DB still shows pending, hit the Solana RPC to see if a transaction
    // referencing this key already landed. Catches webhook misses.
    if (payment.status === 'pending') {
      const onChainSig = await checkOnChain(reference);
      if (onChainSig) {
        console.log(`[status] on-chain fallback confirmed ${reference} → ${onChainSig}`);
        await db.markPaymentCompleted(reference, onChainSig);
        return res.json({ status: 'completed', ...baseFields(payment), signature: onChainSig });
      }
    }

    return res.json({ status: payment.status, ...baseFields(payment) });
  } catch (err) {
    console.error('status error:', err.message);
    return res.status(500).json({ error: 'internal' });
  }
});

// Query the Solana RPC for any confirmed transaction that references `address`.
// The Solana Pay reference key is included as a read-only account in the tx,
// so getSignaturesForAddress will find it.
async function checkOnChain(address) {
  try {
    const rpc = process.env.HELIUS_API_KEY
      ? `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : 'https://api.devnet.solana.com';

    const resp = await fetch(rpc, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method:  'getSignaturesForAddress',
        params:  [address, { limit: 5, commitment: 'confirmed' }],
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const sigs  = data.result || [];

    // Return the first confirmed (non-errored) transaction signature
    const confirmed = sigs.find(s => !s.err);
    return confirmed?.signature || null;
  } catch {
    return null;
  }
}

function baseFields(p) {
  return {
    currency:      p.currency,
    signature:     p.signature || null,
    amount:        p.amount,
    label:         p.label,
    recipient:     p.recipient,
    solanaUrl:     p.solana_url,
    loyaltyPoints: p.loyalty_points,
    expiresAt:     p.expires_at,
    createdAt:     p.created_at,
  };
}

// ── GET /api/payments?wallet=ADDRESS ─────────────────────────────────────────
// Returns only payments where recipient = wallet.
// If no wallet param, returns [] to enforce per-merchant isolation.
router.get('/payments', async (req, res) => {
  try {
    if (!db.dbAvailable()) return res.json([]);
    const { wallet } = req.query;
    if (!wallet) return res.json([]);
    const result = await db.pool.query(
      'SELECT * FROM payments WHERE recipient=$1 ORDER BY created_at DESC LIMIT 200',
      [wallet]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('list error:', err.message);
    return res.json([]);
  }
});

module.exports = router;
