'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

type Status = 'idle' | 'loading' | 'error';

export default function LoginPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errMsg,  setErrMsg]  = useState('');

  const detectWallet = () => {
    const p = typeof window !== 'undefined'
      ? (window as any).phantom?.solana ?? (window as any).solana
      : null;
    if (p?.isPhantom && p.publicKey) {
      setWallet(p.publicKey.toString());
      setStatus('idle');
      setErrMsg('');
    } else {
      alert('Connect Phantom first, or paste your wallet address manually.');
    }
  };

  const handleLogin = async () => {
    const addr = wallet.trim();
    if (!addr) return;
    setStatus('loading'); setErrMsg('');
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/merchants/profile?wallet=${encodeURIComponent(addr)}`
      );
      if (!res.ok) {
        setStatus('error');
        setErrMsg('No merchant account found for this wallet.');
        return;
      }
      const data = await res.json();
      try {
        localStorage.setItem('solpay_merchant_wallet', data.wallet_address);
        localStorage.setItem('solpay_merchant_data',   JSON.stringify(data));
      } catch { /**/ }
      router.push('/dashboard');
    } catch {
      setStatus('error');
      setErrMsg('Could not reach backend — is it running?');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl font-black shadow-lg"
              style={{ background:'linear-gradient(135deg,#9945FF,#14F195)' }}>◎</span>
            <span className="font-extrabold g-text text-xl">SolPay</span>
          </Link>
          <h1 className="text-3xl font-extrabold">Welcome back</h1>
          <p className="mt-2 text-sm" style={{ color:'var(--text-2)' }}>
            Enter your wallet address to access your merchant dashboard.
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <label className="block mb-1.5 text-xs font-semibold uppercase tracking-widest"
              style={{ color:'var(--text-3)' }}>
              Wallet Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="sol-input font-mono text-xs flex-1"
                value={wallet}
                onChange={e => { setWallet(e.target.value); setStatus('idle'); setErrMsg(''); }}
                onKeyDown={e => e.key === 'Enter' && void handleLogin()}
                placeholder="Paste your Solana wallet address"
                autoFocus
              />
              <button type="button" onClick={detectWallet}
                className="btn-ghost px-3 py-2 text-xs rounded-xl whitespace-nowrap">
                👻 Phantom
              </button>
            </div>
          </div>

          {status === 'error' && (
            <div className="rounded-xl px-4 py-3 text-xs"
              style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', color:'#F87171' }}>
              {errMsg}{' '}
              {errMsg.includes('No merchant') && (
                <Link href="/onboarding" className="underline font-semibold">Register here →</Link>
              )}
            </div>
          )}

          <button
            onClick={() => void handleLogin()}
            disabled={!wallet.trim() || status === 'loading'}
            className="btn-sol w-full py-3 text-sm rounded-xl"
          >
            {status === 'loading'
              ? <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Checking…
                </span>
              : 'Access Dashboard →'}
          </button>

          <p className="text-center text-xs" style={{ color:'var(--text-3)' }}>
            No account?{' '}
            <Link href="/onboarding" className="text-[#9945FF] hover:underline font-semibold">
              Register as merchant →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
