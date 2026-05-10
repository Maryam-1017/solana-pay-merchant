'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

interface Summary { total: number; completed: number; pending: number; volume: number; }

const ACTION_CARDS = [
  {
    href:    '/dashboard/payment',
    icon:    '⚡',
    label:   'New Payment',
    sub:     'Generate a SOL or USDC QR',
    gradient:'linear-gradient(135deg,rgba(153,69,255,0.18),rgba(153,69,255,0.04))',
    border:  'rgba(153,69,255,0.35)',
  },
  {
    href:    '/history',
    icon:    '📋',
    label:   'History',
    sub:     'All transactions & signatures',
    gradient:'linear-gradient(135deg,rgba(20,241,149,0.1),rgba(20,241,149,0.02))',
    border:  'rgba(20,241,149,0.25)',
  },
  {
    href:    '/onboarding',
    icon:    '🏪',
    label:   'Merchant Profile',
    sub:     'Wallet, name, category',
    gradient:'linear-gradient(135deg,rgba(0,194,255,0.1),rgba(0,194,255,0.02))',
    border:  'rgba(0,194,255,0.25)',
  },
];

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/payments`)
      .then(r => r.json())
      .then((rows: any[]) => {
        const completed = rows.filter(r => r.status === 'completed');
        const pending   = rows.filter(r => r.status === 'pending');
        const volume    = completed.reduce((s, r) => s + parseFloat(r.amount || '0'), 0);
        setSummary({ total: rows.length, completed: completed.length, pending: pending.length, volume });
      })
      .catch(() => {});
  }, []);

  const METRICS = [
    { label: 'Total Payments',  value: summary ? String(summary.total)     : '—', color: '#C084FC' },
    { label: 'Completed',       value: summary ? String(summary.completed) : '—', color: '#14F195' },
    { label: 'Pending',         value: summary ? String(summary.pending)   : '—', color: '#FCD34D' },
    { label: 'Volume (SOL+USDC)', value: summary ? summary.volume.toFixed(3) : '—', color: '#60A5FA' },
  ];

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8 anim-slide-up">
          <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm" style={{ color:'var(--text-2)' }}>
            Zero-fee payments for merchants who can't access Stripe — built on Solana
          </p>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {METRICS.map(({ label, value, color }) => (
            <div key={label} className="glass rounded-xl p-4 flex flex-col gap-1">
              <span className="text-2xl font-black" style={{ color }}>{value}</span>
              <span className="text-xs" style={{ color:'var(--text-3)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {ACTION_CARDS.map(({ href, icon, label, sub, gradient, border }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col gap-2 rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group"
              style={{ background: gradient, border:`1px solid ${border}` }}
            >
              <span className="text-3xl">{icon}</span>
              <span className="font-bold text-base">{label}</span>
              <span className="text-xs" style={{ color:'var(--text-2)' }}>{sub}</span>
            </Link>
          ))}
        </div>

        {/* Escrow info card */}
        <div
          className="rounded-2xl p-5 flex gap-4 items-start"
          style={{ background:'rgba(153,69,255,0.07)', border:'1px dashed rgba(153,69,255,0.35)' }}
        >
          <span className="text-2xl mt-0.5">🔐</span>
          <div>
            <p className="font-bold text-sm text-[#C084FC]">USDC Escrow (On-Chain)</p>
            <p className="text-xs mt-1" style={{ color:'var(--text-2)' }}>
              Funds lock in a Solana smart contract. Merchant claims within 24 hrs or
              the customer gets an automatic refund. No chargebacks — just code.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
