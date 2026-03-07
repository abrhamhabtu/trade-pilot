import Link from 'next/link';

export function MarketingHome() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#111827_45%,#030712_100%)] text-white">
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1 text-sm text-emerald-300">
          Open-source trading journal with a hosted upgrade path
        </div>
        <div className="mt-10 grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
              Trade journaling built for local ownership today and cloud delivery later.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              TradePilot keeps the self-hosted workflow simple while moving the product onto a route-based Next.js
              architecture that can support accounts, managed hosting, and email auth when you are ready.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/app/dashboard"
                className="rounded-xl bg-white px-6 py-3 font-medium text-slate-950 transition hover:bg-slate-200"
              >
                Open App
              </Link>
              <a
                href="https://github.com/abrhamhabtu/trade-pilot"
                className="rounded-xl border border-white/15 px-6 py-3 font-medium text-white transition hover:border-white/30 hover:bg-white/5"
              >
                View Source
              </a>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                <p className="text-sm text-slate-400">Framework</p>
                <p className="mt-2 text-2xl font-semibold">Next.js 14</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                <p className="text-sm text-slate-400">Storage Modes</p>
                <p className="mt-2 text-2xl font-semibold">Local + Cloud-ready</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                <p className="text-sm text-slate-400">Routing</p>
                <p className="mt-2 text-2xl font-semibold">URL-based app sections</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                <p className="text-sm text-slate-400">Business Model</p>
                <p className="mt-2 text-2xl font-semibold">OSS + hosted service</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
