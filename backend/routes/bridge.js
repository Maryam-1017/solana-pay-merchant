const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../db');

const DEMO_RATE_PKR = 278; // 1 USD = 278 PKR (fixed demo rate)

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

// POST /api/bridge/jazzcash
// Demo simulation of a JazzCash → USDC bridge.
// Records a completed USDC payment in DB as if settled on-chain.
// Production version would call JazzCash Merchant API first, then
// trigger the actual USDC transfer via the Solana program.
router.post('/bridge/jazzcash', async (req, res) => {
  try {
    const pkrAmount = parseFloat(req.body.pkrAmount);
    if (!pkrAmount || isNaN(pkrAmount) || pkrAmount <= 0)
      return res.status(400).json({ error: 'invalid PKR amount' });

    const usdcAmount   = parseFloat((pkrAmount / DEMO_RATE_PKR).toFixed(4));
    const reference    = toBase58(crypto.randomBytes(32));
    // Two 32-byte chunks produce a realistic 88-char Solana tx signature
    const txSignature  = toBase58(Buffer.concat([crypto.randomBytes(32), crypto.randomBytes(32)]));
    const label        = req.body.label || 'JazzCash Bridge';

    const merchant     = await db.getFirstMerchant();
    const recipient    = merchant?.wallet_address || process.env.MERCHANT_WALLET || 'DEMO_WALLET';
    const merchantName = merchant?.name || 'Merchant';
    const loyaltyPts   = Math.floor(usdcAmount);

    await db.createPayment({
      reference,
      recipient,
      amount:        usdcAmount,
      label,
      currency:      'USDC',
      solanaUrl:     null,
      loyaltyPoints: loyaltyPts,
      expiresAt:     null,
    });
    await db.markPaymentCompleted(reference, txSignature);

    return res.json({
      success:       true,
      pkrAmount,
      usdcAmount,
      rate:          DEMO_RATE_PKR,
      reference,
      txSignature,
      recipient,
      merchantName,
      loyaltyPoints: loyaltyPts,
      demo:          true,
      note:          'Production version integrates JazzCash Merchant API (pending business approval)',
    });
  } catch (err) {
    console.error('[bridge/jazzcash] error:', err.message);
    return res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
