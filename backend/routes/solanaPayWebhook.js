const express = require('express');
const router  = express.Router();
const { markPaymentCompleted, getPaymentByReference } = require('../db');

const USDC_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// POST /api/webhook/solana-pay
router.post('/webhook/solana-pay', async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    console.log(`[webhook] received ${events.length} event(s)`);

    for (const event of events) {
      const signature = event.signature || '';
      console.log(`[webhook] processing tx: ${signature}`);

      // ── Collect ALL account keys in the transaction ────────────────────────
      // accountData only has accounts with balance changes (misses read-only keys).
      // instructions[*].accounts has EVERY account, including the Solana Pay
      // reference key which is read-only and has zero balance change.
      const accountKeys = new Set();

      for (const a of (event.accountData || [])) {
        if (a.account) accountKeys.add(a.account);
      }

      // Walk every instruction + inner instruction for their account lists
      for (const ix of (event.instructions || [])) {
        for (const acc of (ix.accounts || [])) {
          if (typeof acc === 'string')   accountKeys.add(acc);
          else if (acc?.pubkey)          accountKeys.add(acc.pubkey);
        }
        for (const inner of (ix.innerInstructions || [])) {
          for (const acc of (inner.accounts || [])) {
            if (typeof acc === 'string') accountKeys.add(acc);
            else if (acc?.pubkey)        accountKeys.add(acc.pubkey);
          }
        }
      }

      console.log(`[webhook] ${accountKeys.size} unique accounts in tx`);

      // ── USDC / SPL token transfers ─────────────────────────────────────────
      for (const t of (event.tokenTransfers || [])) {
        if (t.mint !== USDC_DEVNET_MINT) continue;
        console.log(`[webhook] USDC transfer: ${t.tokenAmount} → ${t.toUserAccount}`);
        await matchAndComplete([...accountKeys], t.toUserAccount, parseFloat(t.tokenAmount), 'USDC', signature);
      }

      // ── SOL native transfers ───────────────────────────────────────────────
      for (const t of (event.nativeTransfers || [])) {
        const amountSol = t.amount / 1e9;
        console.log(`[webhook] SOL transfer: ${amountSol} → ${t.toUserAccount}`);
        await matchAndComplete([...accountKeys], t.toUserAccount, amountSol, 'SOL', signature);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[webhook] error:', err.message);
    return res.status(500).json({ success: false, error: 'internal' });
  }
});

// Walk every account key in the tx looking for a pending payment reference.
// Checks: reference in DB → recipient matches → amount within 1% → mark done.
async function matchAndComplete(accountKeys, recipient, amount, currency, signature) {
  for (const ref of accountKeys) {
    const payment = await getPaymentByReference(ref);
    if (!payment)                        continue;
    if (payment.status === 'completed')  continue;
    if (payment.currency !== currency)   continue;
    if (payment.recipient !== recipient) continue;

    // Allow 1% tolerance to handle rounding and minor price variations
    const stored = Number(payment.amount);
    if (stored > 0 && Math.abs(stored - amount) / stored > 0.01) continue;

    console.log(`[webhook] ✓ matched payment ${ref} — marking completed`);
    await markPaymentCompleted(ref, signature);
    return true;
  }
  return false;
}

module.exports = router;
