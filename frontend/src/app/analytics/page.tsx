'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

interface Payment {
  id: number;
  reference: string;
  amount: string;
  currency: string;
  status: string;
  label: string | null;
  created_at: string;
}

function startOf(period: 'day' | 'week' | 'month') {
  const d = new Date();
  if (period === 'day')   { d.setHours(0,0,0,0); }
  if (period === 'week')  { d.setDate(d.getDate() - 7); }
  if (period === 'month') { d.setDate(d.getDate() - 30); }
  return d;
}

function revenue(payments: Payment[], since: Date, currency?: string) {
  return payments
    .filter(p => p.status === 'completed' && new Date(p.created_at) >= since && (!currency || p.currency === currency))
    .reduce((s, p) => s + parseFloat(p.amount || '0'), 0);
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.07)' }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width:`${Math.min(pct,100)}%`, background: color }} />
    </div>
  );
}

export default function AnalyticsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/payments`)
      .then(r => r.json())
      .then(d => setPayments(Array.isArray(d) ? d : []))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, []);

  const completed = payments.filter(p => p.status === 'completed');
  const today     = startOf('day');
  const week      = startOf('week');
  const month     = startOf('month');

  const todayRev  = revenue(payments, today);
  const weekRev   = revenue(payments, week);
  const monthRev  = revenue(payments, month);
  const todaySol  = revenue(payments, today, 'SOL');
  const todayUsdc = revenue(payments, today, 'USDC');
  const totalSol  = revenue(payments, new Date(0), 'SOL');
  const totalUsdc = revenue(payments, new Date(0), 'USDC');
  const totalRev  = totalSol + totalUsdc;
  const avgTx     = completed.length ? (totalRev / completed.length) : 0;
  const successRate = payments.length ? Math.round((completed.length / payments.length) * 100) : 0;

  // Peak hours — count completed payments per hour
  const hourBuckets = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: completed.filter(p => new Date(p.created_at).getHours() === i).length,
  }));
  const maxHour = Math.max(...hourBuckets.map(h => h.count), 1);

  // Currency split
  const solPct  = totalRev > 0 ? (totalSol  / totalRev) * 100 : 50;
  const usdcPct = totalRev > 0 ? (totalUsdc / totalRev) * 100 : 50;

  const GRAD = 'linear-gradient(135deg,#9945FF,#14F195)';

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="text-xs hover:text-white transition-colors" style={{ color:'var(--text-3)' }}>← Dashboard</Link>
          <span style={{ color:'var(--text-3)' }}>/</span>
          <h1 className="text-2xl font-extrabold">Analytics</h1>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">NEW</span>
        </div>

        {loading ? (
          <div className="glass rounded-2xl p-10 flex justify-center" style={{ color:'var(--text-3)' }}>
            <span className="animate-spin h-5 w-5 rounded-full border-2 border-purple-400 border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">

            {/* Revenue cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label:"Today",    val: todayRev.toFixed(3),  color:'#14F195' },
                { label:"7 days",   val: weekRev.toFixed(3),   color:'#C084FC' },
                { label:"30 days",  val: monthRev.toFixed(3),  color:'#60A5FA' },
                { label:"Avg tx",   val: avgTx.toFixed(3),     color:'#FCD34D' },
              ].map(({ label, val, color }) => (
                <div key={label} className="glass rounded-xl p-4">
                  <p className="text-xl font-black" style={{ color }}>{val}</p>
                  <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>{label}</p>
                </div>
              ))}
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-white">{payments.length}</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>Total txns</p>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-[#14F195]">{completed.length}</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>Completed</p>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-[#FCD34D]">{successRate}%</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>Success rate</p>
              </div>
            </div>

            {/* Currency breakdown */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-sm font-bold mb-4" style={{ color:'var(--text-2)' }}>Currency Breakdown</h2>
              <div className="flex gap-4 items-center mb-4">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color:'#C084FC' }}>◎ SOL</span>
                    <span style={{ color:'var(--text-3)' }}>{solPct.toFixed(1)}%</span>
                  </div>
                  <Bar pct={solPct} color="#9945FF" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color:'#60A5FA' }}>💵 USDC</span>
                    <span style={{ color:'var(--text-3)' }}>{usdcPct.toFixed(1)}%</span>
                  </div>
                  <Bar pct={usdcPct} color="#3B82F6" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="rounded-xl p-3 text-center" style={{ background:'rgba(153,69,255,0.08)', border:'1px solid rgba(153,69,255,0.2)' }}>
                  <p className="font-bold text-[#C084FC]">{totalSol.toFixed(3)} SOL</p>
                  <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>Total SOL volume</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)' }}>
                  <p className="font-bold text-[#60A5FA]">{totalUsdc.toFixed(2)} USDC</p>
                  <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>Total USDC volume</p>
                </div>
              </div>
            </div>

            {/* Today breakdown */}
            {(todaySol > 0 || todayUsdc > 0) && (
              <div className="glass rounded-2xl p-6">
                <h2 className="text-sm font-bold mb-4" style={{ color:'var(--text-2)' }}>Today</h2>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">◎ SOL</span>
                    <span className="font-mono font-bold text-[#C084FC]">{todaySol.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">💵 USDC</span>
                    <span className="font-mono font-bold text-[#60A5FA]">{todayUsdc.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Peak hours */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-sm font-bold mb-4" style={{ color:'var(--text-2)' }}>Peak Payment Hours</h2>
              <div className="flex items-end gap-1 h-20">
                {hourBuckets.map(({ hour, count }) => (
                  <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm transition-all duration-700"
                      style={{
                        height: `${(count / maxHour) * 60}px`,
                        minHeight: '2px',
                        background: count > 0 ? GRAD : 'rgba(255,255,255,0.06)',
                      }}
                    />
                    {hour % 6 === 0 && (
                      <span className="text-[9px]" style={{ color:'var(--text-3)' }}>{hour}h</span>
                    )}
                  </div>
                ))}
              </div>
              {completed.length === 0 && (
                <p className="text-center text-xs mt-3" style={{ color:'var(--text-3)' }}>
                  No completed payments yet — chart fills as payments come in
                </p>
              )}
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
