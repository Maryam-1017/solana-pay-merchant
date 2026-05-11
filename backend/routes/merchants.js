const express = require('express');
const router  = express.Router();
const { registerMerchant, getMerchantByWallet, getFirstMerchant } = require('../db');

// Solana addresses are base58-encoded 32-byte keys: 32–44 chars, no 0/O/I/l
function isValidSolanaAddress(addr) {
  return typeof addr === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

// POST /api/merchants/register
router.post('/merchants/register', async (req, res) => {
  try {
    const { name, walletAddress, category, email } = req.body;

    if (!name || typeof name !== 'string' || !name.trim())
      return res.status(400).json({ error: 'name is required' });

    if (!walletAddress)
      return res.status(400).json({ error: 'walletAddress is required' });

    if (!isValidSolanaAddress(walletAddress))
      return res.status(400).json({ error: 'invalid Solana wallet address' });

    const merchant = await registerMerchant({
      name:          name.trim(),
      walletAddress,
      category:      category || 'general',
      email:         email    || null,
    });

    return res.json(merchant);
  } catch (err) {
    console.error('merchant register error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// GET /api/merchants/profile?wallet=<address>
router.get('/merchants/profile', async (req, res) => {
  try {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet param required' });

    const merchant = await getMerchantByWallet(wallet);
    if (!merchant) return res.status(404).json({ error: 'merchant not found' });

    return res.json(merchant);
  } catch (err) {
    console.error('merchant profile error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// GET /api/merchants/latest — returns the most recently registered merchant.
// Used by the profile page when no wallet address is available yet.
router.get('/merchants/latest', async (_req, res) => {
  try {
    const merchant = await getFirstMerchant();
    if (!merchant) return res.status(404).json({ error: 'no merchant registered yet' });
    return res.json(merchant);
  } catch (err) {
    console.error('merchant latest error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
