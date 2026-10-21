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
          <p className="text-xs text-slate-500">Enter the actual investor and company to check.</p>
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
      </div>
    </div>
  );
};

export default EntitySelectionPanel;
