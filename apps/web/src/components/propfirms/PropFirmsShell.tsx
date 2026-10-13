import Link from 'next/link';

export function PropFirmsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full text-[#E0EAF8]">
      <main>{children}</main>

      <footer className="mt-20 border-t border-white/[0.06] bg-[#07090E]">
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
