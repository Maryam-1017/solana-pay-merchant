'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WalletConnect } from '../../../components/WalletConnect';
import { SolanaPayQR } from '../../../components/SolanaPayQR';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
type Currency = 'SOL' | 'USDC';
type Status   = 'idle' | 'pending' | 'paid' | 'error';

export default function PaymentPage() {
  const [amount,    setAmount]   = useState('');
  const [label,     setLabel]    = useState('');
  const [currency,  setCurrency] = useState<Currency>('SOL');
  const [payUrl,    setPayUrl]   = useState('');
  const [reference, setRef]      = useState('');
  const [status,    setStatus]   = useState<Status>('idle');
  const [errorMsg,  setError]    = useState('');

  const reset = () => {
    setAmount(''); setLabel(''); setPayUrl(''); setRef('');
    setStatus('idle'); setError('');
  };

  const handleGenerate = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;
    setStatus('idle'); setError(''); setPayUrl(''); setRef('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsed, label: label || undefined, currency }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error || 'Failed to create payment'); setStatus('error'); return;
      }
      const data = await res.json();
      setRef(data.reference); setPayUrl(data.url); setStatus('pending');
    } catch {
      setError('Cannot reach backend — is it running on port 4000?'); setStatus('error');
    }
  };

  useEffect(() => {
    if (!reference || status === 'paid') return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/payments/status?reference=${encodeURIComponent(reference)}`);
        if (!res.ok) return;
        const d = await res.json();
        if (d.status === 'completed') setStatus('paid');
      } catch { /**/ }
    }, 3000);
    return () => clearInterval(iv);
  }, [reference, status]);

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-4xl mx-auto">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8 text-sm" style={{ color:'var(--text-3)' }}>
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <span>/</span>
          <span style={{ color:'var(--text-1)' }}>New Payment</span>
        </div>

        {status === 'paid' ? (

          /* ── Success screen ─────────────────────────── */
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 anim-slide-up text-center">
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center text-4xl"
              style={{ background:'rgba(20,241,149,0.15)', border:'2px solid rgba(20,241,149,0.4)' }}
            >
              ✓
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-[#14F195]">Payment Received!</h2>
              <p className="mt-1 text-sm" style={{ color:'var(--text-2)' }}>
                {amount} {currency} has landed in your wallet.
              </p>
            </div>
            <button onClick={reset} className="btn-sol px-7 py-3 text-sm rounded-xl">
              New Payment
            </button>
          </div>

        ) : (

          /* ── Main layout ────────────────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Left: Form */}
            <div className="flex flex-col gap-5">
              <WalletConnect />

              {/* Currency toggle */}
              <div>
                <label className="block mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>
                  Currency
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['SOL','USDC'] as Currency[]).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCurrency(c)}
                      className="relative flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all duration-200"
                      style={{
                        background: currency === c
                          ? 'linear-gradient(135deg,rgba(153,69,255,0.22),rgba(20,241,149,0.1))'
                          : 'rgba(255,255,255,0.03)',
                        border: currency === c
                          ? '1px solid rgba(153,69,255,0.55)'
                          : '1px solid var(--border)',
                        color: currency === c ? '#fff' : 'var(--text-2)',
                        boxShadow: currency === c ? '0 0 20px rgba(153,69,255,0.2)' : 'none',
                      }}
                    >
                      <span>{c === 'SOL' ? '◎' : '💵'}</span>
                      {c}
                      {c === 'USDC' && (
                        <span className="absolute -top-1.5 -right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full"
                          style={{ background:'#14F195', color:'#080812' }}>
                          STABLE
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {currency === 'USDC' && (
                  <p className="mt-2 text-xs" style={{ color:'var(--text-3)' }}>
                    Devnet USDC — customer wallet needs devnet balance
                  </p>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>
                  Amount ({currency})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="sol-input pr-14"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    min="0"
                    step={currency === 'USDC' ? '0.01' : '0.001'}
                    placeholder={currency === 'USDC' ? '1.50' : '0.01'}
                  />
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold"
                    style={{ color:'var(--text-3)' }}
                  >
                    {currency}
                  </span>
                </div>
              </div>

              {/* Label */}
              <div>
                <label className="block mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>
                  Label <span className="font-normal" style={{ color:'var(--text-3)' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  className="sol-input"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Coffee, Table #4, Invoice #101"
                  maxLength={80}
                />
              </div>

              <button
                className="btn-sol w-full py-3.5 text-sm rounded-xl mt-1"
                onClick={handleGenerate}
                disabled={!amount || parseFloat(amount) <= 0}
              >
                Generate {currency} QR Code ↗
              </button>

              {status === 'error' && (
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)', color:'#F87171' }}
                >
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Right: QR panel */}
            <div
              className="flex flex-col items-center justify-center rounded-2xl min-h-[320px] gap-6 p-8"
              style={{ background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}
            >
              {payUrl ? (
                <>
                  <SolanaPayQR url={payUrl} />
                  {status === 'pending' && (
                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color:'#FCD34D' }}>
                      <span className="h-2 w-2 rounded-full bg-yellow-400 anim-pulse" />
                      Waiting for payment…
                    </div>
                  )}
                  <span className={`pill-${currency.toLowerCase()}`}>
                    {currency === 'SOL' ? '◎' : '💵'} {amount} {currency}
                  </span>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div
                    className="h-20 w-20 rounded-2xl flex items-center justify-center text-3xl"
                    style={{ background:'rgba(153,69,255,0.08)', border:'1px dashed rgba(153,69,255,0.3)' }}
                  >
                    ⚡
                  </div>
                  <p className="text-sm font-medium" style={{ color:'var(--text-2)' }}>
                    Enter an amount and generate<br />your payment QR code
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
