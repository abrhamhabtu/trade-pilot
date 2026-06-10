import Link from 'next/link';
import clsx from 'clsx';
import type { PropFirmBrand } from '@/lib/propfirms';

interface FirmCardProps {
  brand: PropFirmBrand;
}

export function FirmCard({ brand }: FirmCardProps) {
  const isLive = brand.status === 'live';
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-2xl" aria-hidden>
          {brand.emoji}
        </span>
        {!isLive && (
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Soon
          </span>
        )}
      </div>
      <h3 className="mt-3 text-base font-semibold text-white">{brand.name}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/50">{brand.summary}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {brand.assetClasses.map((asset) => (
          <span
            key={asset}
            className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium capitalize text-white/45"
          >
            {asset}
          </span>
        ))}
      </div>
    </>
  );

  if (!isLive) {
    return (
      <div
        className={clsx(
          'rounded-2xl border border-white/[0.06] bg-[#201F1B]/60 p-5 opacity-60',
          'cursor-not-allowed'
        )}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={`/propfirms/${brand.slug}`}
      className={clsx(
        'group block rounded-2xl border border-white/[0.08] bg-[#201F1B] p-5 transition',
        'hover:border-tp-green/25 hover:bg-[#152540] hover:shadow-lg hover:shadow-tp-green/5'
      )}
    >
      {inner}
      <p className="mt-4 text-xs font-medium text-tp-green opacity-0 transition group-hover:opacity-100">
        View rules &rarr;
      </p>
    </Link>
  );
}
