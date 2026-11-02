import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, BarChart3, ExternalLink, Newspaper, X, RefreshCw, TrendingUp, Activity } from 'lucide-react';
import { apiFetch } from '../../apiFetch';

type Insight = {
  category: string;
  title: string;
  metric: string;
  date: string;
  source: string;
  url: string;
  summary: string;
  founderTakeaway: string;
  investorTakeaway: string;
};

const insights: Insight[] = [
  {
    category: 'Global venture · Q3 2026', title: 'AI absorbed nearly two thirds of global venture dollars',
    metric: '$159B invested in Q3 · $102B went to AI · 27 $1B+ rounds', date: 'Crunchbase report · Oct 5, 2026',
    source: 'Crunchbase News · Global startup funding', url: 'https://news.crunchbase.com/venture/q3-2026-global-startup-funding-ai-billion-dollar-rounds-exits-data/',
    summary: 'Crunchbase counted $159 billion across nearly 6,000 funded startups in Q3. Investment fell 25% from Q2 but rose 53% year over year. AI companies raised about $102 billion, or 64% of the quarter’s total; 27 companies announced rounds of at least $1 billion.',
    founderTakeaway: 'Fundraising remains possible, but a handful of very large AI financings pull the headline totals upward. Show customer demand, retention, and runway in your own market rather than relying on broad venture totals.',
    investorTakeaway: 'Deal value is unusually concentrated. Separate mega-round exposure from the pace and pricing of ordinary seed, early-stage, and non-AI rounds.'
  },
  {
    category: 'United States · Q3 2026', title: 'Record venture totals mask a sharply uneven market',
    metric: '$515.8B U.S. deal value through Q3 · AI = 82.7%', date: 'PitchBook–NVCA Q3 monitor · Oct 2026',
    source: 'National Venture Capital Association', url: 'https://nvca.org/pitchbook-nvca-venture-monitor/',
    summary: 'The PitchBook–NVCA Venture Monitor reports U.S. venture deal value of $515.8 billion through September, already above the prior full-year record. AI accounted for 82.7% of deal value. The report also describes difficult fundraising for emerging and midsize managers and limited exits that constrain distributions.',
    founderTakeaway: 'Make your category, customer proof, and cash plan easy to assess. The record headline does not mean capital is broadly available across sectors or stages.',
    investorTakeaway: 'Review fund concentration, reserve needs, and portfolio exit timelines alongside the record deployment figure; fundraising conditions remain uneven.'
  },
  {
    category: 'Fintech · Q3 2026', title: 'Fintech deal activity hit a four-year low',
    metric: '$11B raised · 650 deals · 61% of funding went to mega-rounds', date: 'CB Insights · Oct 13, 2026',
    source: 'CB Insights · State of Fintech Q3’26', url: 'https://www.cbinsights.com/research/report/fintech-trends-q3-2026/',
    summary: 'CB Insights reports Q3 fintech funding of $11 billion, down 18% quarter over quarter, across 650 deals—the fewest in more than four years. Rounds above $100 million made up 4% of deals but 61% of funding. Its 2026-to-date median fintech deal was $5 million, up 19% year over year.',
    founderTakeaway: 'A smaller number of large rounds can leave early-stage teams competing for a narrower pool. Bring evidence on distribution, regulatory readiness, and path to efficient growth.',
    investorTakeaway: 'Look beneath aggregate dollars: the median deal rose while deal count fell. Compare stage and geography before treating the sector total as a single trend.'
  },
  {
    category: 'AI public markets · Oct 26, 2026', title: 'Anthropic’s public S-1 puts growth and spending under scrutiny',
    metric: '$16.3B first-half revenue · $693M operating loss · $80.7B net loss', date: 'SEC filing · Oct 26, 2026',
    source: 'U.S. Securities and Exchange Commission · Form S-1', url: 'https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/anthropicpbc-sx1.htm',
    summary: 'Anthropic filed a proposed IPO registration statement on October 26. The S-1 reports first-half 2026 revenue of $16.286 billion and an operating loss of $693 million. It reports a much larger $80.748 billion net loss, driven primarily by a $72.388 billion non-cash change in the fair value of convertible notes, derivative liabilities, and SAFEs. The filing also reports $1.618 billion of adjusted operating income, a non-GAAP measure.',
    founderTakeaway: 'The filing shows why revenue, operating results, cash needs, and financing-accounting effects should be read separately. Public-market scrutiny rewards clear, reconcilable metrics.',
    investorTakeaway: 'Read the audited statements and risk factors directly. The headline net loss is not the operating loss; adjusted figures are non-GAAP and should be compared with GAAP results.'
  }
];

export function MarketIntelligence({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState<Insight | null>(null);
  const [live, setLive] = useState<{ entries: { title: string; url: string; filedAt: string | null; summary: string }[]; fetchedAt: string | null; stale: boolean; error?: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshFilings = useCallback(async () => {
    setRefreshing(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await apiFetch(`${apiUrl}/api/market/updates`);
      const data = await response.json();
      if (!response.ok && !data.entries?.length) throw new Error(data.error || 'Live SEC filings are temporarily unavailable.');
      setLive(data);
    } catch (error) {
      setLive(previous => previous ? { ...previous, stale: true, error: error instanceof Error ? error.message : 'Feed unavailable.' } : { entries: [], fetchedAt: null, stale: true, error: error instanceof Error ? error.message : 'Feed unavailable.' });
    } finally { setRefreshing(false); }
  }, []);
  useEffect(() => {
    refreshFilings();
    const interval = window.setInterval(refreshFilings, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [refreshFilings]);
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm flex flex-col min-h-[580px]">
      <div className="rounded-t-3xl border-b border-slate-100 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 px-5 py-5 text-white md:px-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15"><Newspaper className="h-5 w-5 text-indigo-200" /></div><div><div className="flex items-center gap-2"><h3 className="text-lg font-bold">Market Intelligence</h3><span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200">Updated Nov 1</span></div><p className="mt-0.5 text-xs text-slate-300">Current venture signals, public filings, and founder-ready context</p></div></div>
          <button type="button" onClick={refreshFilings} disabled={refreshing} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/15 disabled:opacity-60" aria-label="Refresh SEC filings"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Refreshing' : 'Refresh filings'}</button>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-white/10 px-3 py-2"><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-300">Global VC · Q3</p><p className="mt-0.5 text-sm font-bold">$159B deployed</p></div>
          <div className="rounded-xl bg-white/10 px-3 py-2"><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-300">AI share · Global Q3</p><p className="mt-0.5 text-sm font-bold">64% of funding</p></div>
          <div className="rounded-xl bg-white/10 px-3 py-2"><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-300">Latest official filing</p><p className="mt-0.5 text-sm font-bold">Anthropic S-1 · Oct 26</p></div>
        </div>
      </div>
      <div className="space-y-5 p-4 md:p-6">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="rounded-xl bg-white p-2 text-emerald-700 shadow-sm"><Activity className="h-4 w-4" /></span><div><p className="text-xs font-bold text-emerald-950">Live SEC Form D notices</p><p className="mt-0.5 text-[10px] text-emerald-900/70">Recent issuer-filed exempt offering notices</p></div></div><a href="https://www.sec.gov/search-filings" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[10px] font-bold text-emerald-800 shadow-sm hover:bg-emerald-100">Open EDGAR <ExternalLink className="h-3 w-3" /></a></div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-600">{live?.fetchedAt ? `${live.stale ? 'Last successful refresh' : 'Feed refreshed'} ${new Date(live.fetchedAt).toLocaleString()}. ` : 'Connecting to EDGAR. '}Form D is an issuer notice, not SEC approval or confirmation of deal terms, and it does not cover every venture round.</p>
          {live?.error && <p role="status" className="mt-2 text-[10px] font-medium text-amber-800">{live.error}{live.stale ? ' Showing the last cached feed.' : ''}</p>}
          {live?.entries?.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{live.entries.slice(0, compact ? 3 : 6).map((entry, index) => <a key={`${entry.url}-${index}`} href={entry.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-white/90 px-3 py-2.5 transition hover:border-emerald-300"><span className="truncate text-[10px] font-semibold text-slate-800">{entry.title}</span><span className="shrink-0 text-[9px] text-slate-500">{entry.filedAt && Number.isFinite(Date.parse(entry.filedAt)) ? new Date(entry.filedAt).toLocaleDateString() : 'EDGAR'} <ExternalLink className="inline h-3 w-3" /></span></a>)}</div> : !live?.error ? <p className="mt-3 text-[10px] text-slate-500">Loading current filings…</p> : null}
        </div>
        <div className="flex items-center gap-2 px-1"><TrendingUp className="h-4 w-4 text-indigo-600"/><div><h4 className="text-sm font-bold text-slate-900">Signals to watch</h4><p className="text-[10px] text-slate-500">Latest published quarter: Q3 2026 · source dates shown on each brief</p></div></div>
        <div className={`grid grid-cols-1 gap-3 ${compact ? '' : 'md:grid-cols-2'}`}>
          {insights.map((item, index) => (
            <button key={item.title} type="button" onClick={() => setSelected(item)} className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-400 md:p-5">
              <div className="flex items-start justify-between gap-3"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-indigo-800">{item.category}</span><span className="rounded-lg bg-slate-50 p-1.5 text-slate-400 transition group-hover:bg-indigo-50 group-hover:text-indigo-700"><ArrowUpRight className="h-4 w-4"/></span></div>
              <p className="mt-3 text-sm font-bold leading-snug text-slate-900">{item.title}</p>
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5"><p className="flex items-start gap-2 text-xs font-bold leading-relaxed text-emerald-800"><BarChart3 className="mt-0.5 h-4 w-4 shrink-0"/>{item.metric}</p></div>
              <p className="mt-3 text-[10px] font-semibold text-slate-500">{item.source}</p><p className="mt-0.5 text-[9px] text-slate-400">{item.date}</p>
              <p className="mt-3 text-[10px] font-bold text-indigo-700">Open brief · founder and investor context</p>
            </button>
          ))}
        </div>
        <p className="px-1 text-[10px] leading-relaxed text-slate-400">Research briefs are dated snapshots, not live market quotes. Metrics follow the definitions and coverage of each named source; compare methodology before combining datasets.</p>
      </div>
      {selected && <div className="fixed inset-0 z-[120] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
        <article role="dialog" aria-modal="true" aria-labelledby="market-brief-title" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
          <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-100 bg-white p-5"><div><span className="text-[10px] font-bold uppercase tracking-widest text-indigo-700">{selected.category}</span><h2 id="market-brief-title" className="mt-1 text-lg font-bold text-slate-900">{selected.title}</h2><p className="mt-1 text-xs text-slate-500">{selected.source} · {selected.date}</p></div><button type="button" aria-label="Close market brief" onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5"/></button></div>
          <div className="space-y-5 p-5"><div className="rounded-xl bg-emerald-50 p-4"><div className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Reported signal</div><p className="mt-1 text-sm font-semibold text-emerald-950">{selected.metric}</p></div><p className="text-sm leading-relaxed text-slate-700">{selected.summary}</p><div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">For founders</h3><p className="mt-2 text-xs leading-relaxed text-slate-600">{selected.founderTakeaway}</p></div><div className="rounded-xl border border-slate-200 p-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">For investors</h3><p className="mt-2 text-xs leading-relaxed text-slate-600">{selected.investorTakeaway}</p></div></div><a href={selected.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700">Read source <ExternalLink className="w-3.5 h-3.5"/></a><p className="text-[10px] text-slate-400">This is a dated research snapshot, not live news or investment advice. Verify source data before making decisions.</p></div>
        </article>
      </div>}
    </section>
  );
}
