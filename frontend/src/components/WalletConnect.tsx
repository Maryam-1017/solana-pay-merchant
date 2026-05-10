'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

function getPhantom(): any | null {
  if (typeof window === 'undefined') return null;
  const p = (window as any).phantom?.solana ?? (window as any).solana ?? null;
  return p?.isPhantom ? p : null;
}

export function WalletConnect() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const providerRef = useRef<any>(null);

  useEffect(() => {
    const provider = getPhantom();
    if (!provider) return;
    providerRef.current = provider;

    const onConnect    = (pk: any) => {
      const key = pk?.toString?.() ?? provider.publicKey?.toString?.() ?? null;
      setPublicKey(key); setConnected(!!key); setError('');
    };
    const onDisconnect = () => { setPublicKey(null); setConnected(false); };

    provider.on?.('connect', onConnect);
    provider.on?.('disconnect', onDisconnect);

    if (provider.isConnected && provider.publicKey) {
      setPublicKey(provider.publicKey.toString());
      setConnected(true);
    }
    return () => {
      provider.removeListener?.('connect', onConnect);
      provider.removeListener?.('disconnect', onDisconnect);
    };
  }, []);

  const handleConnect = useCallback(async () => {
    const provider = providerRef.current ?? getPhantom();
    if (!provider) {
      setError('Phantom not found — install it from phantom.app');
      return;
    }
    if (provider.isConnected && provider.publicKey) {
      setPublicKey(provider.publicKey.toString());
      setConnected(true);
      setError('');
      return;
    }
    try {
      setLoading(true); setError('');
      const resp = await provider.connect({ onlyIfTrusted: false });
      const key  = resp?.publicKey?.toString?.() ?? provider.publicKey?.toString?.() ?? null;
      setPublicKey(key); setConnected(!!key);
    } catch (err: any) {
      setError(
        err?.code === 4001
          ? 'Connection cancelled.'
          : 'Phantom is locked — unlock it then try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    try { await providerRef.current?.disconnect?.(); } catch { /**/ }
    setPublicKey(null); setConnected(false); setError('');
  }, []);

  const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-3 mb-5">
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm anim-pulse"
          style={{ background:'rgba(20,241,149,0.08)', border:'1px solid rgba(20,241,149,0.25)' }}
        >
          <span className="h-2 w-2 rounded-full bg-[#14F195] flex-shrink-0" />
          <span className="font-mono text-[#14F195] text-xs">{short(publicKey)}</span>
        </div>
        <button
          onClick={handleDisconnect}
          type="button"
          className="rounded-xl px-3 py-2 text-xs font-medium transition-all"
          style={{ background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', color:'var(--text-2)' }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <button
        onClick={handleConnect}
        disabled={loading}
        type="button"
        className="btn-sol flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Connecting…
          </>
        ) : (
          <>
            <span>👻</span> Connect Phantom
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs" style={{ color:'#F87171' }}>{error}</p>
      )}
    </div>
  );
}
