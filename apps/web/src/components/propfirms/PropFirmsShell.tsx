import Link from 'next/link';
import { Activity, ArrowRight } from 'lucide-react';

export function PropFirmsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-[#E0EAF8]">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0D1628]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/app/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-tp-green/20 bg-tp-green/10">
              <Activity className="h-4 w-4 text-tp-green" />
            </div>
            <span className="text-base font-semibold tracking-tight text-white">TradePilot</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm sm:flex">
            <Link href="/propfirms" className="font-medium text-white">
              Prop Firms
            </Link>
            <Link href="/app/payout" className="text-white/50 transition hover:text-white/80">
              Payout Planner
            </Link>
            <Link
              href="/app/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-tp-green px-4 py-2 text-sm font-medium text-[#0D1628] transition hover:bg-tp-green/90"
            >
              Open App
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>

          <Link
            href="/app/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg bg-tp-green px-3 py-2 text-sm font-medium text-[#0D1628] sm:hidden"
          >
            Open App
          </Link>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-20 border-t border-white/[0.06] bg-[#0A1220]">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-center text-xs leading-relaxed text-white/35">
            Rules shown are for planning purposes and may change. Always verify on each firm&apos;s official site
            before trading. TradePilot is not affiliated with any prop firm listed here.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-white/25">
            <Link href="/app/dashboard" className="hover:text-white/50">
              Dashboard
            </Link>
            <Link href="/propfirms" className="hover:text-white/50">
              Prop Firms
            </Link>
            <Link href="/app/payout" className="hover:text-white/50">
              Payout Planner
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
