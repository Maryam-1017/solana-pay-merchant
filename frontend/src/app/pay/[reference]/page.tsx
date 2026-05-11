'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { SolanaPayQR } from '../../../components/SolanaPayQR';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
const FRONTEND_URL = 'https://solana-pay-merchant.vercel.app';

interface PaymentData {
  status: string;
  amount: string;
  currency: string;
  label: string | null;
  solanaUrl: string | null;
  loyaltyPoints: number;
  expiresAt: string | null;
  recipient: string;
}

export default function PaymentLinkPage() {
  const params = useParams();
  const reference = params.reference as string;

  const [payment, setPayment]   = useState<PaymentData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [copied,  setCopied]    = useState(false);
  const [error,   setError]     = useState('');

  const pageUrl = `${FRONTEND_URL}/pay/${reference}`;

  useEffect(() => {
    if (!reference) return;
    fetch(`${BACKEND_URL}/api/payments/status?reference=${encodeURIComponent(reference)}`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then(setPayment)
      .catch(() => setError('Payment link not found or expired.'))
      .finally(() => setLoading(false));
  }, [reference]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(pageUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappMsg = encodeURIComponent(
    `Pay me ${payment?.amount} ${payment?.currency}${payment?.label ? ` for "${payment.label}"` : ''} using Solana Pay:\n${pageUrl}`
  );

  const isExpired = payment?.expiresAt && new Date(payment.expiresAt) < new Date();

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base font-black"
              style={{ background: 'linear-gradient(135deg,#9945FF,#14F195)' }}>◎</span>
            <span className="font-extrabold g-text">SolPay</span>
          </Link>
          <h1 className="text-xl font-bold">Payment Request</h1>
        </div>

        {loading && (
          <div className="glass rounded-2xl p-10 text-center" style={{ color:'var(--text-3)' }}>
            <span className="animate-spin inline-block h-5 w-5 rounded-full border-2 border-purple-400 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-3xl mb-3">🔗</p>
            <p className="font-bold" style={{ color:'#F87171' }}>Link not found</p>
            <p className="text-sm mt-1" style={{ color:'var(--text-3)' }}>{error}</p>
          </div>
        )}

        {payment && !error && (
          <div className="flex flex-col gap-4">

            {/* Amount card */}
            <div className="glass rounded-2xl p-5 text-center">
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color:'var(--text-3)' }}>
                {payment.label || 'Payment'}
              </p>
              <p className="text-4xl font-extrabold g-text">
                {parseFloat(payment.amount).toFixed(payment.currency === 'USDC' ? 2 : 4)}
              </p>
              <p className="text-sm font-semibold mt-0.5" style={{ color:'var(--text-2)' }}>
                {payment.currency}
              </p>
              {payment.loyaltyPoints > 0 && (
                <p className="text-xs mt-2 px-3 py-1 rounded-full inline-block"
                  style={{ background:'rgba(20,241,149,0.1)', color:'#14F195', border:'1px solid rgba(20,241,149,0.2)' }}>
                  🎁 Earn {payment.loyaltyPoints} loyalty points
                </p>
              )}
            </div>

            {/* QR */}
            {payment.solanaUrl && !isExpired && payment.status !== 'completed' && (
              <div className="flex flex-col items-center gap-3">
                <SolanaPayQR url={payment.solanaUrl} />
                <p className="text-xs text-center" style={{ color:'var(--text-3)' }}>
                  Scan with Phantom or Solflare
                </p>
              </div>
            )}

            {payment.status === 'completed' && (
              <div className="glass rounded-2xl p-6 text-center">
                <p className="text-3xl mb-2">✅</p>
                <p className="font-bold text-[#14F195]">Already Paid!</p>
                <p className="text-xs mt-1" style={{ color:'var(--text-3)' }}>
                  This payment has been confirmed on-chain.
                </p>
              </div>
            )}

            {isExpired && payment.status !== 'completed' && (
              <div className="glass rounded-2xl p-6 text-center">
                <p className="text-3xl mb-2">⏰</p>
                <p className="font-bold" style={{ color:'#F87171' }}>Link Expired</p>
                <p className="text-xs mt-1" style={{ color:'var(--text-3)' }}>
                  This payment link expired 24 hours after creation.
                </p>
              </div>
            )}

            {/* Share row */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/?text=${whatsappMsg}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all"
                style={{ background:'rgba(37,211,102,0.12)', border:'1px solid rgba(37,211,102,0.3)', color:'#25D366' }}
              >
                <span>💬</span> WhatsApp
              </a>
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all"
                style={{ background:'rgba(153,69,255,0.12)', border:'1px solid rgba(153,69,255,0.3)', color:'#C084FC' }}
              >
                {copied ? '✓ Copied!' : '🔗 Copy Link'}
              </button>
            </div>

            {/* Expiry */}
            {payment.expiresAt && !isExpired && (
              <p className="text-center text-xs" style={{ color:'var(--text-3)' }}>
                ⏳ Expires {new Date(payment.expiresAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
