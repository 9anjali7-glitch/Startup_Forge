import React from 'react';
import { Users, TrendingUp, ShieldCheck } from 'lucide-react';
import { MarketIntelligence } from './MarketIntelligence';

// Using 'any' for simplicity matching HomePage types, but ideally use interfaces
interface FeedPanelProps {
    topFounders: any[];
    onNavigate: (page: string, userId?: string) => void;
}

export const FeedPanel = ({ topFounders, onNavigate }: FeedPanelProps) => {
    return (
        <div style={{ flex: 54 }} className="flex flex-col gap-6 flex-shrink-0 min-w-0 h-full">
            {/* Top: Founders */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
                <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-white flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-700" />
                        <h3 className="text-xl font-black tracking-tight text-slate-800">
                            <b>  Top Rising Founders</b>
                        </h3>
                    </div>
                    <button type="button" onClick={() => onNavigate('network')} className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 hover:underline">View all founders</button>
                </div>
                <div className="p-4 overflow-y-auto flex-1 h-full bg-gray-50/20 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                    {topFounders.map((founder, i) => (
                        <button type="button" key={founder.id || i} onClick={() => onNavigate('profile', founder.id)} className="w-full text-left flex flex-col sm:flex-row gap-4 p-4 bg-white hover:bg-slate-50 rounded-2xl border border-gray-100 hover:border-slate-200 shadow-sm hover:shadow-soft transition-all cursor-pointer group">
                            {/* Avatar & Basic Info */}
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                {founder.avatar ? (
                                    <img src={founder.avatar} alt={founder.name || 'Founder'} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-sm" />
                                ) : (
                                    <div aria-hidden="true" className="w-14 h-14 rounded-2xl bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center font-bold text-slate-500">{String(founder.name || '?').charAt(0).toUpperCase()}</div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="font-bold text-gray-900 text-base truncate pr-2">{founder.name}</h4>
                                        {Number.isFinite(Number(founder.valuation)) && Number(founder.valuation) > 0 && <span className="shrink-0 text-[10px] font-bold text-white bg-green-700 px-2 py-0.5 rounded-full shadow-sm">${(Number(founder.valuation) / 1000000).toFixed(1)}M</span>}
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

            <div className="flex-1 min-h-0"><MarketIntelligence compact /></div>
        </div>
    );
};
