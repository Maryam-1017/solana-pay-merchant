import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '../components/Navbar';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SolPay Merchant — Zero-fee payments on Solana',
  description:
    'Accept SOL and USDC directly from any Phantom wallet. No banks, no Stripe, no 3% cut. Built for merchants worldwide.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        {/* Apply saved theme before React hydrates — prevents flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('theme') === 'light') {
              document.documentElement.classList.add('light');
            }
          } catch {}
        ` }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex flex-col flex-1 pt-16">{children}</div>
      </body>
    </html>
  );
}
