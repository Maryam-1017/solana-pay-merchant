const express = require('express');
const router = express.Router();
const { createPayment, getPaymentByReference } = require('../db');
const { encodeURL } = require('@solana/pay');
const { Keypair, PublicKey } = require('@solana/web3.js');
const BigNumber = require('bignumber.js');

const USDC_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// POST /api/payments  (alias: /api/payment-intent)
async function handleCreatePayment(req, res) {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'invalid amount' });
    }

    const recipient = req.body.recipient || process.env.MERCHANT_WALLET;
    if (!recipient) {
      return res.status(400).json({ error: 'no recipient — set MERCHANT_WALLET in .env' });
    }

    const currency = (req.body.currency || 'SOL').toUpperCase();
    if (!['SOL', 'USDC'].includes(currency)) {
      return res.status(400).json({ error: 'currency must be SOL or USDC' });
    }

    const label   = req.body.label   || process.env.MERCHANT_NAME || 'Merchant';
    const message = req.body.message || `${currency} payment to ${label}`;

    const referenceKeypair = Keypair.generate();
    const reference        = referenceKeypair.publicKey.toString();

    await createPayment({ reference, recipient, amount, label, currency });

    const urlParams = {
      recipient: new PublicKey(recipient),
      amount:    new BigNumber(amount),
      reference: referenceKeypair.publicKey,
      label,
      message,
    };

    // For USDC, add the SPL token mint — this produces the spl-token= query param
    // that Phantom/Solflare wallets read to trigger a token transfer instead of SOL
    if (currency === 'USDC') {
      urlParams.splToken = new PublicKey(USDC_DEVNET_MINT);
    }

    const url = encodeURL(urlParams);

    return res.json({
      reference,
      url:       url.toString(),
      recipient,
      amount,
      currency,
    });
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

    const payment = check.rows[0];
    if (payment.status === 'completed') {
      return res.status(400).json({ error: 'cannot delete a completed payment' });
    }

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
