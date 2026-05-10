const express = require('express');
const router = express.Router();
const { registerMerchant, getMerchantByWallet } = require('../db');
const { PublicKey } = require('@solana/web3.js');

// POST /api/merchants/register
// body: { name, walletAddress, category?, email? }
router.post('/merchants/register', async (req, res) => {
  try {
    const { name, walletAddress, category, email } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    // validate it's a real Solana public key
    try {
      new PublicKey(walletAddress);
    } catch {
      return res.status(400).json({ error: 'invalid Solana wallet address' });
    }

    const merchant = await registerMerchant({
      name: name.trim(),
      walletAddress,
      category: category || 'general',
      email: email || null,
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

module.exports = router;
