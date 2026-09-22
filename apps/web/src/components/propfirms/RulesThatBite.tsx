import clsx from 'clsx';
import { ExternalLink } from 'lucide-react';
import type { PropFirm } from '@/components/payout/propFirmData';
import {
  NEWS_LABEL,
  finePrintFor,
  type FineRule,
  type FirmFinePrint,
  type NewsPolicy,
} from '@/components/payout/firmFinePrint';

const NEWS_TONE: Record<NewsPolicy, string> = {
  allowed: 'text-tp-green',
  restricted: 'text-tp-yellow',
  'banned-funded': 'text-tp-red',
  unknown: 'text-white/50',
};

const usd = (n: number) => `$${n.toLocaleString()}`;

function SourceTag({ source }: { source: FineRule<unknown>['source'] }) {
  return (
    <span
      className={clsx(
        'ml-2 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        source === 'official' ? 'bg-tp-green/10 text-tp-green' : 'bg-tp-yellow/10 text-tp-yellow',
      )}
      title={source === 'official' ? "Read on the firm's own help center" : 'Only reported by third-party sites'}
    >
      {source}
    </span>
  );
}

interface Row {
  label: string;
  value: React.ReactNode;
  note?: string;
  source: FineRule<unknown>['source'];
}

function rowsFor(firm: PropFirm, fp: FirmFinePrint): Row[] {
  const rows: Row[] = [
    {
      label: 'News trading',
      value: <span className={NEWS_TONE[fp.news.value]}>{NEWS_LABEL[fp.news.value]}</span>,
      note: fp.news.note,
      source: fp.news.source,
    },
  ];
  if (fp.payoutCaps) {
    const caps = firm.tiers
      .filter((t) => fp.payoutCaps!.value[t.id])
      .map((t) => `${t.label} ${usd(fp.payoutCaps!.value[t.id])}`)
      .join(' · ');
    rows.push({ label: 'Payout cap per request', value: caps, note: fp.payoutCaps.note, source: fp.payoutCaps.source });
  }
  if (fp.minPayout) rows.push({ label: 'Minimum payout', value: usd(fp.minPayout.value), source: fp.minPayout.source });
  if (fp.payoutDays) {
    const m = fp.payoutDays.value.minDayProfit;
    const perDay =
      m === null ? '' : typeof m === 'number' ? ` of ${usd(m)}+` : ` (${Object.values(m).map(usd).join(' / ')}+ by size)`;
    rows.push({
      label: 'Days per payout',
      value: `${fp.payoutDays.value.count} winning days${perDay}`,
      note: fp.payoutDays.note,
      source: fp.payoutDays.source,
    });
  }
  if (fp.maxPayouts) rows.push({ label: 'Payouts per account', value: `${fp.maxPayouts.value} max`, note: fp.maxPayouts.note, source: fp.maxPayouts.source });
  if (fp.safetyNet) rows.push({ label: 'Buffer / safety net', value: fp.safetyNet.value, source: fp.safetyNet.source });
  if (fp.inactivity) rows.push({ label: 'Inactivity', value: fp.inactivity.value, source: fp.inactivity.source });
  for (const g of fp.gotchas ?? []) rows.push({ label: 'Also', value: g.value, source: g.source });
  return rows;
}

/** The fine print for each program of a firm, with where every line came from. */
export function RulesThatBite({ programs, className }: { programs: PropFirm[]; className?: string }) {
  const withPrint = programs
    .map((p) => ({ program: p, fp: finePrintFor(p.id) }))
    .filter((x): x is { program: PropFirm; fp: FirmFinePrint } => x.fp !== null);
  if (!withPrint.length) return null;

  return (
    <div className={className}>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40">Rules that bite</h3>
      <p className="mt-2 text-xs leading-relaxed text-white/40">
        The rules that hold payouts and close accounts. <span className="text-tp-green">Official</span> lines were read
        on the firm&apos;s help center; <span className="text-tp-yellow">reported</span> lines come only from review
        sites. Firms change these often, so check before you trade.
      </p>
      <div className="mt-4 space-y-5">
        {withPrint.map(({ program, fp }) => (
          <div key={program.id} className="overflow-hidden rounded-xl border border-white/[0.08]">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0A1220] px-4 py-2.5">
              <span className="text-sm font-semibold text-white/80">{program.program}</span>
              <span className="text-[11px] text-white/35">Checked {fp.checked}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {rowsFor(program, fp).map((row, i) => (
                  <tr key={`${row.label}-${i}`} className={clsx(i % 2 === 0 ? 'bg-[#111F35]' : 'bg-[#0D1628]')}>
                    <td className="w-40 px-4 py-3 align-top font-medium text-white/45">{row.label}</td>
                    <td className="px-4 py-3 text-white/80">
                      <span>{row.value}</span>
                      <SourceTag source={row.source} />
                      {row.note && <p className="mt-1 text-xs leading-relaxed text-white/40">{row.note}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fp.sources.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 bg-[#0A1220] px-4 py-2.5">
                {fp.sources.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-tp-blue hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {new URL(url).hostname.replace(/^www\./, '')}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
