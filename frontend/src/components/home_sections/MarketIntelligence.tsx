import React, { useState } from 'react';
import { ArrowUpRight, BarChart3, ExternalLink, Newspaper, X } from 'lucide-react';

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
    category: 'US venture · Q3 2026', title: 'Headline VC dollars are heavily concentrated in AI',
    metric: '$515.8B deployed through Q3 · 82.7% of deal value in AI', date: 'Q3 report · Oct 2026',
    source: 'PitchBook–NVCA Venture Monitor', url: 'https://nvca.org/pitchbook-nvca-venture-monitor/',
    summary: 'The latest PitchBook–NVCA monitor reports record U.S. venture investment through September, with AI accounting for 82.7% of deal value. The report also says capital commitments are flowing mainly to established managers, while emerging and midsize firms face a tougher fundraising market and limited exits constrain distributions.',
    founderTakeaway: 'If you are outside AI, make sector-specific demand, customer retention, and capital efficiency easy to verify; aggregate venture totals may overstate the capital available to your category.',
    investorTakeaway: 'Separate mega-round activity from the median financing environment. Manager fundraising and exit constraints can affect reserves, follow-on capacity, and time to liquidity.'
  },
  {
    category: 'Fintech · Q3 2026', title: 'Fintech funding and deal count both contracted year over year',
    metric: 'Funding −21.4% YoY · Deal count nearly −31%', date: 'Published Oct 20, 2026',
    source: 'Crunchbase News', url: 'https://news.crunchbase.com/venture/q3-2026-fintech-startup-funding-deal-count-fell-ai/',
    summary: 'Crunchbase reports that Q3 2026 venture funding into fintech startups fell 21.4% year over year, while the number of deals declined by nearly 31%. The article describes a narrower market that is more dependent on large transactions.',
    founderTakeaway: 'Expect investors to ask for stronger proof of distribution, unit economics, and regulatory readiness. Build a financing plan that does not assume deal volume rebounds quickly.',
    investorTakeaway: 'A falling deal count can reduce noise but also hide weaker access to capital. Underwrite runway and regulatory exposure, and distinguish durable payments infrastructure from crowded themes.'
  },
  {
    category: 'AI agents · Oct 2026', title: 'Manus’ parent raised fresh capital after a proposed acquisition ended',
    metric: '$500M+ raised · Valuation not disclosed', date: 'Published Oct 8, 2026',
    source: 'TechCrunch', url: 'https://techcrunch.com/2026/10/08/chinas-manus-raises-over-500m-in-first-funding-round-since-split-with-meta/',
    summary: 'TechCrunch reports that Butterfly Effect, the parent company behind Manus, raised more than $500 million in its first financing since Meta called off its proposed $2 billion acquisition. Boyu Capital and IDG Capital led the round; the company did not disclose a valuation.',
    founderTakeaway: 'Strategic acquisition interest can create options, but it is not a substitute for a standalone financing plan. Keep ownership, governance, and operating milestones ready for either path.',
    investorTakeaway: 'Treat an abandoned acquisition and a new financing as separate events. The reported round size is public; valuation and resulting dilution were not disclosed.'
  }
];

export function MarketIntelligence({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState<Insight | null>(null);
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0 h-full">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70 shrink-0">
        <div className="flex items-center gap-2"><Newspaper className="w-5 h-5 text-slate-700"/><div><h3 className="font-bold text-slate-900">Market Intelligence</h3><p className="text-[10px] text-slate-500">Curated venture signals · updated Oct 21, 2026</p></div></div>
        <span className="shrink-0 px-2 py-1 rounded-full bg-indigo-50 text-[9px] font-bold text-indigo-700 border border-indigo-100">3 BRIEFS</span>
      </div>
      <div className={`flex-1 overflow-y-auto p-3 custom-scrollbar ${compact ? 'space-y-2' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 content-start'}`}>
        {insights.map((item) => (
          <button key={item.title} type="button" onClick={() => setSelected(item)} className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 group">
            <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold uppercase tracking-wide text-indigo-700">{item.category}</span><ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600"/></div>
            <p className="mt-1.5 text-xs font-bold leading-snug text-slate-900">{item.title}</p>
            <p className="mt-2 flex items-start gap-1.5 text-[10px] font-semibold leading-snug text-emerald-800"><BarChart3 className="w-3.5 h-3.5 shrink-0"/>{item.metric}</p>
            <p className="mt-2 text-[9px] text-slate-500">{item.source} · {item.date}</p>
            <p className="mt-1 text-[9px] font-semibold text-indigo-600">Click for founder and investor implications</p>
          </button>
        ))}
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
