import { useEffect, useState } from 'react';
import { Building2, Search, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EntitySelectionPanelProps {
  onRunCheck: (investor: string, target: string) => void;
  isLoading?: boolean;
  preselectedInvestor?: string;
  preselectedTarget?: string;
  compact?: boolean;
  className?: string;
}

const EntitySelectionPanel = ({
  onRunCheck,
  isLoading = false,
  preselectedInvestor = '',
  preselectedTarget = '',
  compact,
  className = '',
}: EntitySelectionPanelProps) => {
  const [investor, setInvestor] = useState(preselectedInvestor);
  const [targetCompany, setTargetCompany] = useState(preselectedTarget);

  useEffect(() => setInvestor(preselectedInvestor), [preselectedInvestor]);
  useEffect(() => setTargetCompany(preselectedTarget), [preselectedTarget]);

  const handleRunCheck = () => {
    if (investor.trim() && targetCompany.trim()) {
      onRunCheck(investor.trim(), targetCompany.trim());
    }
  };

  return (
    <div className={`flex h-full flex-col ${className}`}>
      <div className="mb-5 flex items-center gap-3 px-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 shadow-md shadow-slate-900/20">
          <Search className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-extrabold text-slate-900">Entity selection</h3>
          <p className="text-xs text-slate-500">Enter names from the relationship graph or load a synthetic demo case.</p>
        </div>
      </div>

      <div className={`grid flex-1 content-start gap-4 ${compact ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
        <label className="space-y-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          Investor or fund
          <span className="relative block">
            <Users className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={investor}
              onChange={(event) => setInvestor(event.target.value)}
              placeholder="e.g. Mark Suster"
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </span>
        </label>

        <label className="space-y-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          Target company
          <span className="relative block">
            <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={targetCompany}
              onChange={(event) => setTargetCompany(event.target.value)}
              placeholder="e.g. 1upHealth"
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </span>
        </label>
      </div>

      <div className="mt-5">
        <Button
          type="button"
          onClick={handleRunCheck}
          disabled={!investor.trim() || !targetCompany.trim() || isLoading}
          className="h-12 w-full rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-white" />Checking relationships…</>
          ) : (
            <><Sparkles className="mr-2 h-4 w-4 text-indigo-300" />Run conflict check</>
          )}
        </Button>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-400">
          Results reflect relationships recorded in StartupForge and may not include undisclosed or unrecorded investments.
        </p>
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-800">Try synthetic demo scenarios</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={isLoading} onClick={() => onRunCheck('Jordan Lee (Demo Investor)', 'Northstar Care Systems')} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-50">
              Direct portfolio competitor <span className="mt-1 block text-[10px] font-normal text-slate-500">Harbor Health Analytics → Northstar Care Systems</span>
            </button>
            <button type="button" disabled={isLoading} onClick={() => onRunCheck('Jordan Lee (Demo Investor)', 'Cedarline Health')} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-50">
              Indirect ownership path <span className="mt-1 block text-[10px] font-normal text-slate-500">Summit Digital Holdings → Summit Care Networks → Cedarline Health</span>
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-indigo-800">These fictional examples demonstrate the graph logic and are not real diligence findings.</p>
        </div>
        <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-emerald-200 bg-white p-3">
            <img src="https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Berkshire-Hathaway-Logo.svg/960px-Berkshire-Hathaway-Logo.svg.png" alt="Berkshire Hathaway wordmark" className="h-10 w-24 shrink-0 object-contain" loading="lazy" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800">Berkshire Hathaway Inc.</p>
              <p className="text-[10px] text-slate-600">Institutional investor · NYSE: BRK.A / BRK.B · Omaha, Nebraska</p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Diversified holding company across insurance, energy, rail, manufacturing, services, and retail. Q2 2026 SEC 13F snapshot: 227.9M Apple shares, reported value $65.95B as of June 30 (filed Aug 14); not live holdings.</p>
              <p className="text-[10px] text-slate-500">Leadership as of Sep 2026: CEO Greg Abel; board chair Howard G. Buffett.</p>
              <a className="text-[10px] font-semibold text-emerald-800 underline" href="https://www.berkshirehathaway.com/news/sep1826.pdf" target="_blank" rel="noreferrer">Leadership source (Sep 2026)</a>
              <a className="text-[10px] font-semibold text-emerald-800 underline" href="https://www.berkshirehathaway.com/" target="_blank" rel="noreferrer">Official company profile</a>
            </div>
          </div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-900">Public-company screening examples</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={isLoading} onClick={() => onRunCheck('Berkshire Hathaway Inc. (Public Example)', 'Samsung Electronics Co., Ltd.')} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-50">
              Public holding + competitor <span className="mt-1 block text-[10px] font-normal text-slate-500"><img src="https://www.google.com/s2/favicons?domain=apple.com&sz=64" alt="Apple company mark" className="mr-1 inline h-4 w-4 align-middle" /> Berkshire → Apple → Samsung Electronics <img src="https://www.google.com/s2/favicons?domain=samsung.com&sz=64" alt="Samsung company mark" className="ml-1 inline h-4 w-4 align-middle" /></span>
            </button>
            <button type="button" disabled={isLoading} onClick={() => onRunCheck('Berkshire Hathaway Inc. (Public Example)', 'Bose Corporation')} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-50">
              Public ownership chain <span className="mt-1 block text-[10px] font-normal text-slate-500"><img src="https://www.google.com/s2/favicons?domain=apple.com&sz=64" alt="Apple company mark" className="mr-1 inline h-4 w-4 align-middle" /> Apple → Beats → Bose <img src="https://www.google.com/s2/favicons?domain=bose.com&sz=64" alt="Bose company mark" className="ml-1 inline h-4 w-4 align-middle" /></span>
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-emerald-900">Publicly documented relationships with source dates. Screening examples only: they do not establish an actual legal or investment conflict; verify current holdings, ownership, and market overlap.</p>
        </div>
      </div>
    </div>
  );
};

export default EntitySelectionPanel;
