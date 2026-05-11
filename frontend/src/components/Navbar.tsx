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
  const pathname = usePathname();
  const [online,    setOnline]  = useState(true);
  const [darkMode,  setDark]    = useState(true);
  const [mounted,   setMounted] = useState(false);

  // Read theme from DOM (set by the anti-flash script in layout.tsx)
  useEffect(() => {
    setMounted(true);
    setDark(!document.documentElement.classList.contains('light'));

    setOnline(navigator.onLine);
    const up   = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online',  up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDark(next);
    if (next) {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 h-16"
      style={{
        background:           'var(--nav-bg)',
        backdropFilter:        'blur(24px)',
        WebkitBackdropFilter:  'blur(24px)',
        borderBottom:          '1px solid var(--nav-border)',
        transition:            'background 0.25s ease',
      }}
    >
      <div className="max-w-5xl mx-auto px-5 h-full flex items-center justify-between gap-3">

        {/* Logo — bigger */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-base font-black shadow-lg"
            style={{ background: 'linear-gradient(135deg,#9945FF,#14F195)' }}
          >
            ◎
          </span>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-extrabold tracking-tight g-text text-xl">SolPay</span>
            <span className="text-[10px] font-semibold" style={{ color:'var(--text-3)' }}>Merchant</span>
          </div>
        </Link>

        {/* Nav links — bigger & bolder */}
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {NAV_LINKS.map(({ href, label, badge }) => {
            const active = href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="relative px-3 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex-shrink-0"
                style={{
                  color:      active ? '#9945FF' : 'var(--text-2)',
                  background: active ? 'rgba(153,69,255,0.12)' : 'transparent',
                  letterSpacing: '0.01em',
                }}
              >
                {label}
                {badge && (
                  <span
                    className="absolute -top-1 -right-1 text-[8px] font-black px-1 rounded-full"
                    style={{ background:'#14F195', color:'#080812' }}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Online / Offline pill */}
          {!online ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold"
              style={{ background:'rgba(251,146,60,0.15)', border:'1px solid rgba(251,146,60,0.35)', color:'#EA580C' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 inline-block" />
              Offline
            </div>
          ) : (
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold"
              style={{ background:'rgba(20,241,149,0.08)', border:'1px solid rgba(20,241,149,0.2)', color:'#14F195' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#14F195] inline-block" />
              Online
            </div>
          )}

          {/* Dark / Light toggle */}
          {mounted && (
            <button
              onClick={toggleTheme}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-base transition-all"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(153,69,255,0.5)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
