import React from 'react';
import { Users, TrendingUp, ShieldCheck } from 'lucide-react';

interface FoundersPanelProps {
    topFounders: any[];
    onNavigate: (page: string, userId?: string) => void;
    loading?: boolean;
    error?: string | null;
    onRetry?: () => void;
}

export const FoundersPanel = ({ topFounders, onNavigate, loading = false, error, onRetry }: FoundersPanelProps) => {
    return (
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
            <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-white flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-700" />
                    <h3 className="text-xl font-black tracking-tight text-slate-800">
                        <b>Top Founder Profiles</b>
                    </h3>
                </div>
                <button type="button" onClick={() => onNavigate('network')} className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">View all founders</button>
            </div>
            <p className="px-5 pt-2 text-[10px] text-slate-500">Profiles ordered by valuation recorded in the database; amounts and profile details are not independently verified.</p>
            <div className="p-4 overflow-y-auto flex-1 h-full bg-gray-50/20 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                {loading && <div role="status" className="col-span-full rounded-xl border border-slate-100 bg-white p-5 text-sm text-slate-500">Loading founder profiles…</div>}
                {!loading && error && <div role="alert" className="col-span-full rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><p>{error}</p><button type="button" onClick={onRetry} className="mt-2 font-bold underline">Try again</button></div>}
                {!loading && !error && topFounders.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">No founder profiles with valuation data are available yet. Use “View all founders” to browse the network.</div>}
                {!loading && !error && topFounders.map((founder, i) => (
                    <button type="button" key={founder.id || i} onClick={() => onNavigate('profile', String(founder.id))} aria-label={`View ${founder.name || founder.company} profile`} className="w-full text-left flex flex-col sm:flex-row gap-4 p-4 bg-white hover:bg-slate-50 rounded-2xl border border-gray-100 hover:border-slate-200 shadow-sm hover:shadow-soft transition-all cursor-pointer group">
                        {/* Avatar & Basic Info */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div aria-hidden="true" className="w-14 h-14 rounded-2xl bg-indigo-50 border-2 border-white shadow-sm flex items-center justify-center text-lg font-bold text-indigo-700">{String(founder.name || founder.company || '?').charAt(0).toUpperCase()}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="font-bold text-gray-900 text-base truncate pr-2">{founder.name}</h4>
                                    <span className="shrink-0 text-[10px] font-bold text-white bg-green-700 px-2 py-0.5 rounded-full shadow-sm">
                                        Reported ${(Number(founder.valuation) / 1000000).toFixed(1)}M
                                    </span>
                                </div>
                                <p className="text-sm font-semibold text-teal-700">{founder.company}</p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-md">
                                        <TrendingUp className="w-3 h-3 text-gray-400" />
                                        {founder.round} • {founder.year}
                                    </span>
                                    {founder.umbrella && (
                                        <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-md truncate max-w-[150px]">
                                            <ShieldCheck className="w-3 h-3 text-gray-400" />
                                            {founder.umbrella}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
