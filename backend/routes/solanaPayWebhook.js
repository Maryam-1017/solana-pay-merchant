const express = require('express');
const router = express.Router();
const { markPaymentCompleted, getPaymentByReference } = require('../db');

const USDC_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// POST /api/webhook/solana-pay
// Helius Enhanced Transactions webhook — handles both SOL and USDC transfers.
//
// Helius sends an array of enhanced transaction objects. For each we:
//   1. Extract all account keys (one of them will be the Solana Pay reference)
//   2. Check tokenTransfers for USDC payments
//   3. Check nativeTransfers for SOL payments
//   4. Try each account key as a potential reference until we find a DB match
router.post('/webhook/solana-pay', async (req, res) => {
  try {
    // Helius sends an array; tolerate a bare object too
    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
      const signature = event.signature || '';

      // All accounts involved in the transaction — the Solana Pay reference
      // is one of them (it's a read-only account key the wallet includes)
      const accountKeys = (event.accountData || [])
        .map((a) => a.account)
        .filter(Boolean);

      // ── USDC / SPL token transfers ──────────────────────────────────────
      for (const t of event.tokenTransfers || []) {
        if (t.mint !== USDC_DEVNET_MINT) continue;

        const recipient   = t.toUserAccount;
        const amountUsdc  = parseFloat(t.tokenAmount);

        await matchAndComplete(accountKeys, recipient, amountUsdc, 'USDC', signature);
      }

      // ── SOL native transfers ────────────────────────────────────────────
      for (const t of event.nativeTransfers || []) {
        const recipient = t.toUserAccount;
        const amountSol = t.amount / 1e9; // lamports → SOL

        await matchAndComplete(accountKeys, recipient, amountSol, 'SOL', signature);
      }

      // ── Legacy format (original assumption — kept for backward compat) ──
      for (const t of event.transfers || []) {
        const reference = t.reference;
        const recipient = t.account;
        const amount    = parseFloat(t.amount);
        const txSig     = t.signature || signature;

        if (!reference) continue;
        const payment = await getPaymentByReference(reference);
        if (!payment || payment.recipient !== recipient) continue;
        if (Math.abs(Number(payment.amount) - amount) > 0.000001) continue;
        await markPaymentCompleted(reference, txSig);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Webhook error', err);
    return res.status(500).json({ success: false, error: 'internal' });
  }
});

// Walk every account key in the transaction looking for one that matches a
// pending payment record with the right recipient, amount, and currency.
async function matchAndComplete(accountKeys, recipient, amount, currency, signature) {
  for (const ref of accountKeys) {
    const payment = await getPaymentByReference(ref);
    if (!payment)                                          continue;
    if (payment.status === 'completed')                    continue;
    if (payment.currency !== currency)                     continue;
    if (payment.recipient !== recipient)                   continue;
    if (Math.abs(Number(payment.amount) - amount) > 0.000001) continue;

    await markPaymentCompleted(ref, signature);
    return; // found — stop searching this transaction
  }
}

module.exports = router;
