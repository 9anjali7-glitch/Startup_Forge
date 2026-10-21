import { useEffect, useState } from 'react';
import { Activity, BarChart3, Sparkles, TrendingUp } from 'lucide-react';
import { User } from '../App';

type PredictionResponse = {
  growth_rate: number;
  growth_class: string;
  valuation_projection: {
    '3_months': number;
    '6_months': number;
    '1_year': number;
    '5_years': number;
  };
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
        const response = await fetch(`${apiUrl}/api/founders/growth/${encodeURIComponent(user.id)}`, { signal: controller.signal });
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
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{error || 'Add a recorded funding amount and valuation to calculate a scenario.'}</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', notation: value >= 1_000_000 ? 'compact' : 'standard', maximumFractionDigits: 1,
  }).format(value);

  const projections: [string, keyof PredictionResponse['valuation_projection']][] = [
    ['3 months', '3_months'], ['6 months', '6_months'], ['1 year', '1_year'], ['5 years', '5_years'],
  ];

  return (
    <section className="relative mt-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-xl md:p-8" aria-labelledby="growth-scenario-title">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="relative z-10 grid gap-7 md:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/20 p-2"><Sparkles className="h-5 w-5 text-indigo-300" /></div>
            <h3 id="growth-scenario-title" className="text-xl font-bold">Illustrative Growth Scenario</h3>
          </div>
          <p className="mb-5 text-xs leading-relaxed text-slate-300">A simple extrapolation from recorded funding and valuation history. It is a scenario, not an AI forecast or a promise of future performance.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><TrendingUp className="h-4 w-4" />Annualized change</div>
              <div className="text-3xl font-extrabold text-emerald-300">{(prediction.growth_rate * 100).toFixed(1)}%</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><Activity className="h-4 w-4" />Rate band</div>
              <div className="text-2xl font-extrabold text-indigo-200">{prediction.growth_class}</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><BarChart3 className="h-4 w-4" />Illustrative valuation path</div>
          <div className="space-y-3">
            {projections.map(([label, key]) => (
              <div key={key} className="flex items-center justify-between gap-4 border-b border-white/5 pb-2 last:border-0">
                <span className="text-sm text-slate-300">{label}</span>
                <span className="font-mono text-sm font-bold text-emerald-300">{formatCurrency(prediction.valuation_projection[key])}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
