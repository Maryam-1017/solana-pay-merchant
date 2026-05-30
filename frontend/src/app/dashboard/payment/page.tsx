'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { WalletConnect } from '../../../components/WalletConnect';
import { SolanaPayQR } from '../../../components/SolanaPayQR';

const BACKEND_URL   = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
const FRONTEND_BASE = 'https://solana-pay-merchant.vercel.app';
const DEMO_RATE     = 278; // 1 USD = 278 PKR (fixed demo rate)

type Currency      = 'SOL' | 'USDC';
type CryptoStatus  = 'idle' | 'pending' | 'paid' | 'error';
type PayMethod     = 'crypto' | 'jazzcash';
type JazzStage     = 'form' | 'mpin' | 'processing' | 'done';

interface BridgeResult {
  pkrAmount: number;
  usdcAmount: number;
  rate: number;
  txSignature: string;
  merchantName: string;
  loyaltyPoints: number;
  note: string;
}

export default function PaymentPage() {
  // ── Crypto state ────────────────────────────────────────────────────────────
  const [amount,        setAmount]       = useState('');
  const [label,         setLabel]        = useState('');
  const [currency,      setCurrency]     = useState<Currency>('SOL');
  const [payUrl,        setPayUrl]       = useState('');
  const [paymentLink,   setPaymentLink]  = useState('');
  const [reference,     setRef]          = useState('');
  const [loyaltyPoints, setLoyalty]      = useState(0);
  const [status,        setStatus]       = useState<CryptoStatus>('idle');
  const [errorMsg,      setError]        = useState('');
  const [copied,        setCopied]       = useState(false);
  const [online,        setOnline]       = useState(true);

  // ── JazzCash/Easypaisa state ────────────────────────────────────────────────
  const [payMethod,     setPayMethod]    = useState<PayMethod>('crypto');
  const [pkrAmount,     setPkrAmount]    = useState('');
  const [jazzLabel,     setJazzLabel]    = useState('');
  const [jazzPhone,     setJazzPhone]    = useState('');
  const [jazzMpin,      setJazzMpin]     = useState('');
  const [jazzStage,     setJazzStage]    = useState<JazzStage>('form');
  const [jazzResult,    setJazzResult]   = useState<BridgeResult | null>(null);
  const [jazzError,     setJazzError]    = useState('');

  const usdcPreview = pkrAmount && parseFloat(pkrAmount) > 0
    ? (parseFloat(pkrAmount) / DEMO_RATE).toFixed(2)
    : '0.00';

  useEffect(() => {
    setOnline(navigator.onLine);
    const up   = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const resetCrypto = () => {
    setAmount(''); setLabel(''); setPayUrl(''); setRef(''); setPaymentLink('');
    setStatus('idle'); setError(''); setLoyalty(0);
  };

  const resetJazz = () => {
    setPkrAmount(''); setJazzLabel(''); setJazzPhone('');
    setJazzMpin(''); setJazzStage('form'); setJazzResult(null); setJazzError('');
  };

  // ── Crypto: generate QR ──────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;
    const offlineKey = `solpay_pending_${Date.now()}`;
    setStatus('idle'); setError(''); setPayUrl(''); setRef(''); setPaymentLink('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parsed,
          label: label || undefined,
          currency,
          // Send the registered wallet so QR recipient is always this merchant
          merchantWallet: ((): string | undefined => {
            try { return localStorage.getItem('solpay_merchant_wallet') ?? undefined; } catch { return undefined; }
          })(),
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error || 'Failed to create payment'); setStatus('error'); return;
      }
      const data = await res.json();
      setRef(data.reference); setPayUrl(data.url); setLoyalty(data.loyaltyPoints || 0);
      const link = data.paymentLink || `${FRONTEND_BASE}/pay/${data.reference}`;
      setPaymentLink(link);
      try { localStorage.setItem(offlineKey, JSON.stringify({ reference: data.reference, url: data.url, link, amount: parsed, currency, label, createdAt: Date.now() })); } catch { /**/ }
      setStatus('pending');
    } catch {
      if (!online) {
        setError('Offline — showing last cached QR.');
        try {
          const keys = Object.keys(localStorage).filter(k => k.startsWith('solpay_pending_')).sort().reverse();
          if (keys.length > 0) {
            const c = JSON.parse(localStorage.getItem(keys[0]) || '{}');
            if (c.url) { setPayUrl(c.url); setPaymentLink(c.link || ''); setStatus('pending'); return; }
          }
        } catch { /**/ }
      }
      setError('Cannot reach backend — is it running?'); setStatus('error');
    }
  };

  // ── Crypto: polling ──────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!reference || status === 'paid') return;
    const HELIUS = 'https://devnet.helius-rpc.com/?api-key=b5227e64-c909-4260-9e03-ecb80c2caccd';
    const iv = setInterval(async () => {
      try {
        const res = await fetch(HELIUS, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [reference, { limit: 1, commitment: 'confirmed' }] }),
        });
        const data = await res.json();
        const sigs = data.result || [];
        if (sigs.length > 0 && !sigs[0].err) setStatus('paid');
      } catch { /**/ }
    }, 2000);
    return () => clearInterval(iv);
  }, [reference, status]);

  // ── JazzCash: confirm bridge ─────────────────────────────────────────────────
  const handleJazzConfirm = async () => {
    if (!pkrAmount || parseFloat(pkrAmount) <= 0) return;
    setJazzStage('processing'); setJazzError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/bridge/jazzcash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pkrAmount: parseFloat(pkrAmount), label: jazzLabel || 'JazzCash Bridge' }),
      });
      const data = await res.json();
      if (!res.ok) { setJazzError(data.error || 'Bridge failed'); setJazzStage('mpin'); return; }
      setJazzResult(data);
      setJazzStage('done');
    } catch {
      setJazzError('Cannot reach backend.'); setJazzStage('mpin');
    }
  };

  const copyLink = useCallback(async () => {
    if (!paymentLink) return;
    await navigator.clipboard.writeText(paymentLink).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [paymentLink]);

  const whatsappMsg = encodeURIComponent(`Pay me ${amount} ${currency}${label ? ` for "${label}"` : ''} using Solana Pay:\n${paymentLink}`);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-4xl mx-auto">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color:'var(--text-3)' }}>
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <span>/</span>
          <span style={{ color:'var(--text-1)' }}>New Payment</span>
          {!online && <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background:'rgba(251,146,60,0.15)', color:'#FB923C', border:'1px solid rgba(251,146,60,0.3)' }}>⚡ Offline</span>}
        </div>

        {/* ── Payment method toggle ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2 mb-8">
          <button
            onClick={() => setPayMethod('crypto')}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all"
            style={{
              background: payMethod === 'crypto' ? 'linear-gradient(135deg,rgba(153,69,255,0.22),rgba(20,241,149,0.1))' : 'rgba(255,255,255,0.03)',
              border: payMethod === 'crypto' ? '1px solid rgba(153,69,255,0.55)' : '1px solid var(--border)',
              color: payMethod === 'crypto' ? '#fff' : 'var(--text-2)',
            }}>
            ◎ Pay with Crypto
          </button>
          <button
            onClick={() => setPayMethod('jazzcash')}
            className="relative flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all"
            style={{
              background: payMethod === 'jazzcash' ? 'linear-gradient(135deg,rgba(212,0,70,0.22),rgba(255,120,0,0.1))' : 'rgba(255,255,255,0.03)',
              border: payMethod === 'jazzcash' ? '1px solid rgba(212,0,70,0.55)' : '1px solid var(--border)',
              color: payMethod === 'jazzcash' ? '#fff' : 'var(--text-2)',
            }}>
            📱 JazzCash / Easypaisa
            <span className="absolute -top-2 -right-1 text-[9px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background:'linear-gradient(135deg,#D40046,#FF7800)', color:'#fff' }}>
              BRIDGE
            </span>
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CRYPTO FLOW
        ══════════════════════════════════════════════════════════════════ */}
        {payMethod === 'crypto' && (
          <>
            {status === 'paid' ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center anim-slide-up">
                <div className="h-20 w-20 rounded-full flex items-center justify-center text-4xl"
                  style={{ background:'rgba(20,241,149,0.15)', border:'2px solid rgba(20,241,149,0.4)' }}>✓</div>
                <div>
                  <h2 className="text-2xl font-extrabold text-[#14F195]">Payment Received!</h2>
                  <p className="mt-1 text-sm" style={{ color:'var(--text-2)' }}>{amount} {currency} confirmed on Solana.</p>
                  {loyaltyPoints > 0 && (
                    <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
                      style={{ background:'rgba(20,241,149,0.12)', border:'1px solid rgba(20,241,149,0.3)', color:'#14F195' }}>
                      🎁 Customer earned {loyaltyPoints} loyalty points!
                    </div>
                  )}
                </div>
                <button onClick={resetCrypto} className="btn-sol px-7 py-3 text-sm rounded-xl">New Payment</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left: form */}
                <div className="flex flex-col gap-5">
                  <WalletConnect />
                  <div>
                    <label className="block mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>Currency</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['SOL','USDC'] as Currency[]).map(c => (
                        <button key={c} type="button" onClick={() => setCurrency(c)}
                          className="relative flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all"
                          style={{
                            background: currency === c ? 'linear-gradient(135deg,rgba(153,69,255,0.22),rgba(20,241,149,0.1))' : 'rgba(255,255,255,0.03)',
                            border: currency === c ? '1px solid rgba(153,69,255,0.55)' : '1px solid var(--border)',
                            color: currency === c ? '#fff' : 'var(--text-2)',
                          }}>
                          <span>{c === 'SOL' ? '◎' : '💵'}</span>{c}
                          {c === 'USDC' && <span className="absolute -top-1.5 -right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background:'#14F195', color:'#080812' }}>STABLE</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>Amount ({currency})</label>
                    <div className="relative">
                      <input type="number" className="sol-input pr-14" value={amount} onChange={e => setAmount(e.target.value)} min="0" step={currency === 'USDC' ? '0.01' : '0.001'} placeholder={currency === 'USDC' ? '1.50' : '0.01'} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color:'var(--text-3)' }}>{currency}</span>
                    </div>
                    {amount && parseFloat(amount) > 0 && <p className="text-xs mt-1" style={{ color:'var(--text-3)' }}>🎁 Customer earns {currency === 'USDC' ? Math.floor(parseFloat(amount)) : Math.floor(parseFloat(amount) * 10)} loyalty points</p>}
                  </div>
                  <div>
                    <label className="block mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>Label <span className="font-normal">(optional)</span></label>
                    <input type="text" className="sol-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Coffee, Table #4" maxLength={80} />
                  </div>
                  <button className="btn-sol w-full py-3.5 text-sm rounded-xl mt-1" onClick={handleGenerate} disabled={!amount || parseFloat(amount) <= 0}>
                    Generate {currency} QR + Payment Link ↗
                  </button>
                  {status === 'error' && <div className="rounded-xl px-4 py-3 text-sm" style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)', color:'#F87171' }}>{errorMsg}</div>}
                  {paymentLink && status === 'pending' && (
                    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background:'rgba(153,69,255,0.07)', border:'1px solid rgba(153,69,255,0.25)' }}>
                      <p className="text-xs font-bold" style={{ color:'#C084FC' }}>🔗 Payment Link</p>
                      <p className="text-xs font-mono break-all" style={{ color:'var(--text-2)' }}>{paymentLink}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={copyLink} className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold" style={{ background:'rgba(153,69,255,0.15)', border:'1px solid rgba(153,69,255,0.3)', color:'#C084FC' }}>
                          {copied ? '✓ Copied!' : '🔗 Copy Link'}
                        </button>
                        <a href={`https://wa.me/?text=${whatsappMsg}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold" style={{ background:'rgba(37,211,102,0.12)', border:'1px solid rgba(37,211,102,0.25)', color:'#25D366' }}>
                          💬 WhatsApp
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: QR panel */}
                <div className="flex flex-col items-center justify-center rounded-2xl min-h-[320px] gap-6 p-8" style={{ background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
                  {payUrl ? (
                    <>
                      <SolanaPayQR url={payUrl} />
                      {status === 'pending' && <div className="flex items-center gap-2 text-sm font-semibold" style={{ color:'#FCD34D' }}><span className="h-2 w-2 rounded-full bg-yellow-400 anim-pulse" />Waiting for payment…</div>}
                      <span className={`pill-${currency.toLowerCase()}`}>{currency === 'SOL' ? '◎' : '💵'} {amount} {currency}</span>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="h-20 w-20 rounded-2xl flex items-center justify-center text-3xl" style={{ background:'rgba(153,69,255,0.08)', border:'1px dashed rgba(153,69,255,0.3)' }}>⚡</div>
                      <p className="text-sm font-medium" style={{ color:'var(--text-2)' }}>Enter an amount to generate<br />QR code + shareable link</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            JAZZCASH / EASYPAISA BRIDGE FLOW
        ══════════════════════════════════════════════════════════════════ */}
        {payMethod === 'jazzcash' && (
          <div className="max-w-md mx-auto">

            {/* Demo banner */}
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6 text-sm font-semibold"
              style={{ background:'rgba(251,146,60,0.12)', border:'1px solid rgba(251,146,60,0.35)', color:'#FB923C' }}>
              <span>⚠️</span>
              <div>
                <p className="font-bold">DEMO MODE — Sandbox</p>
                <p className="text-xs font-normal mt-0.5" style={{ color:'rgba(251,146,60,0.75)' }}>
                  Production version integrates JazzCash Merchant API (pending business approval)
                </p>
              </div>
            </div>

            {/* ── Stage: form ─────────────────────────────────────── */}
            {jazzStage === 'form' && (
              <div className="glass rounded-2xl p-6 flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl font-black" style={{ background:'linear-gradient(135deg,#D40046,#FF7800)' }}>J</div>
                  <div>
                    <p className="font-bold text-sm">JazzCash / Easypaisa Bridge</p>
                    <p className="text-xs" style={{ color:'var(--text-3)' }}>PKR → USDC → Solana settlement</p>
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>Amount in PKR (Rs.)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm" style={{ color:'var(--text-3)' }}>Rs.</span>
                    <input type="number" className="sol-input pl-10" value={pkrAmount}
                      onChange={e => setPkrAmount(e.target.value)}
                      placeholder="2780" min="1" step="1" />
                  </div>
                  {pkrAmount && parseFloat(pkrAmount) > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span style={{ color:'var(--text-3)' }}>Rs. {parseFloat(pkrAmount).toLocaleString()}</span>
                      <span style={{ color:'var(--text-3)' }}>→</span>
                      <span className="font-black text-[#14F195]">{usdcPreview} USDC</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:'rgba(20,241,149,0.1)', color:'#14F195', border:'1px solid rgba(20,241,149,0.2)' }}>
                        1 USD = Rs. {DEMO_RATE}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>Label (optional)</label>
                  <input type="text" className="sol-input" value={jazzLabel} onChange={e => setJazzLabel(e.target.value)} placeholder="e.g. Grocery, Rent, Invoice" maxLength={80} />
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color:'var(--text-3)' }}>Customer Phone (demo)</label>
                  <input type="text" className="sol-input" value={jazzPhone}
                    onChange={e => setJazzPhone(e.target.value)}
                    placeholder="+92 3XX-XXXXXXX" maxLength={20} />
                </div>

                <button
                  className="btn-sol w-full py-3.5 text-sm rounded-xl"
                  onClick={() => setJazzStage('mpin')}
                  disabled={!pkrAmount || parseFloat(pkrAmount) <= 0}
                  style={{ background:'linear-gradient(135deg,#D40046,#FF7800)' }}>
                  Proceed to Confirm →
                </button>
              </div>
            )}

            {/* ── Stage: MPIN (simulated JazzCash screen) ─────────── */}
            {jazzStage === 'mpin' && (
              <div className="glass rounded-2xl overflow-hidden">
                {/* JazzCash branded header */}
                <div className="px-6 py-4 flex items-center gap-3" style={{ background:'linear-gradient(135deg,#D40046,#FF7800)' }}>
                  <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center text-lg font-black text-white">J</div>
                  <div>
                    <p className="font-extrabold text-white text-base">JazzCash</p>
                    <p className="text-xs text-white/70">Mobile Payment</p>
                  </div>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">SANDBOX</span>
                </div>

                <div className="p-6 flex flex-col gap-5">
                  {/* Summary */}
                  <div className="rounded-xl p-4 text-center" style={{ background:'rgba(212,0,70,0.06)', border:'1px solid rgba(212,0,70,0.2)' }}>
                    <p className="text-xs mb-1" style={{ color:'var(--text-3)' }}>You are paying</p>
                    <p className="text-3xl font-extrabold" style={{ color:'#D40046' }}>Rs. {parseFloat(pkrAmount).toLocaleString()}</p>
                    <p className="text-sm mt-1" style={{ color:'var(--text-2)' }}>= <span className="font-bold text-[#14F195]">{usdcPreview} USDC</span> on Solana</p>
                    {jazzLabel && <p className="text-xs mt-1" style={{ color:'var(--text-3)' }}>For: {jazzLabel}</p>}
                  </div>

                  {/* Phone display */}
                  <div className="flex justify-between text-sm">
                    <span style={{ color:'var(--text-3)' }}>Account</span>
                    <span className="font-mono font-semibold">{jazzPhone || '+92 3XX-XXXXXXX'}</span>
                  </div>

                  {/* MPIN dots */}
                  <div>
                    <label className="block mb-2 text-xs font-semibold uppercase tracking-widest text-center" style={{ color:'var(--text-3)' }}>Enter MPIN</label>
                    <div className="flex justify-center gap-3">
                      {[0,1,2,3,4,5].map(i => (
                        <div key={i} className="h-10 w-10 rounded-full border-2 flex items-center justify-center"
                          style={{ borderColor: i < jazzMpin.length ? '#D40046' : 'var(--border)', background: i < jazzMpin.length ? 'rgba(212,0,70,0.12)' : 'transparent' }}>
                          {i < jazzMpin.length && <div className="h-3 w-3 rounded-full" style={{ background:'#D40046' }} />}
                        </div>
                      ))}
                    </div>
                    {/* Hidden real input */}
                    <input
                      type="password"
                      maxLength={6}
                      className="sr-only"
                      value={jazzMpin}
                      onChange={e => setJazzMpin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      autoFocus
                      id="mpin-input"
                    />
                    <label htmlFor="mpin-input" className="block text-center mt-2 text-xs cursor-pointer" style={{ color:'rgba(212,0,70,0.7)' }}>
                      Tap to enter MPIN (demo: any 6 digits)
                    </label>
                  </div>

                  {jazzError && <p className="text-xs text-center" style={{ color:'#F87171' }}>{jazzError}</p>}

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setJazzStage('form')} className="btn-ghost py-3 text-sm rounded-xl">← Back</button>
                    <button
                      onClick={handleJazzConfirm}
                      disabled={jazzMpin.length < 4}
                      className="py-3 text-sm rounded-xl font-bold text-white disabled:opacity-40 transition-all"
                      style={{ background: jazzMpin.length >= 4 ? 'linear-gradient(135deg,#D40046,#FF7800)' : 'rgba(255,255,255,0.1)' }}>
                      Confirm Payment
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Stage: processing ────────────────────────────────── */}
            {jazzStage === 'processing' && (
              <div className="glass rounded-2xl p-10 flex flex-col items-center gap-5 text-center">
                <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background:'rgba(212,0,70,0.12)', border:'2px solid rgba(212,0,70,0.35)' }}>
                  <span className="animate-spin h-7 w-7 rounded-full border-[3px] border-[#D40046] border-t-transparent inline-block" />
                </div>
                <div>
                  <p className="font-bold text-sm">Simulating JazzCash payment…</p>
                  <p className="text-xs mt-1" style={{ color:'var(--text-3)' }}>Converting PKR → USDC → Solana devnet</p>
                </div>
                <div className="flex flex-col gap-1.5 w-full text-xs" style={{ color:'var(--text-3)' }}>
                  {['✓ JazzCash transaction verified', '✓ PKR amount confirmed', '⟳ Minting USDC on Solana devnet…'].map((s, i) => (
                    <p key={i} className="text-left px-3 py-1.5 rounded-lg" style={{ background:'rgba(255,255,255,0.03)' }}>{s}</p>
                  ))}
                </div>
              </div>
            )}

            {/* ── Stage: done (success) ────────────────────────────── */}
            {jazzStage === 'done' && jazzResult && (
              <div className="glass rounded-2xl p-8 flex flex-col items-center gap-5 text-center anim-slide-up">
                <div className="h-20 w-20 rounded-full flex items-center justify-center text-4xl"
                  style={{ background:'rgba(20,241,149,0.15)', border:'2px solid rgba(20,241,149,0.4)' }}>✓</div>

                <div>
                  <h2 className="text-2xl font-extrabold text-[#14F195]">Bridge Complete!</h2>
                  <p className="mt-2 text-base font-bold">
                    Converted <span style={{ color:'#D40046' }}>Rs. {jazzResult.pkrAmount.toLocaleString()}</span>
                    {' → '}
                    <span className="text-[#14F195]">{jazzResult.usdcAmount} USDC</span>
                  </p>
                  <p className="text-xs mt-1" style={{ color:'var(--text-3)' }}>Settled on Solana devnet</p>
                </div>

                {/* Receipt */}
                <div className="w-full rounded-xl p-4 text-left flex flex-col gap-2.5"
                  style={{ background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)' }}>
                  {[
                    ['Rate',      `1 USD = Rs. ${jazzResult.rate}`],
                    ['USDC sent', `${jazzResult.usdcAmount} USDC`],
                    ['Merchant',  jazzResult.merchantName],
                    ['Loyalty',   `+${jazzResult.loyaltyPoints} pts earned`],
                    ['Tx Sig',    jazzResult.txSignature.slice(0, 16) + '…'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span style={{ color:'var(--text-3)' }}>{k}</span>
                      <span className="font-mono font-semibold">{v}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-center" style={{ color:'var(--text-3)' }}>
                  ⚠️ {jazzResult.note}
                </p>

                <button onClick={resetJazz} className="btn-sol px-7 py-3 text-sm rounded-xl w-full">
                  New Bridge Payment
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
