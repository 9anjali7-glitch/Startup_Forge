import React from 'react';
import { User } from '../../App';
import { ShieldCheck, Users, PieChart, ArrowUpRight } from 'lucide-react';

interface StatsPanelProps {
    currentUser: User;
    coiCompanyName: string;
    setCoiCompanyName: (val: string) => void;
    coiInvestorName: string;
    setCoiInvestorName: (val: string) => void;
    coiSuggestions: any[];
    showCoiSuggestions: boolean;
    setShowCoiSuggestions: (val: boolean) => void;
    onCheckConflict?: (investor: string, company: string) => void;
    // Find Investors
    isFindingInvestors: boolean;
    handleFindInvestors: () => void;
    // Invested Companies
    investedCompanies: any[];
}

export const StatsPanel = ({
    currentUser,
    coiCompanyName,
    setCoiCompanyName,
    coiInvestorName,
    setCoiInvestorName,
    coiSuggestions,
    showCoiSuggestions,
    setShowCoiSuggestions,
    onCheckConflict,
    isFindingInvestors,
    handleFindInvestors,
    investedCompanies
}: StatsPanelProps) => {

    return (
        <div className="flex flex-col gap-4 lg:gap-6 flex-shrink-0 min-w-0 w-full h-auto lg:h-full lg:overflow-y-auto custom-scrollbar lg:pr-1 lg:flex-[20]">
            {/* Conflict (Flex 3 -> ~30%) to fit inputs */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex-shrink-0 flex flex-col relative z-40">
                <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                    <h3 className="font-bold text-gray-800 text-base"><b>Conflict of Interest</b></h3>
                </div>

                <div className="flex flex-col gap-3 flex-1 justify-center pt-2">
                    {currentUser.role !== 'investor' && <input
                        type="text"
                        placeholder="Investor or fund name"
                        value={coiInvestorName}
                        onChange={(e) => setCoiInvestorName(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-slate-400 outline-none transition-all placeholder:text-gray-400"
                    />}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder={currentUser.role === 'investor' ? 'Company to screen' : 'Your company to screen'}
                            value={coiCompanyName}
                            onChange={(e) => {
                                setCoiCompanyName(e.target.value);
                                setShowCoiSuggestions(true);
                            }}
                            onFocus={() => setShowCoiSuggestions(true)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-slate-400 outline-none transition-all placeholder:text-gray-400"
                        />
                        {showCoiSuggestions && coiSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-[60] overflow-hidden">
                                {coiSuggestions.map((s, idx) => (
                                    <div
                                        key={idx}
                                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 truncate"
                                        onClick={() => {
                                            setCoiCompanyName(s.name);
                                            setShowCoiSuggestions(false);
                                        }}
                                    >
                                        {s.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        disabled={!coiCompanyName.trim() || (currentUser.role !== 'investor' && !coiInvestorName.trim())}
                        onClick={() => onCheckConflict?.(currentUser.role === 'investor' ? currentUser.name : coiInvestorName.trim(), coiCompanyName.trim())}
                        className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold py-3 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                        Check Conflict <ShieldCheck className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Find Investors (Flex 3.5 -> ~35%) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 lg:p-6 flex flex-col relative overflow-hidden group z-10 flex-shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-slate-200 transition-colors"></div>

                <div className="relative flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-slate-800" />
                        <h3 className="font-bold text-gray-900 text-lg"><b>Find Investors Like Me</b></h3>
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center text-center">
                        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                            Browse investor profiles. Personalized fit requires verified sector and stage mandates.
                        </p>

                        <button
                            onClick={handleFindInvestors}
                            disabled={isFindingInvestors}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group-hover:scale-[1.02] disabled:opacity-70 disabled:cursor-wait"
                        >
                            {isFindingInvestors ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    Finding...
                                </>
                            ) : (
                                <>
                                    Browse Investors <ArrowUpRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Matched Investment Activity */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col relative z-10 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                    <PieChart className="w-4 h-4 text-slate-800" />
                    <h3 className="font-bold text-gray-800 text-base">Matched Investment Activity</h3>
                </div>
                <p className="mb-3 text-xs leading-relaxed text-slate-500">Deals appear here after both sides submit matching round, amount, and year details.</p>
                {investedCompanies.length ? (
                    <div className="space-y-2">
                        {investedCompanies.slice(0, 5).map((deal, index) => (
                            <div key={deal.founder_id || `${deal.company}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-sm font-bold text-slate-800">{deal.company || 'Company name not provided'}</span>
                                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">{deal.round || 'Round not provided'}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                    <span>Reported amount: {deal.amount || 'Not provided'}</span>
                                    <span>{deal.year || 'Year not provided'}</span>
                                </div>
                            </div>
                        ))}
                        {investedCompanies.length > 5 && <p className="text-right text-[10px] font-medium text-slate-500">+{investedCompanies.length - 5} more matched deals</p>}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
                        <p className="text-sm font-semibold text-slate-700">No matched deals yet</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">Confirmed details from your connected investors and founders will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
