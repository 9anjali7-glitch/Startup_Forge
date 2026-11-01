import { useEffect, useState } from 'react';
import { Activity, BarChart3, Sparkles, TrendingUp } from 'lucide-react';
import { User } from '../App';
import { apiFetch } from '../apiFetch';

type PredictionResponse = {
  annualized_change: number | null;
  trend: string;
  basis: string;
  as_of: string;
  observations: { round: string; year: number; amount: number }[];
};

export const GrowthPredictionSection = ({ user }: { user: User }) => {
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user.role !== 'founder') {
      setPrediction(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const fetchScenario = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!user.id) throw new Error('A saved founder record is needed to calculate this scenario.');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await apiFetch(`${apiUrl}/api/founders/growth/${encodeURIComponent(user.id)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Recorded funding data is not sufficient for a scenario yet.');
        setPrediction(data);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setPrediction(null);
        setError(cause instanceof Error ? cause.message : 'Growth scenario is unavailable right now.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchScenario();
    return () => controller.abort();
  }, [user.id, user.role]);

  if (user.role !== 'founder') return null;

  if (loading) {
    return <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Calculating a scenario from recorded funding history…</div>;
  }

  if (!prediction) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <h3 className="font-bold text-slate-800">Growth scenario unavailable</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{error || 'Add at least two dated funding rounds with numeric amounts to calculate an observed funding trend.'}</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', notation: value >= 1_000_000 ? 'compact' : 'standard', maximumFractionDigits: 1,
  }).format(value);

  return (
    <section className="relative mt-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-xl md:p-8" aria-labelledby="growth-scenario-title">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="relative z-10 grid gap-7 md:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/20 p-2"><Sparkles className="h-5 w-5 text-indigo-300" /></div>
            <h3 id="growth-scenario-title" className="text-xl font-bold">Recorded Funding Trend</h3>
          </div>
          <p className="mb-5 text-xs leading-relaxed text-slate-300">Uses dated funding-round amounts in the saved profile; those entries are not independently verified. Round sizes do not measure revenue or company valuation.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><TrendingUp className="h-4 w-4" />Annual change in round size</div>
              <div className="text-3xl font-extrabold text-emerald-300">{prediction.annualized_change === null ? '—' : `${(prediction.annualized_change * 100).toFixed(1)}%`}</div>
              {prediction.annualized_change === null && <p className="mt-1 text-[10px] text-slate-400">A second dated round is needed.</p>}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><Activity className="h-4 w-4" />Observed direction</div>
              <div className="text-xl font-extrabold text-indigo-200">{prediction.trend}</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><BarChart3 className="h-4 w-4" />Recorded round amounts</div>
          <div className="space-y-3">
            {prediction.observations.map((round, index) => (
              <div key={`${round.year}-${index}`} className="flex items-center justify-between gap-4 border-b border-white/5 pb-2 last:border-0">
                <span className="text-sm text-slate-300">{round.round} · {round.year}</span>
                <span className="font-mono text-sm font-bold text-emerald-300">{formatCurrency(round.amount)}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] leading-relaxed text-slate-400">{prediction.basis}</p>
        </div>
      </div>
    </section>
  );
};
