'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/dashboard',         label: 'Dashboard' },
  { href: '/dashboard/payment', label: 'Pay'       },
  { href: '/history',           label: 'History'   },
  { href: '/onboarding',        label: 'Profile'   },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 h-14"
      style={{
        background: 'rgba(8,8,18,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="max-w-5xl mx-auto px-5 h-full flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black"
            style={{ background: 'linear-gradient(135deg,#9945FF,#14F195)' }}
          >
            ◎
          </span>
          <span className="font-extrabold tracking-tight g-text text-base hidden sm:block">
            SolPay
          </span>
          <span style={{ color: 'var(--text-3)' }} className="text-xs hidden md:block">
            Merchant
          </span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-0.5">
          {NAV_LINKS.map(({ href, label }) => {
            const active =
              href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  color:      active ? '#C084FC' : 'var(--text-2)',
                  background: active ? 'rgba(153,69,255,0.12)' : 'transparent',
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
