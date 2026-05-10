import Link from 'next/link';

const STATS = [
  { value: '0%',   label: 'Processing fee' },
  { value: '<1s',  label: 'Settlement time' },
  { value: '100+', label: 'Supported wallets' },
  { value: '$0',   label: 'Monthly fee' },
];

const FEATURES = [
  {
    icon: '⚡',
    title: 'Instant Settlement',
    body: 'Funds hit your wallet in seconds — not 2–3 business days. No holds, no reserves, no surprises.',
  },
  {
    icon: '🏦',
    title: 'No Bank Required',
    body: 'A Phantom wallet is your bank account. No KYC for small merchants, no minimum balance.',
  },
  {
    icon: '🔐',
    title: 'On-Chain Escrow',
    body: 'USDC locks in a smart contract. Merchant claims within 24 hrs or customer auto-refunds. Chargebacks replaced by code.',
  },
  {
    icon: '🌍',
    title: 'Built for Everyone',
    body: 'Designed for merchants in Southeast Asia, Latin America, and Africa who deserve global payment access.',
  },
  {
    icon: '💵',
    title: 'SOL & USDC',
    body: 'Accept the native token or a dollar-pegged stablecoin — your choice, one toggle.',
  },
  {
    icon: '📱',
    title: 'Scan & Pay',
    body: 'Customers scan a QR code with Phantom or Solflare. No app download, no card details.',
  },
];

const STEPS = [
  { n: '01', title: 'Register',      body: 'Paste your Phantom wallet. Done in 30 seconds.' },
  { n: '02', title: 'Set amount',    body: 'Enter SOL or USDC — get a QR code instantly.' },
  { n: '03', title: 'Customer scans', body: 'One tap approval in their wallet app.' },
  { n: '04', title: 'Money arrives', body: 'Your wallet balance updates within seconds.' },
];

export default function Home() {
  return (
    <div className="flex flex-col overflow-hidden">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 py-28 min-h-[90vh]">

        {/* Background orbs */}
        <div
          className="pointer-events-none absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full blur-[120px] opacity-25 anim-orb"
          style={{ background: 'radial-gradient(circle,#9945FF,transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full blur-[100px] opacity-20"
          style={{ background: 'radial-gradient(circle,#14F195,transparent 70%)', animationDelay:'3s' }}
        />

        {/* UMT Credit */}
        <div className="mb-5 flex flex-col items-center gap-1">
          <div
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5"
            style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)' }}
          >
            <span className="text-lg">🎓</span>
            <div className="text-left">
              <p className="text-xs font-black tracking-wide text-white leading-none">UMT</p>
              <p className="text-[10px] leading-none mt-0.5" style={{ color:'var(--text-3)' }}>
                University of Management and Technology
              </p>
            </div>
          </div>
        </div>

        {/* Badge */}
        <span
          className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
          style={{ background:'rgba(153,69,255,0.12)', border:'1px solid rgba(153,69,255,0.3)', color:'#C084FC' }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#14F195] inline-block" />
          Solana Hackathon 2025
        </span>

        {/* Headline */}
        <h1 className="max-w-3xl text-5xl sm:text-6xl font-extrabold leading-[1.08] tracking-tight">
          Zero-fee payments for merchants{' '}
          <span className="g-text">who can't access Stripe</span>
        </h1>

        <p className="mt-6 max-w-lg text-base leading-relaxed" style={{ color:'var(--text-2)' }}>
          Skip Stripe's 2.9% + 30¢. Accept SOL &amp; USDC directly — no banks,
          no intermediaries, instant settlement worldwide.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap gap-3 justify-center">
          <Link href="/onboarding" className="btn-sol px-7 py-3 text-sm rounded-xl">
            Start Accepting Payments →
          </Link>
          <Link href="/dashboard" className="btn-ghost px-7 py-3 text-sm rounded-xl">
            Open Dashboard
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-2xl">
          {STATS.map(({ value, label }) => (
            <div key={label} className="glass rounded-xl py-4 px-3 flex flex-col items-center gap-1">
              <span className="text-2xl font-extrabold g-text">{value}</span>
              <span className="text-xs" style={{ color:'var(--text-3)' }}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-5xl mx-auto w-full">
        <h2 className="text-center text-3xl font-bold mb-12">
          Why merchants switch to{' '}
          <span className="g-text">SolPay</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon, title, body }) => (
            <div
              key={title}
              className="glass rounded-2xl p-6 flex flex-col gap-3 hover:border-[rgba(153,69,255,0.35)] transition-all duration-300"
              style={{ border:'1px solid var(--border)' }}
            >
              <span className="text-3xl">{icon}</span>
              <h3 className="font-bold text-base">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color:'var(--text-2)' }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background:'rgba(153,69,255,0.04)' }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center text-3xl font-bold mb-12">How it works</h2>
          <div className="flex flex-col gap-0">
            {STEPS.map(({ n, title, body }, i) => (
              <div key={n} className="flex gap-5">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                    style={{ background:'linear-gradient(135deg,#9945FF,#14F195)', color:'#fff' }}
                  >
                    {n}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-px flex-1 my-1" style={{ background:'var(--border)' }} />
                  )}
                </div>
                {/* Content */}
                <div className="pb-8">
                  <p className="font-bold text-base mt-2">{title}</p>
                  <p className="text-sm mt-1" style={{ color:'var(--text-2)' }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="px-6 py-24 flex flex-col items-center text-center">
        <div
          className="rounded-3xl p-10 max-w-2xl w-full flex flex-col items-center gap-6"
          style={{ background:'linear-gradient(135deg,rgba(153,69,255,0.12),rgba(20,241,149,0.06))', border:'1px solid rgba(153,69,255,0.25)' }}
        >
          <h2 className="text-3xl font-extrabold">Ready to go fee-free?</h2>
          <p style={{ color:'var(--text-2)' }} className="text-sm max-w-sm">
            Register in 30 seconds. Generate your first QR in 10 more.
            Your first payment lands before the bank opens.
          </p>
          <Link href="/onboarding" className="btn-sol px-8 py-3 text-sm rounded-xl">
            Create Merchant Account
          </Link>
        </div>
        <p className="mt-10 text-xs" style={{ color:'var(--text-3)' }}>
          Powered by Solana Pay · Anchor · Helius · PostgreSQL
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs" style={{ color:'var(--text-3)' }}>
          <span>🎓</span>
          <span>Built at <span className="text-white font-semibold">University of Management and Technology (UMT)</span></span>
        </div>
      </section>
    </div>
  );
}
