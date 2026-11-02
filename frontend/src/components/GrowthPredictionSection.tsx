import { Activity, BarChart3, TrendingUp } from 'lucide-react';
import { User } from '../App';

export const GrowthPredictionSection = ({ user }: { user: User }) => {
  if (user.role !== 'founder') return null;

  const observations = [...(user.fundingHistory || [])]
    .filter((round) => Number.isFinite(round.year) && round.year > 1900 && Number.isFinite(round.amount) && round.amount > 0)
    .sort((a, b) => a.year - b.year);
  const first = observations[0];
  const latest = observations[observations.length - 1];
  const span = first && latest ? latest.year - first.year : 0;
  const annualizedChange = observations.length >= 2 && span > 0
    ? Math.pow(latest.amount / first.amount, 1 / span) - 1
    : null;
  const fundingTrend = annualizedChange === null
    ? null
    : annualizedChange > 0.05 ? 'Larger reported rounds over time'
      : annualizedChange < -0.05 ? 'Smaller reported rounds over time'
        : 'Reported round sizes broadly stable';

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', notation: value >= 1_000_000 ? 'compact' : 'standard', maximumFractionDigits: 1,
  }).format(value);

  return (
    <section className="relative mt-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-xl md:p-8" aria-labelledby="company-growth-title">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="relative z-10 grid gap-7 md:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/20 p-2"><TrendingUp className="h-5 w-5 text-indigo-300" /></div>
            <h3 id="company-growth-title" className="text-xl font-bold">Company growth & financing</h3>
          </div>
          {user.companyTenureLabel && <p className="mb-4 text-sm font-semibold text-indigo-200">{user.companyTenureLabel} · {user.companyMaturity}</p>}
          <p className="mb-5 text-sm leading-relaxed text-slate-300">{user.companyTrendSummary || 'Company history and financing milestones are summarized from the linked public sources.'}</p>
          {annualizedChange !== null ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><TrendingUp className="h-4 w-4" />Round-size change / year</div>
                <div className="text-3xl font-extrabold text-emerald-300">{`${(annualizedChange * 100).toFixed(1)}%`}</div>
                <p className="mt-1 text-[10px] text-slate-400">Annualized between earliest and latest listed financing rounds.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><Activity className="h-4 w-4" />Financing direction</div>
                <div className="text-xl font-extrabold text-indigo-200">{fundingTrend}</div>
              </div>
            </div>
          ) : <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-slate-300">A round-size comparison is omitted where public records do not provide two comparable dated equity rounds. The company trajectory above uses the available operating, product, or market milestones.</p>}
          {user.trendSources?.map((source, index) => <a key={source} href={source} target="_blank" rel="noreferrer" className="mt-4 mr-3 inline-flex text-xs font-semibold text-indigo-300 hover:underline">{index === 0 ? 'Source' : `Source ${index + 1}`} ↗</a>)}
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><BarChart3 className="h-4 w-4" />Publicly reported funding rounds</div>
          {observations.length ? <div className="space-y-3">
            {observations.map((round, index) => (
              <div key={`${round.year}-${round.round}-${index}`} className="flex items-center justify-between gap-4 border-b border-white/5 pb-2 last:border-0">
                <span className="text-sm text-slate-300">{round.round} · {round.year}</span>
                <span className="flex items-center gap-3 font-mono text-sm font-bold text-emerald-300">{formatCurrency(round.amount)}<a href={round.source} target="_blank" rel="noreferrer" aria-label={`Source for ${round.round} in ${round.year}`} className="font-sans text-xs text-indigo-300 hover:underline">source</a></span>
              </div>
            ))}
          </div> : <p className="text-sm leading-relaxed text-slate-300">No comparable public equity-round series is listed for this company. See the company trajectory and linked filings or announcements for operating milestones.</p>}
          <p className="mt-4 text-[10px] leading-relaxed text-slate-400">Round amounts measure reported financing, not revenue, customer growth, or valuation. Secondary sales, debt, and undisclosed terms are excluded unless explicitly labeled.</p>
        </div>
      </div>
    </section>
  );
};
