'use client';

import QRCode from 'react-qr-code';

interface SolanaPayQRProps {
  url: string;
}

export function SolanaPayQR({ url }: SolanaPayQRProps) {
  if (!url) {
    return (
      <div className="glass rounded-2xl p-8 flex items-center justify-center w-72 h-72">
        <p style={{ color: 'var(--text-3)' }} className="text-sm">No payment URL</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Outer glow ring */}
      <div
        className="relative p-[2px] rounded-2xl anim-border"
        style={{
          background: 'linear-gradient(135deg,#9945FF,#14F195)',
          boxShadow: '0 0 40px rgba(153,69,255,0.35), 0 0 80px rgba(20,241,149,0.12)',
        }}
      >
        {/* QR card */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ background: '#fff', padding: '20px' }}
        >
          <QRCode
            value={url}
            size={200}
            bgColor="#ffffff"
            fgColor="#080812"
            level="M"
          />

          {/* Scan-line animation overlay */}
          <div
            className="absolute inset-x-0 h-[2px] opacity-60 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg,transparent,#9945FF,#14F195,transparent)',
              animation: 'scan-line 2.4s linear infinite',
            }}
          />

          {/* Corner brackets */}
          {[
            'top-2 left-2 border-t-2 border-l-2 rounded-tl-md',
            'top-2 right-2 border-t-2 border-r-2 rounded-tr-md',
            'bottom-2 left-2 border-b-2 border-l-2 rounded-bl-md',
            'bottom-2 right-2 border-b-2 border-r-2 rounded-br-md',
          ].map((cls, i) => (
            <div
              key={i}
              className={`absolute ${cls} w-5 h-5 pointer-events-none`}
              style={{ borderColor: '#9945FF' }}
            />
          ))}
        </div>
      </div>

      {/* Label */}
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-3)' }}>
        <span
          className="h-1.5 w-1.5 rounded-full inline-block anim-pulse"
          style={{ background: '#14F195' }}
        />
        Scan with Phantom · Solflare · any Solana wallet
      </div>
    </div>
  );
}
