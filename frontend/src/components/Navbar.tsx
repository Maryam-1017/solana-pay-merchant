'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV_LINKS = [
  { href: '/dashboard',         label: 'Dashboard'  },
  { href: '/dashboard/payment', label: 'Pay'        },
  { href: '/history',           label: 'History'    },
  { href: '/analytics',         label: 'Analytics', badge: 'NEW' },
  { href: '/rewards',           label: 'Rewards',   badge: 'NEW' },
  { href: '/onboarding',        label: 'Profile'    },
];

export function Navbar() {
  const pathname  = usePathname();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up   = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 h-14"
      style={{
        background: 'rgba(8,8,18,0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="max-w-5xl mx-auto px-5 h-full flex items-center justify-between gap-2">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black"
            style={{ background: 'linear-gradient(135deg,#9945FF,#14F195)' }}
          >◎</span>
          <span className="font-extrabold tracking-tight g-text text-base hidden sm:block">SolPay</span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {NAV_LINKS.map(({ href, label, badge }) => {
            const active = href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="relative px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0"
                style={{
                  color:      active ? '#C084FC' : 'var(--text-2)',
                  background: active ? 'rgba(153,69,255,0.12)' : 'transparent',
                }}
              >
                {label}
                {badge && (
                  <span className="absolute -top-1 -right-1 text-[8px] font-black px-1 rounded-full"
                    style={{ background:'#14F195', color:'#080812' }}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Offline badge */}
        {!online && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
            style={{ background:'rgba(251,146,60,0.15)', border:'1px solid rgba(251,146,60,0.35)', color:'#FB923C' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 inline-block" />
            Offline
          </div>
        )}
        {online && (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
            style={{ background:'rgba(20,241,149,0.08)', border:'1px solid rgba(20,241,149,0.2)', color:'#14F195' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#14F195] inline-block" />
            Online
          </div>
        )}
      </div>
    </nav>
  );
}
