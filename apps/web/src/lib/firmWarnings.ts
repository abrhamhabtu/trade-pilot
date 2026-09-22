// ─── Firm warnings ─────────────────────────────────────────────────────────────
// Turns a firm's fine print into the one or two lines a trader needs to read
// before the open on a given day. Only rules that can end an account or hold a
// payout make it here; everything else lives on the firm's page.
// ───────────────────────────────────────────────────────────────────────────────

import type { Account } from '@/store/accountStore';
import type { PreflightReason } from '@/lib/preflight';
import { rulesForAccount } from '@/lib/liquidation';
import { finePrintFor, tierOneReleasesOn } from '@/components/payout/firmFinePrint';

const DAY_MS = 86_400_000;

export function firmWarningsFor(account: Account | null, date: string): PreflightReason[] {
  if (!account) return [];
  const rules = rulesForAccount(account);
  const fp = finePrintFor(rules?.firmId);
  if (!rules || !fp) return [];

  const firm = rules.label.split(' · ')[0];
  const out: PreflightReason[] = [];
  const releases = tierOneReleasesOn(date);
  const funded = account.isFunded === true;
  const window = fp.newsWindowMinutes;

  for (const r of releases) {
    const when = `${r.label} at ${r.time}${r.certainty === 'typical' ? ' (confirm the date)' : ''}`;
    if (fp.news.value === 'banned-funded' && funded) {
      out.push({
        id: `news-ban-${r.label}`,
        severity: 'warn',
        text: `${when}. ${firm} bans funded positions and resting orders ${window ?? 2} minutes either side. A breach voids the account.`,
        action: 'Be flat with no working orders before the window opens.',
      });
    } else if (fp.news.value === 'restricted') {
      out.push({
        id: `news-restricted-${r.label}`,
        severity: 'warn',
        text: `${when}. ${fp.news.note}`,
        action: 'Trade small or step aside through the release.',
      });
    } else if (fp.news.value === 'unknown') {
      out.push({
        id: `news-unknown-${r.label}`,
        severity: 'warn',
        text: `${when}. We could not confirm ${firm}'s news rule.`,
        action: 'Check the firm’s rules before you hold through it.',
      });
    }
  }

  // Firms that void accounts over news: remind on every funded day, because CPI
  // dates are not something we can see.
  if (!releases.length && fp.news.value === 'banned-funded' && funded) {
    out.push({
      id: 'news-ban-check',
      severity: 'warn',
      text: `${firm} voids funded accounts that hold positions or orders through CPI, FOMC or the jobs report.`,
      action: 'Check today’s economic calendar before the open.',
    });
  }

  const payouts = (account.balanceAdjustments ?? []).filter((a) => a.type === 'payout').length;
  if (fp.maxPayouts && payouts >= fp.maxPayouts.value - 1 && payouts < fp.maxPayouts.value) {
    out.push({
      id: 'last-payout',
      severity: 'warn',
      text: `The next payout is this account's last (${fp.maxPayouts.value} max). ${fp.maxPayouts.note ?? ''}`.trim(),
      action: 'Size the request to take everything the rules allow.',
    });
  }

  if (fp.inactivity && account.status === 'active') {
    const last = account.trades.reduce((m, t) => (t.date > m ? t.date : m), '');
    if (last) {
      const idle = Math.floor((Date.parse(`${date}T12:00:00`) - Date.parse(`${last.slice(0, 10)}T12:00:00`)) / DAY_MS);
      if (idle >= 14) {
        out.push({
          id: 'inactivity',
          severity: 'warn',
          text: `No trades on this account for ${idle} days. ${fp.inactivity.value}`,
          action: 'Log qualifying days before the account goes dormant.',
        });
      }
    }
  }

  return out;
}
