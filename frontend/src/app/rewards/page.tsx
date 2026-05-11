'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

interface Payment {
  id: number;
  amount: string;
  currency: string;
  status: string;
  loyalty_points: number;
  label: string | null;
  created_at: string;
}

export default function RewardsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [rate,     setRate]     = useState(1); // points per USDC

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/payments`)
      .then(r => r.json())
      .then(d => setPayments(Array.isArray(d) ? d : []))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, []);

  const completed = payments.filter(p => p.status === 'completed');
  const totalPoints = completed.reduce((s, p) => s + (Number(p.loyalty_points) || 0), 0);
  const usdcPayments = completed.filter(p => p.currency === 'USDC');
  const solPayments  = completed.filter(p => p.currency === 'SOL');
  const usdcVol = usdcPayments.reduce((s, p) => s + parseFloat(p.amount || '0'), 0);
  const solVol  = solPayments.reduce((s, p)  => s + parseFloat(p.amount || '0'), 0);

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="text-xs hover:text-white transition-colors" style={{ color:'var(--text-3)' }}>← Dashboard</Link>
          <span style={{ color:'var(--text-3)' }}>/</span>
          <h1 className="text-2xl font-extrabold">Loyalty Rewards</h1>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">NEW</span>
        </div>

        {/* Points hero */}
        <div
          className="rounded-2xl p-8 text-center mb-6"
          style={{ background:'linear-gradient(135deg,rgba(153,69,255,0.15),rgba(20,241,149,0.08))', border:'1px solid rgba(153,69,255,0.3)' }}
        >
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color:'var(--text-3)' }}>Total Loyalty Points Earned</p>
          <p className="text-6xl font-extrabold g-text">{totalPoints.toLocaleString()}</p>
          <p className="text-sm mt-2" style={{ color:'var(--text-2)' }}>🎁 Points from {completed.length} completed payments</p>
        </div>

        {/* Earning rates */}
        <div className="glass rounded-2xl p-6 mb-4">
          <h2 className="text-sm font-bold mb-4" style={{ color:'var(--text-2)' }}>Earning Rates</h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)' }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">💵</span>
                <div>
                  <p className="text-sm font-semibold">USDC Payments</p>
                  <p className="text-xs" style={{ color:'var(--text-3)' }}>1 USDC spent = 1 loyalty point</p>
                </div>
              </div>
              <span className="font-black text-[#60A5FA]">{rate}x</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background:'rgba(153,69,255,0.08)', border:'1px solid rgba(153,69,255,0.2)' }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">◎</span>
                <div>
                  <p className="text-sm font-semibold">SOL Payments</p>
                  <p className="text-xs" style={{ color:'var(--text-3)' }}>1 SOL spent = 10 loyalty points</p>
                </div>
              </div>
              <span className="font-black text-[#C084FC]">10x</span>
            </div>
          </div>
        </div>

        {/* Volume breakdown */}
        <div className="glass rounded-2xl p-6 mb-4">
          <h2 className="text-sm font-bold mb-4" style={{ color:'var(--text-2)' }}>Your Payment History</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-4 text-center" style={{ background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.15)' }}>
              <p className="text-xl font-black text-[#60A5FA]">{usdcVol.toFixed(2)}</p>
              <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>USDC spent</p>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background:'rgba(153,69,255,0.07)', border:'1px solid rgba(153,69,255,0.15)' }}>
              <p className="text-xl font-black text-[#C084FC]">{solVol.toFixed(4)}</p>
              <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>SOL spent</p>
            </div>
          </div>
        </div>

        {/* On-chain coming soon */}
        <div
          className="rounded-2xl p-5 flex gap-4 items-start mb-4"
          style={{ background:'rgba(20,241,149,0.05)', border:'1px dashed rgba(20,241,149,0.3)' }}
        >
          <span className="text-2xl mt-0.5">🔬</span>
          <div>
            <p className="font-bold text-sm text-[#14F195]">On-Chain SPL Token Minting — Coming Next</p>
            <p className="text-xs mt-1" style={{ color:'var(--text-2)' }}>
              Points will be minted as real SPL tokens to customer wallets after every purchase.
              The Anchor escrow program is deployed on devnet and ready for integration.
            </p>
          </div>
        </div>

        {/* Custom rate */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-sm font-bold mb-3" style={{ color:'var(--text-2)' }}>Merchant Reward Rate</h2>
          <p className="text-xs mb-4" style={{ color:'var(--text-3)' }}>
            Adjust how many loyalty points customers earn per USDC spent.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={rate}
              onChange={e => setRate(parseFloat(e.target.value))}
              className="flex-1 accent-purple-500"
            />
            <span className="font-black text-[#C084FC] w-12 text-right">{rate}x</span>
          </div>
          <p className="text-xs mt-3 text-center" style={{ color:'var(--text-3)' }}>
            At {rate}x: spending 10 USDC earns {(10 * rate).toFixed(1)} loyalty points
          </p>
        </div>

        {/* Recent earning events */}
        {!loading && completed.length > 0 && (
          <div className="glass rounded-2xl overflow-hidden mt-4">
            <div className="px-5 py-3 border-b" style={{ borderColor:'var(--border)' }}>
              <p className="text-sm font-bold" style={{ color:'var(--text-2)' }}>Recent Earning Events</p>
            </div>
            {completed.slice(0, 10).map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3 border-b last:border-0" style={{ borderColor:'var(--border)' }}>
                <div>
                  <p className="text-sm">{p.label || 'Payment'}</p>
                  <p className="text-xs" style={{ color:'var(--text-3)' }}>
                    {parseFloat(p.amount).toFixed(4)} {p.currency} · {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="font-bold text-[#14F195] text-sm">
                  +{Number(p.loyalty_points) || 0} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
