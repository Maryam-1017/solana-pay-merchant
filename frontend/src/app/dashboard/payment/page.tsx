'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { WalletConnect } from '../../../components/WalletConnect';
import { SolanaPayQR } from '../../../components/SolanaPayQR';

const BACKEND_URL    = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
const FRONTEND_BASE  = 'https://solana-pay-merchant.vercel.app';

type Currency = 'SOL' | 'USDC';
type Status   = 'idle' | 'pending' | 'paid' | 'error';

export default function PaymentPage() {
  const [amount,         setAmount]        = useState('');
  const [label,          setLabel]         = useState('');
  const [currency,       setCurrency]      = useState<Currency>('SOL');
  const [payUrl,         setPayUrl]        = useState('');
  const [paymentLink,    setPaymentLink]   = useState('');
  const [reference,      setRef]           = useState('');
  const [loyaltyPoints,  setLoyalty]       = useState(0);
  const [status,         setStatus]        = useState<Status>('idle');
  const [errorMsg,       setError]         = useState('');
  const [copied,         setCopied]        = useState(false);
  const [online,         setOnline]        = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up   = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const reset = () => {
    setAmount(''); setLabel(''); setPayUrl(''); setRef(''); setPaymentLink('');
    setStatus('idle'); setError(''); setLoyalty(0);
  };

  const handleGenerate = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;

    // Save to localStorage for offline resilience
    const offlineKey = `solpay_pending_${Date.now()}`;

    setStatus('idle'); setError(''); setPayUrl(''); setRef(''); setPaymentLink('');
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
      setRef(data.reference);
      setPayUrl(data.url);
      setLoyalty(data.loyaltyPoints || 0);

      const link = data.paymentLink || `${FRONTEND_BASE}/pay/${data.reference}`;
      setPaymentLink(link);

      // Cache in localStorage for offline access
      try {
        localStorage.setItem(offlineKey, JSON.stringify({
          reference: data.reference, url: data.url, link, amount: parsed, currency, label,
          createdAt: Date.now(),
        }));
      } catch { /* ignore storage errors */ }

      setStatus('pending');
    } catch {
      // Offline fallback — try to show last cached payment
      if (!online) {
        setError('Offline — showing last generated QR from cache.');
        try {
          const keys = Object.keys(localStorage).filter(k => k.startsWith('solpay_pending_')).sort().reverse();
          if (keys.length > 0) {
            const cached = JSON.parse(localStorage.getItem(keys[0]) || '{}');
            if (cached.url) { setPayUrl(cached.url); setPaymentLink(cached.link || ''); setStatus('pending'); return; }
          }
        } catch { /* ignore */ }
      }
      setError('Cannot reach backend — is it running?'); setStatus('error');
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
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(iv);
  }, [reference, status]);

  const copyLink = useCallback(async () => {
    if (!paymentLink) return;
    await navigator.clipboard.writeText(paymentLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [paymentLink]);

  const whatsappMsg = encodeURIComponent(
    `Pay me ${amount} ${currency}${label ? ` for "${label}"` : ''} using Solana Pay:\n${paymentLink}`
  );

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center gap-2 mb-8 text-sm" style={{ color:'var(--text-3)' }}>
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <span>/</span>
          <span style={{ color:'var(--text-1)' }}>New Payment</span>
          {!online && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background:'rgba(251,146,60,0.15)', color:'#FB923C', border:'1px solid rgba(251,146,60,0.3)' }}>
              ⚡ Offline Mode
            </span>
          )}
        </div>

        {status === 'paid' ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center anim-slide-up">
            <div className="h-20 w-20 rounded-full flex items-center justify-center text-4xl"
              style={{ background:'rgba(20,241,149,0.15)', border:'2px solid rgba(20,241,149,0.4)' }}>✓</div>
            <div>
              <h2 className="text-2xl font-extrabold text-[#14F195]">Payment Received!</h2>
              <p className="mt-1 text-sm" style={{ color:'var(--text-2)' }}>
                {amount} {currency} confirmed on Solana.
              </p>
              {loyaltyPoints > 0 && (
                <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
                  style={{ background:'rgba(20,241,149,0.12)', border:'1px solid rgba(20,241,149,0.3)', color:'#14F195' }}>
                  🎁 Customer earned {loyaltyPoints} loyalty points!
                </div>
              )}
            </div>
            <button onClick={reset} className="btn-sol px-7 py-3 text-sm rounded-xl">New Payment</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Left: Form */}
            <div className="flex flex-col gap-5">
              <WalletConnect />

              {/* Currency toggle */}
              <div>
                <label className="block mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>Currency</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['SOL','USDC'] as Currency[]).map(c => (
                    <button key={c} type="button" onClick={() => setCurrency(c)}
                      className="relative flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all duration-200"
                      style={{
                        background: currency === c ? 'linear-gradient(135deg,rgba(153,69,255,0.22),rgba(20,241,149,0.1))' : 'rgba(255,255,255,0.03)',
                        border: currency === c ? '1px solid rgba(153,69,255,0.55)' : '1px solid var(--border)',
                        color: currency === c ? '#fff' : 'var(--text-2)',
                        boxShadow: currency === c ? '0 0 20px rgba(153,69,255,0.2)' : 'none',
                      }}>
                      <span>{c === 'SOL' ? '◎' : '💵'}</span>{c}
                      {c === 'USDC' && <span className="absolute -top-1.5 -right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background:'#14F195', color:'#080812' }}>STABLE</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>
                  Amount ({currency})
                </label>
                <div className="relative">
                  <input type="number" className="sol-input pr-14" value={amount}
                    onChange={e => setAmount(e.target.value)} min="0"
                    step={currency === 'USDC' ? '0.01' : '0.001'}
                    placeholder={currency === 'USDC' ? '1.50' : '0.01'} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color:'var(--text-3)' }}>{currency}</span>
                </div>
                {amount && parseFloat(amount) > 0 && (
                  <p className="text-xs mt-1" style={{ color:'var(--text-3)' }}>
                    🎁 Customer earns {currency === 'USDC' ? Math.floor(parseFloat(amount)) : Math.floor(parseFloat(amount) * 10)} loyalty points
                  </p>
                )}
              </div>

              {/* Label */}
              <div>
                <label className="block mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>
                  Label <span className="font-normal">(optional)</span>
                </label>
                <input type="text" className="sol-input" value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Coffee, Table #4, Invoice #101" maxLength={80} />
              </div>

              <button className="btn-sol w-full py-3.5 text-sm rounded-xl mt-1"
                onClick={handleGenerate} disabled={!amount || parseFloat(amount) <= 0}>
                Generate {currency} QR + Payment Link ↗
              </button>

              {status === 'error' && (
                <div className="rounded-xl px-4 py-3 text-sm"
                  style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)', color:'#F87171' }}>
                  {errorMsg}
                </div>
              )}

              {/* Share section */}
              {paymentLink && status === 'pending' && (
                <div className="rounded-xl p-4 flex flex-col gap-3"
                  style={{ background:'rgba(153,69,255,0.07)', border:'1px solid rgba(153,69,255,0.25)' }}>
                  <p className="text-xs font-bold" style={{ color:'#C084FC' }}>🔗 Payment Link — Feature 3</p>
                  <p className="text-xs font-mono break-all" style={{ color:'var(--text-2)' }}>{paymentLink}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={copyLink}
                      className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
                      style={{ background:'rgba(153,69,255,0.15)', border:'1px solid rgba(153,69,255,0.3)', color:'#C084FC' }}>
                      {copied ? '✓ Copied!' : '🔗 Copy Link'}
                    </button>
                    <a href={`https://wa.me/?text=${whatsappMsg}`} target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
                      style={{ background:'rgba(37,211,102,0.12)', border:'1px solid rgba(37,211,102,0.25)', color:'#25D366' }}>
                      💬 WhatsApp
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Right: QR panel */}
            <div className="flex flex-col items-center justify-center rounded-2xl min-h-[320px] gap-6 p-8"
              style={{ background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
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
                  <div className="h-20 w-20 rounded-2xl flex items-center justify-center text-3xl"
                    style={{ background:'rgba(153,69,255,0.08)', border:'1px dashed rgba(153,69,255,0.3)' }}>⚡</div>
                  <p className="text-sm font-medium" style={{ color:'var(--text-2)' }}>
                    Enter an amount to generate<br />QR code + shareable link
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
