'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

interface Merchant {
  id: number;
  name: string;
  wallet_address: string;
  category: string;
  email: string | null;
  reward_rate: number;
  created_at: string;
}

const CATEGORIES = [
  { value:'food',      label:'🍕 Food & Drink' },
  { value:'retail',    label:'🛍️ Retail'      },
  { value:'services',  label:'🔧 Services'     },
  { value:'online',    label:'🌐 Online Store' },
  { value:'freelance', label:'💻 Freelance'    },
  { value:'general',   label:'📦 Other'        },
];

// Resolve wallet: localStorage → Phantom provider → null
function getSavedWallet(): string | null {
  try { return localStorage.getItem('solpay_merchant_wallet'); } catch { return null; }
}
function getPhantomWallet(): string | null {
  if (typeof window === 'undefined') return null;
  const p = (window as any).phantom?.solana ?? (window as any).solana;
  return p?.isPhantom && p.publicKey ? p.publicKey.toString() : null;
}

export default function ProfilePage() {
  const [merchant,  setMerchant]  = useState<Merchant | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState('');
  const [error,     setError]     = useState('');

  // Edit form state
  const [name,  setName]  = useState('');
  const [cat,   setCat]   = useState('general');
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Read localStorage synchronously before any network call so the
    // profile renders immediately — no API needed, no loading spinner.
    try {
      const raw = localStorage.getItem('solpay_merchant_data');
      if (raw) {
        const m: Merchant = JSON.parse(raw);
        console.log('[profile] instant cache:', m.name, m.wallet_address?.slice(0, 8));
        setMerchant(m);
        setName(m.name);
        setCat(m.category || 'general');
        setEmail(m.email || '');
        setLoading(false);
      }
    } catch { /* ignore bad JSON */ }

    loadMerchant(); // background refresh
  }, []);

  async function loadMerchant() {
    setError('');

    // ── Step 2: refresh from backend (updates cache if DB is live) ──────────
    try {
      console.log('[profile] fetching from backend:', BACKEND_URL);

      // If we have a wallet, ONLY look up that specific merchant.
      // Never fall back to /latest (which could return a different merchant).
      const wallet = getSavedWallet() || getPhantomWallet();
      let res: Response;
      if (wallet) {
        res = await fetch(`${BACKEND_URL}/api/merchants/profile?wallet=${encodeURIComponent(wallet)}`);
        console.log('[profile] /api/merchants/profile →', res.status);
      } else {
        // No wallet at all — only then use /latest
        res = await fetch(`${BACKEND_URL}/api/merchants/latest`);
        console.log('[profile] /api/merchants/latest →', res.status);
      }

      if (res.ok) {
        const data: Merchant = await res.json();
        console.log('[profile] backend loaded:', data.name, data.wallet_address?.slice(0, 8));
        // Update state and cache with fresh data
        setMerchant(data);
        setName(data.name);
        setCat(data.category || 'general');
        setEmail(data.email || '');
        try {
          localStorage.setItem('solpay_merchant_wallet', data.wallet_address);
          localStorage.setItem('solpay_merchant_data',   JSON.stringify(data));
        } catch { /**/ }
      } else if (res.status === 404) {
        // Backend has no merchant — only show error if cache was also empty
        // Only show "no merchant" if cache was also empty
        setMerchant(m => { if (!m) setError('no_merchant'); return m; });
        console.log('[profile] 404 from backend — showing cache or no_merchant');
      }
    } catch (err) {
      console.error('[profile] backend error:', err);
      // Only show backend_down if we have no cached data to show
      setMerchant(m => { if (!m) setError('backend_down'); return m; });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!merchant) return;
    setSaving(true); setSaveMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/merchants/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, walletAddress: merchant.wallet_address, category: cat, email }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveMsg(data.error || 'Save failed'); return; }
      setMerchant(data);
      setEditing(false);
      setSaveMsg('✓ Profile updated');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch {
      setSaveMsg('Cannot reach backend');
    } finally {
      setSaving(false);
    }
  }

  const short = (addr: string) => `${addr.slice(0, 8)}…${addr.slice(-6)}`;

  // ── States ───────────────────────────────────────────────────────────────────

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <span className="animate-spin h-6 w-6 rounded-full border-2 border-purple-400 border-t-transparent" />
    </main>
  );

  if (error === 'no_merchant') return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="glass rounded-2xl p-10 max-w-sm w-full text-center flex flex-col gap-5">
        <span className="text-4xl">🏪</span>
        <h2 className="text-xl font-bold">No merchant registered yet</h2>
        <p className="text-sm" style={{ color:'var(--text-2)' }}>
          Complete onboarding to create your merchant profile.
        </p>
        <Link href="/onboarding" className="btn-sol px-6 py-3 text-sm rounded-xl text-center">
          Register Now →
        </Link>
      </div>
    </main>
  );

  if (error === 'backend_down') return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="glass rounded-2xl p-10 max-w-sm w-full text-center">
        <p className="text-sm" style={{ color:'#F87171' }}>Could not reach backend. Is it running?</p>
        <button onClick={loadMerchant} className="mt-4 btn-ghost px-5 py-2 text-sm rounded-xl">Retry</button>
      </div>
    </main>
  );

  if (!merchant) return null;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="text-xs hover:text-white transition-colors" style={{ color:'var(--text-3)' }}>
            ← Dashboard
          </Link>
          <span style={{ color:'var(--text-3)' }}>/</span>
          <h1 className="text-2xl font-extrabold">Merchant Profile</h1>
        </div>

        {/* Profile card */}
        <div className="glass rounded-2xl p-6 mb-4">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-2xl font-black"
                style={{ background:'linear-gradient(135deg,#9945FF,#14F195)' }}>
                {merchant.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold">{merchant.name}</h2>
                <p className="text-xs mt-0.5 capitalize" style={{ color:'var(--text-3)' }}>
                  {CATEGORIES.find(c => c.value === merchant.category)?.label || merchant.category}
                </p>
              </div>
            </div>
            {!editing && (
              <button onClick={() => setEditing(true)}
                className="btn-ghost px-4 py-2 text-xs rounded-xl">
                Edit
              </button>
            )}
          </div>

          {/* Info rows */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center py-2 border-b" style={{ borderColor:'var(--border)' }}>
              <span className="text-xs font-semibold" style={{ color:'var(--text-3)' }}>WALLET</span>
              <span className="font-mono text-sm text-[#C084FC]">{short(merchant.wallet_address)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b" style={{ borderColor:'var(--border)' }}>
              <span className="text-xs font-semibold" style={{ color:'var(--text-3)' }}>EMAIL</span>
              <span className="text-sm">{merchant.email || <span style={{ color:'var(--text-3)' }}>—</span>}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b" style={{ borderColor:'var(--border)' }}>
              <span className="text-xs font-semibold" style={{ color:'var(--text-3)' }}>REWARD RATE</span>
              <span className="text-sm font-bold text-[#14F195]">{merchant.reward_rate || 1}x</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-xs font-semibold" style={{ color:'var(--text-3)' }}>REGISTERED</span>
              <span className="text-sm">{new Date(merchant.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="glass rounded-2xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-sm" style={{ color:'var(--text-2)' }}>Update Profile</h3>

            <div>
              <label className="block mb-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>Business Name</label>
              <input className="sol-input" value={name} onChange={e => setName(e.target.value)} placeholder="My Store" />
            </div>

            <div>
              <label className="block mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button key={c.value} type="button" onClick={() => setCat(c.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: cat === c.value ? 'rgba(153,69,255,0.2)' : 'rgba(255,255,255,0.04)',
                      border:     cat === c.value ? '1px solid rgba(153,69,255,0.55)' : '1px solid var(--border)',
                      color:      cat === c.value ? '#C084FC' : 'var(--text-2)',
                    }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block mb-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>Email</label>
              <input className="sol-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>

            {saveMsg && (
              <p className="text-xs" style={{ color: saveMsg.startsWith('✓') ? '#14F195' : '#F87171' }}>
                {saveMsg}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="btn-sol flex-1 py-2.5 text-sm rounded-xl">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => { setEditing(false); setSaveMsg(''); }}
                className="btn-ghost px-5 py-2.5 text-sm rounded-xl">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Full wallet address */}
        <div className="glass rounded-2xl p-4 mt-4">
          <p className="text-xs mb-1.5 font-semibold" style={{ color:'var(--text-3)' }}>FULL WALLET ADDRESS</p>
          <p className="font-mono text-xs break-all" style={{ color:'#C084FC' }}>{merchant.wallet_address}</p>
        </div>

        <div className="mt-4 flex gap-3">
          <Link href="/dashboard/payment" className="btn-sol flex-1 py-3 text-sm rounded-xl text-center">
            Generate Payment →
          </Link>
          <Link href="/onboarding" className="btn-ghost flex-1 py-3 text-sm rounded-xl text-center">
            Re-Register
          </Link>
        </div>
      </div>
    </main>
  );
}
