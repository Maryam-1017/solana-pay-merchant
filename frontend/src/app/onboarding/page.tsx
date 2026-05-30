'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

const CATEGORIES = [
  { value:'food',      label:'🍕 Food & Drink' },
  { value:'retail',    label:'🛍️ Retail'      },
  { value:'services',  label:'🔧 Services'     },
  { value:'online',    label:'🌐 Online Store' },
  { value:'freelance', label:'💻 Freelance'    },
  { value:'general',   label:'📦 Other'        },
];

type Status = 'idle'|'loading'|'success'|'error';

export default function OnboardingPage() {
  const router = useRouter();

  const [name,      setName]      = useState('');
  const [wallet,    setWallet]    = useState('');
  const [cat,       setCat]       = useState('general');
  const [email,     setEmail]     = useState('');
  const [status,    setStatus]    = useState<Status>('idle');
  const [errMsg,    setErrMsg]    = useState('');
  const [done,      setDone]      = useState<{ name:string; wallet_address:string; category:string }|null>(null);
  const [alreadyIn, setAlreadyIn] = useState(false);

  // Block access if already registered
  useEffect(() => {
    try {
      if (localStorage.getItem('solpay_merchant_wallet')) setAlreadyIn(true);
    } catch { /**/ }
  }, []);

  const detectWallet = () => {
    const p = typeof window !== 'undefined' ? (window as any).phantom?.solana ?? (window as any).solana : null;
    if (p?.isPhantom && p.publicKey) {
      setWallet(p.publicKey.toString());
    } else {
      alert('Connect Phantom first, or paste your address manually.');
    }
  };

  const handleSubmit = async () => {
    setStatus('loading'); setErrMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/merchants/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, walletAddress: wallet, category: cat, email }),
      });
      const data = await res.json();
      if (!res.ok) { setErrMsg(data.error || 'Registration failed'); setStatus('error'); return; }
      // Persist full merchant object — profile page reads this directly,
      // so it works even if DB is unavailable (demo/no-DB mode).
      try {
        localStorage.setItem('solpay_merchant_wallet', wallet);
        localStorage.setItem('solpay_merchant_data',   JSON.stringify(data));
        console.log('[onboarding] saved to localStorage:', data.name, wallet.slice(0, 8));
      } catch { /* ignore */ }
      setDone(data); setStatus('success');
      // Auto-redirect to dashboard — merchant is now logged in
      setTimeout(() => router.push('/dashboard'), 1800);
    } catch {
      setErrMsg('Cannot reach backend — is it running on port 4000?'); setStatus('error');
    }
  };

  /* ── Already logged in ── */
  if (alreadyIn && status === 'idle') {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="glass rounded-2xl p-10 max-w-sm w-full text-center flex flex-col gap-5">
          <span className="text-4xl">✅</span>
          <h2 className="text-xl font-bold">You're already registered</h2>
          <p className="text-sm" style={{ color:'var(--text-2)' }}>
            Your merchant account is active. Go to the dashboard to accept payments.
          </p>
          <Link href="/dashboard" className="btn-sol py-3 text-sm rounded-xl">
            Go to Dashboard →
          </Link>
          <button
            onClick={() => {
              try {
                Object.keys(localStorage)
                  .filter(k => k.startsWith('solpay_'))
                  .forEach(k => localStorage.removeItem(k));
              } catch { /**/ }
              setAlreadyIn(false);
            }}
            className="text-xs hover:underline" style={{ color:'var(--text-3)' }}>
            Register a different account instead
          </button>
        </div>
      </main>
    );
  }

  /* ── Success ── */
  if (status === 'success' && done) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-10">
        <div className="glass rounded-3xl p-10 max-w-md w-full text-center flex flex-col items-center gap-5 anim-slide-up">
          <div
            className="h-20 w-20 rounded-full flex items-center justify-center text-4xl"
            style={{ background:'rgba(20,241,149,0.12)', border:'2px solid rgba(20,241,149,0.4)' }}
          >
            🎉
          </div>
          <div>
            <h2 className="text-2xl font-extrabold">You're live!</h2>
            <p className="text-sm mt-1" style={{ color:'var(--text-2)' }}>
              <span className="font-semibold text-white">{done.name}</span> is now accepting Solana Pay.
            </p>
          </div>
          <div className="w-full rounded-xl px-4 py-3 text-left text-xs" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)' }}>
            <div className="flex justify-between py-1">
              <span style={{ color:'var(--text-3)' }}>Wallet</span>
              <span className="font-mono text-[#C084FC]">
                {done.wallet_address.slice(0,8)}…{done.wallet_address.slice(-6)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span style={{ color:'var(--text-3)' }}>Category</span>
              <span className="capitalize">{done.category}</span>
            </div>
          </div>
          <Link href="/dashboard/payment" className="btn-sol w-full py-3 text-sm rounded-xl text-center">
            Generate First Payment →
          </Link>
          <Link href="/dashboard" className="text-xs" style={{ color:'var(--text-3)' }}>
            Go to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  /* ── Form ── */
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="mb-8 anim-slide-up">
          <Link href="/" className="text-xs mb-4 inline-block transition-colors hover:text-white" style={{ color:'var(--text-3)' }}>
            ← Home
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Merchant <span className="g-text">Onboarding</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color:'var(--text-2)' }}>
            Start accepting SOL &amp; USDC in under 60 seconds.
          </p>
        </div>

        {/* Progress strip */}
        <div className="flex gap-1.5 mb-8">
          {[1,2,3].map(s => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full"
              style={{ background: s === 1 ? 'linear-gradient(90deg,#9945FF,#14F195)' : 'rgba(255,255,255,0.08)' }}
            />
          ))}
        </div>

        <form onSubmit={e => { e.preventDefault(); void handleSubmit(); }} className="glass rounded-2xl p-6 flex flex-col gap-5">

          {/* Business name */}
          <div>
            <label className="block mb-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>
              Business Name *
            </label>
            <input
              required
              type="text"
              className="sol-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Awesome Store"
            />
          </div>

          {/* Wallet */}
          <div>
            <label className="block mb-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>
              Solana Wallet Address *
            </label>
            <div className="flex gap-2">
              <input
                required
                type="text"
                className="sol-input font-mono text-xs flex-1"
                value={wallet}
                onChange={e => setWallet(e.target.value)}
                placeholder="Paste or auto-detect from Phantom"
              />
              <button
                type="button"
                onClick={detectWallet}
                className="btn-ghost px-3 py-2 text-xs rounded-xl whitespace-nowrap"
              >
                👻 Auto-detect
              </button>
            </div>
            <p className="mt-1.5 text-xs" style={{ color:'var(--text-3)' }}>
              Payments go directly to this wallet — no intermediary.
            </p>
          </div>

          {/* Category pills */}
          <div>
            <label className="block mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCat(c.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: cat === c.value ? 'rgba(153,69,255,0.2)' : 'rgba(255,255,255,0.04)',
                    border: cat === c.value ? '1px solid rgba(153,69,255,0.55)' : '1px solid var(--border)',
                    color: cat === c.value ? '#C084FC' : 'var(--text-2)',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block mb-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>
              Email <span className="font-normal" style={{ color:'var(--text-3)' }}>(optional)</span>
            </label>
            <input
              type="email"
              className="sol-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {errMsg && (
            <div className="rounded-xl px-4 py-3 text-xs" style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', color:'#F87171' }}>
              {errMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="btn-sol w-full py-3.5 text-sm rounded-xl mt-1"
          >
            {status === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Registering…
              </span>
            ) : 'Register Merchant →'}
          </button>
        </form>

        {/* Trust indicators */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs" style={{ color:'var(--text-3)' }}>
          <span>🔒 Non-custodial</span>
          <span>⚡ Instant setup</span>
          <span>0️⃣ Zero fees</span>
        </div>
      </div>
    </main>
  );
}
