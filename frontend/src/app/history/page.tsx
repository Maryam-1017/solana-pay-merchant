'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

interface Payment {
  id: number;
  reference: string;
  recipient: string;
  amount: string;
  label: string | null;
  currency: string;
  status: string;
  signature: string | null;
  created_at: string;
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function HistoryPage() {
  const [payments,  setPayments]  = useState<Payment[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [filter,    setFilter]    = useState<'all'|'completed'|'pending'>('all');
  const [deleting,  setDeleting]  = useState<string | null>(null); // reference being deleted
  const [confirmId, setConfirmId] = useState<string | null>(null); // reference awaiting confirm

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/payments`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setPayments)
      .catch(() => setError('Could not load transactions — is the backend running?'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (reference: string) => {
    setDeleting(reference);
    setConfirmId(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/payments/${encodeURIComponent(reference)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPayments(prev => prev.filter(p => p.reference !== reference));
      }
    } catch {
      // silently ignore — user can retry
    } finally {
      setDeleting(null);
    }
  };

  const visible  = filter === 'all' ? payments : payments.filter(p => p.status === filter);
  const totalVol = payments.filter(p => p.status === 'completed')
    .reduce((s, p) => s + parseFloat(p.amount || '0'), 0);

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="text-xs transition-colors hover:text-white" style={{ color:'var(--text-3)' }}>
            ← Dashboard
          </Link>
          <span style={{ color:'var(--text-3)' }}>/</span>
          <h1 className="text-2xl font-extrabold">Transaction History</h1>
        </div>

        {/* Summary cards */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
            {[
              { label:'Total',     val: payments.length,                                              color:'#C084FC' },
              { label:'Completed', val: payments.filter(p => p.status === 'completed').length,        color:'#14F195' },
              { label:'Pending',   val: payments.filter(p => p.status === 'pending').length,          color:'#FCD34D' },
              { label:'Volume',    val: totalVol.toFixed(3),                                          color:'#60A5FA' },
            ].map(({ label, val, color }) => (
              <div key={label} className="glass rounded-xl p-4">
                <p className="text-xl font-black" style={{ color }}>{val}</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mb-5">
          {(['all','completed','pending'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{
                background: filter === f ? 'rgba(153,69,255,0.18)' : 'transparent',
                border:     filter === f ? '1px solid rgba(153,69,255,0.4)' : '1px solid transparent',
                color:      filter === f ? '#C084FC' : 'var(--text-3)',
              }}
            >
              {f}
            </button>
          ))}
          {/* Pending count badge */}
          {payments.filter(p => p.status === 'pending').length > 0 && (
            <span
              className="ml-auto text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background:'rgba(252,211,77,0.12)', color:'#FCD34D', border:'1px solid rgba(252,211,77,0.25)' }}
            >
              {payments.filter(p => p.status === 'pending').length} pending
            </span>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="glass rounded-2xl p-10 flex items-center justify-center gap-3" style={{ color:'var(--text-3)' }}>
            <span className="h-4 w-4 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
            Loading transactions…
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl px-5 py-4 text-sm" style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', color:'#F87171' }}>
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && visible.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center" style={{ color:'var(--text-3)' }}>
            No transactions yet.{' '}
            <Link href="/dashboard/payment" className="text-[#9945FF] hover:underline">
              Create your first payment →
            </Link>
          </div>
        )}

        {/* Table */}
        {!loading && visible.length > 0 && (
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background:'rgba(255,255,255,0.03)', borderBottom:'1px solid var(--border)' }}>
                  {['Time','Label','Amount','Currency','Status','Signature',''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold" style={{ color:'var(--text-3)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((p, i) => (
                  <tr
                    key={p.id}
                    className="transition-colors"
                    style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-4 py-3 text-xs" style={{ color:'var(--text-3)' }}>
                      {timeAgo(p.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color:'var(--text-2)' }}>
                      {p.label || <span style={{ color:'var(--text-3)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-xs">
                      {parseFloat(p.amount).toFixed(4)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`pill-${(p.currency || 'SOL').toLowerCase()}`}>
                        {p.currency || 'SOL'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={p.status === 'completed' ? 'pill-complete' : 'pill-pending'}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color:'var(--text-3)' }}>
                      {p.signature ? (
                        <a
                          href={`https://solscan.io/tx/${p.signature}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#9945FF] hover:text-[#14F195] transition-colors"
                        >
                          {p.signature.slice(0, 8)}…
                        </a>
                      ) : '—'}
                    </td>

                    {/* Delete column — only for pending */}
                    <td className="px-3 py-3 text-right">
                      {p.status === 'pending' && (
                        confirmId === p.reference ? (
                          /* Confirm row */
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="text-xs" style={{ color:'var(--text-3)' }}>Delete?</span>
                            <button
                              onClick={() => handleDelete(p.reference)}
                              disabled={deleting === p.reference}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
                              style={{ background:'rgba(248,113,113,0.2)', color:'#F87171', border:'1px solid rgba(248,113,113,0.35)' }}
                            >
                              {deleting === p.reference ? '…' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
                              style={{ background:'rgba(255,255,255,0.05)', color:'var(--text-3)', border:'1px solid var(--border)' }}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          /* Trash icon */
                          <button
                            onClick={() => setConfirmId(p.reference)}
                            title="Remove pending payment"
                            className="h-7 w-7 flex items-center justify-center rounded-lg transition-all opacity-40 hover:opacity-100"
                            style={{ background:'transparent', border:'1px solid transparent' }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.1)';
                              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(248,113,113,0.3)';
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                              (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                            }}
                          >
                            🗑
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Hint for pending cleanup */}
        {!loading && payments.filter(p => p.status === 'pending').length > 0 && (
          <p className="mt-3 text-xs text-center" style={{ color:'var(--text-3)' }}>
            🗑 Pending payments can be removed — only completed payments are permanent
          </p>
        )}
      </div>
    </main>
  );
}
