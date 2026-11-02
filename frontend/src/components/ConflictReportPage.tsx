// Enhanced UI - v2.0 - Vibrant Colors Applied - 00:46
import React, { useState, useEffect } from "react";
import { User } from '../App';
import { apiFetch } from '../apiFetch';
import { SearchResultsDropdown } from './SearchResultsDropdown';
// New Components
import EntitySelectionPanel from "@/components/coi/EntitySelectionPanel";
import RiskOverviewCard from "@/components/coi/RiskOverviewCard";
import RelationshipGraph from "@/components/coi/RelationshipGraph";
import ConflictExplanationPanel from "@/components/coi/ConflictExplanationPanel";
import ComplianceActions from "@/components/coi/ComplianceActions";

// UI Components
import { Users, Bell, MessageSquare, X, BrainCircuit, Sparkles, ShieldCheck, Clock, Target, CheckCircle2, Building2, Home, Search } from 'lucide-react';
import { MobileChatOverlay } from './common/MobileChatOverlay';
import { toast } from "sonner";
import { useUnreadBadges } from '../useUnreadBadges';

interface ConflictReportPageProps {
    currentUser: User;
    onNavigate: (page: string, userId?: string) => void;
    onSearch: (query: string) => void;
    onQueryChange?: (query: string) => void;
    ragResults?: {
        founders: any[];
        investors: any[];
    };
    isSearching?: boolean;
    onBack: () => void;
    currentInvestorName?: string;
    targetCompanyName?: string;
}

const ConflictReportPage = ({
    currentUser,
    onNavigate,
    onSearch,
    onQueryChange,
    ragResults,
    isSearching,
    // onBack, - unused
    currentInvestorName,
    targetCompanyName
}: ConflictReportPageProps) => {
    const { unreadAlerts, unreadInbox } = useUnreadBadges(String(currentUser?.id || ''));
    // --- Header State (for consistency with HomePage) ---
    const [searchQuery, setSearchQuery] = useState('');
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false); // Mobile search

    // --- COI Logic State ---
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [conflictData, setConflictData] = useState<any>(null);
    const [hasResults, setHasResults] = useState(false);
    const [selectedInvestor, setSelectedInvestor] = useState(currentInvestorName || "");
    const [selectedTarget, setSelectedTarget] = useState(targetCompanyName || "");

    // Close search when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (isSearchExpanded && !target.closest('.search-container')) {
                setIsSearchExpanded(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSearchExpanded]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(searchQuery);
        setIsSearchExpanded(false);
    };

    const handleRunCheck = async (investor: string, target: string) => {
        setIsAnalyzing(true);
        setHasResults(false);
        setSelectedInvestor(investor);
        setSelectedTarget(target);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const res = await apiFetch(`${apiUrl}/api/coi/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    investorName: investor,
                    targetCompany: target
                })
            });
            const data = await res.json();
            if (!res.ok || data?.error) {
                throw new Error(data?.error || `Conflict check failed (${res.status})`);
            }
            setConflictData(data);
            setHasResults(true);
            toast.success(data.hasConflict ? "Potential conflict path found" : "Screening complete", { description: data.hasConflict ? "Review the recorded relationships and evidence." : "No direct or indirect path was found in the recorded graph." });
        } catch (err) {
            console.error("COI Analysis Failed", err);
            toast.error("Analysis Failed", { description: err instanceof Error ? err.message : "Could not connect to the analysis engine." });
            setConflictData(null);
        } finally {
            // Minimum loading time for UX
            setTimeout(() => setIsAnalyzing(false), 1200);
        }
    };

    // Auto-run analysis if investor is pre-selected
    useEffect(() => {
        if (currentInvestorName && targetCompanyName) {
            handleRunCheck(currentInvestorName, targetCompanyName);
        }
    }, [currentInvestorName, targetCompanyName]);

    // Helpers to extract display data
    const currentLevel = conflictData?.conflictLevel || 0;
    // hasConflict - unused

    // --- Level 1 Data (Sector Overlap) ---
    const isLevel1 = currentLevel === 1;
    const level1Companies = isLevel1 ? (conflictData.conflictingCompanies || []) : [];
    const level1Tags = isLevel1 ? level1Companies : [];

    // --- Level 2 Data (Subsidiary/Competitor) ---
    const isLevel2 = currentLevel === 2;
    const level2Details = isLevel2 ? (conflictData.conflicts || []) : [];
    const level2Tags = isLevel2 ? [...new Set(level2Details.flatMap((c: any) => [c.investedParent, c.competingSubsidiary]))] : [];

    // --- Calculate Score ---
    // riskScore unused

    // --- Normalize Data for Explanation Panel ---
    let explanationConflicts: any[] = [];
    if (isLevel2) {
        explanationConflicts = level2Details.map((c: any) => ({
            level: 2,
            severity: "high",
            path: [selectedInvestor, c.investedParent, c.competingSubsidiary, selectedTarget],
            reason: `The investor backed ${c.investedParent}, which owns ${c.competingSubsidiary}; that subsidiary is listed as competing with ${selectedTarget}. This indirect link may need review, but it does not by itself prove wrongdoing or a legal conflict.`
        }));
    } else if (isLevel1) {
        explanationConflicts = level1Companies.map((name: string) => ({
            level: 1,
            severity: conflictData?.conflictType?.includes("sector") ? "medium" : "high",
            path: [selectedInvestor, name, selectedTarget],
            reason: conflictData?.conflictType?.includes("sector")
                ? `The investor backed ${name}, and it shares the ${conflictData?.sector || "same"} sector with ${selectedTarget}. Sharing a sector is only a reason to look closer; it does not mean the companies directly compete.`
                : `The investor backed ${name}, which is listed as a competitor to ${selectedTarget}. That creates a potential overlap worth reviewing; it does not by itself prove wrongdoing or a legal conflict.`
        }));
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
            {/* --- Responsive Header (Copied from HomePage) --- */}
            <div className="sticky top-0 bg-white px-4 md:px-8 py-3 md:py-6 shadow-sm border-b border-slate-100 z-50 flex-shrink-0">
                <div className="flex items-center justify-between gap-4 w-full h-14 md:h-24">

                    {/* Desktop Profile */}
                    <button
                        onClick={() => setShowProfileModal(true)}
                        className="hidden md:flex items-center gap-4 hover:bg-slate-50 p-2 rounded-xl transition-all group flex-shrink-0 min-w-52"
                    >
                        <div className="relative">
                            <img
                                src={currentUser.avatar}
                                alt={currentUser.name}
                                className="w-14 h-14 rounded-full border-2 border-gray-100 group-hover:border-slate-300 transition-colors object-cover"
                            />
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-lg font-bold text-gray-900 leading-tight group-hover:text-slate-800"><b>{currentUser.name}</b></span>
                            <span className="text-xs text-gray-500 font-medium"><b>View Profile</b></span>
                        </div>
                    </button>

                    <button
                        onClick={() => setShowProfileModal(true)}
                        className="md:hidden flex-shrink-0"
                    >
                        <img src={currentUser.avatar} className="w-8 h-8 rounded-full border border-gray-200" />
                    </button>

                    {/* Search */}
                    <div className="flex-1 flex justify-center max-w-3xl px-0 md:px-8 relative">
                        <form onSubmit={handleSearchSubmit} className="relative w-full group search-container">
                            {/* Mobile Search Icon Trigger */}
                            <div className={`md:hidden ${isSearchExpanded ? 'hidden' : 'flex'} justify-end w-full`} >
                                <button type="button" onClick={() => setIsSearchExpanded(true)} className="p-2.5 bg-slate-100 rounded-full text-slate-600">
                                    <Sparkles className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Input field */}
                            <div className={`${isSearchExpanded ? 'flex' : 'hidden md:block'} relative w-full`}>
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                    <div className="bg-slate-800 p-1.5 md:p-2 rounded-xl">
                                        <Sparkles className="h-3 w-3 md:h-5 md:w-5 text-white animate-pulse" />
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 md:pl-20 md:pr-20 py-2.5 md:py-4 bg-slate-900 border border-slate-700 focus:border-slate-500 focus:ring-4 focus:ring-slate-800 rounded-xl md:rounded-2xl text-xs md:text-base transition-all placeholder-white font-medium outline-none shadow-sm text-white hover:shadow-md hover:border-slate-600 relative z-50"
                                    placeholder="Ask anything..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        if (onQueryChange) onQueryChange(e.target.value);
                                    }}
                                    autoFocus={isSearchExpanded}
                                />
                                {/* Close Button Mobile */}
                                {isSearchExpanded && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setIsSearchExpanded(false); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-slate-700 rounded-full text-white md:hidden z-50"
                                    >
                                        <span className="text-xs">✕</span>
                                    </button>
                                )}

                                <div className="hidden md:flex absolute inset-y-0 right-4 items-center pointer-events-none z-50">
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-300 text-xs">|</span>
                                        <kbd className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 border border-slate-600 border-b-2 rounded-lg text-[10px] font-bold text-slate-300 tracking-wider">
                                            ⌘ K
                                        </kbd>
                                    </div>
                                </div>
                            </div>
                        </form>

                        {/* RAG Search Results Dropdown */}
                        {searchQuery.length >= 2 && ragResults && (
                            <div className="absolute top-full left-8 right-8 z-[100] shadow-2xl rounded-xl">
                                <SearchResultsDropdown
                                    results={ragResults}
                                    isVisible={true}
                                    isLoading={isSearching || false}
                                    onSelectResult={(id) => onNavigate('profile', id)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Desktop Nav Icons */}
                    <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
                        <ActionItem icon={<Home />} label="Home" onClick={() => onNavigate('home')} />
                        <ActionItem icon={<Users />} label="Network" onClick={() => onNavigate('network')} />
                        <ActionItem icon={<Bell />} label="Alerts" badge={unreadAlerts > 0} onClick={() => onNavigate('notifications')} />
                        <ActionItem icon={<MessageSquare />} label="Inbox" badge={unreadInbox > 0} onClick={() => onNavigate('messages')} />
                        <ActionItem icon={<BrainCircuit />} label="Deep Analysis" onClick={() => onNavigate('conflict-report')} active={true} />
                    </div>
                </div>
            </div>

            {/* --- Main Content Area --- */}
            <main
                className="flex-1 w-full overflow-y-auto p-4 pb-20 md:pb-4"
                style={{
                    background: 'linear-gradient(to bottom right, rgb(248 250 252), rgb(238 242 255 / 0.2), rgb(248 250 252))'
                }}
            >
                <div className="w-full max-w-[1800px] mx-auto min-h-full flex flex-col gap-4">

                    {/* Header Row */}
                    <div className="w-full flex items-center justify-between flex-shrink-0 pb-1">
                        <div>
                            <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                                <div className="p-2 md:p-3 bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 rounded-2xl shadow-xl shadow-indigo-500/40 ring-2 ring-indigo-100 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-white relative z-10" />
                                </div>
                                <b>Institutional Conflict Check</b>
                            </h2>
                            <p className="text-xs md:text-sm text-slate-600 font-semibold mt-1 ml-12 md:ml-14 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                <b>Graph-based screening of recorded relationships</b>
                            </p>
                        </div>
                        <div className="hidden md:flex items-center gap-3">
                            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-white to-indigo-50/50 rounded-xl border border-indigo-200/60 shadow-md text-slate-700 font-semibold text-xs hover:shadow-lg transition-shadow">
                                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                        </div>
                    </div>

                    {/* Dashboard Layout */}
                    <div className="flex flex-col gap-4 pb-16 max-w-[1600px] mx-auto w-full">

                        {/* ROW 1: Selection & Details */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Left: Entity Selection */}
                            <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white h-auto lg:h-full flex flex-col">
                                {/* Header with Solid Navy Background */}
                                <div className="bg-slate-900 px-4 py-3 flex items-center gap-2.5">
                                    <div className="bg-white/10 p-2 rounded-lg border border-white/20 backdrop-blur-sm">
                                        <Search className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white leading-tight"><b>Entity Selection</b></h3>
                                        <p className="text-xs text-slate-300 font-medium"><b>Configure conflict parameters</b></p>
                                    </div>
                                </div>
                                <div className="flex-1 p-4 bg-slate-50">
                                    <EntitySelectionPanel
                                        onRunCheck={handleRunCheck}
                                        isLoading={isAnalyzing}
                                        preselectedInvestor={selectedInvestor}
                                        preselectedTarget={selectedTarget}
                                        compact={true}
                                    />
                                </div>
                            </div>

                            {/* Right: Current Analysis Details */}
                            <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white h-auto lg:h-full flex flex-col">
                                {/* Header with Solid Navy Background */}
                                <div className="bg-slate-900 px-4 py-3 flex items-center gap-2.5">
                                    <div className="bg-white/10 p-2 rounded-lg border border-white/20 backdrop-blur-sm">
                                        <Building2 className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white leading-tight"><b>Analysis Scope</b></h3>
                                        <p className="text-xs text-slate-300 font-medium"><b>Entities under review</b></p>
                                    </div>
                                </div>

                                <div className="flex-1 p-4 bg-slate-50 flex flex-col gap-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Primary Investor Card */}
                                        <div className="min-h-[100px] p-3 bg-white rounded-lg border border-slate-200 flex flex-col justify-center hover:border-indigo-300 hover:shadow-md transition-all group">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <div className="p-1 bg-indigo-50 rounded text-indigo-600 border border-indigo-100">
                                                    <Users className="w-3 h-3" />
                                                </div>
                                                <b>Primary Investor</b>
                                            </span>
                                            <div className="font-black text-slate-900 text-lg leading-tight line-clamp-2 pl-1">
                                                {selectedInvestor || <span className="text-slate-400 italic font-medium text-sm"><b>Not Selected</b></span>}
                                            </div>
                                        </div>

                                        {/* Target Company Card */}
                                        <div className="min-h-[100px] p-3 bg-white rounded-lg border border-slate-200 flex flex-col justify-center hover:border-emerald-300 hover:shadow-md transition-all group">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <div className="p-1 bg-emerald-50 rounded text-emerald-600 border border-emerald-100">
                                                    <Target className="w-3 h-3" />
                                                </div>
                                                <b>Target Company</b>
                                            </span>
                                            <div className="font-black text-slate-900 text-lg leading-tight line-clamp-2 pl-1">
                                                {selectedTarget || <span className="text-slate-400 italic font-medium text-sm"><b>Not Selected</b></span>}
                                            </div>
                                        </div>
                                    </div>

                                    {conflictData?.dataClassification === "synthetic demo fixture" && (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                            <strong>Synthetic demo data.</strong> This relationship path is seeded for demonstration and is not a real-world investment or diligence finding.
                                        </div>
                                    )}
                                    {conflictData?.dataClassification === "public-source screening path" && (
                                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                                            <strong>Public-source screening example.</strong> This is a potential screening path, not a finding of an actual legal or investment conflict. Source dates and scope matter; verify current status before relying on it.
                                            <ul className="mt-2 list-disc space-y-1 pl-4">
                                                <li><a className="underline" href="https://www.sec.gov/Archives/edgar/data/1067983/000119312526352200/0001193125-26-352200-index.htm" target="_blank" rel="noreferrer">Berkshire Q2 2026 Form 13F-HR (filed Aug 14, 2026)</a></li>
                                                {selectedTarget === 'Samsung Electronics Co., Ltd.' ? <li><a className="underline" href="https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0312/2026031200834.pdf" target="_blank" rel="noreferrer">Samsung filing on phone competitors (2026)</a></li> : <><li><a className="underline" href="https://www.apple.com/gr/newsroom/2014/05/28Apple-to-Acquire-Beats-Music-Beats-Electronics/" target="_blank" rel="noreferrer">Apple acquisition announcement (2014)</a></li><li><a className="underline" href="https://ec.europa.eu/competition/mergers/cases/decisions/m7290_20140725_20310_3804651_EN.pdf" target="_blank" rel="noreferrer">European Commission headphone market decision (2014)</a></li></>}
                                            </ul>
                                        </div>
                                    )}

                                    <div>
                                        {hasResults ? (
                                            <div className="flex items-center gap-3 px-3 py-2.5 bg-emerald-50 rounded-lg border border-emerald-200 shadow-sm">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-600 border border-emerald-200">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-bold tracking-tight ${conflictData?.hasConflict ? "text-amber-900" : "text-emerald-900"}`}><b>{conflictData?.hasConflict ? "Potential conflict path found" : "Screen complete — no recorded path found"}</b></span>
                                                    <span className="text-[10px] font-semibold text-emerald-600/70">
                                                        Finalized {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3 px-3 py-2.5 bg-white rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-indigo-300 hover:bg-slate-50 transition-all group">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400 group-hover:text-indigo-500 transition-colors">
                                                    <Clock className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600 transition-colors uppercase tracking-wide">Ready to Analyze</span>
                                                    <span className="text-[10px] font-medium text-slate-400">Waiting for selection</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ROW 2: Relationship Graph */}
                        <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white min-h-[450px] md:min-h-[550px] flex flex-col">
                            {/* Header with Solid Navy Background */}
                            <div className="bg-slate-900 px-4 py-3 flex items-center gap-2.5">
                                <div className="bg-white/10 p-2 rounded-lg border border-white/20 backdrop-blur-sm">
                                    <BrainCircuit className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white leading-tight"><b>Relationship Graph</b></h3>
                                    <p className="text-xs text-slate-300 font-medium"><b>Visualizing connections between entities</b></p>
                                </div>
                            </div>
                            {hasResults ? (
                                <div className="flex-1 w-full h-full relative z-10">
                                    <RelationshipGraph
                                        investorName={selectedInvestor}
                                        targetCompany={selectedTarget}
                                        conflictLevel={currentLevel}
                                        conflicts={level2Details}
                                        level1Companies={level1Companies}
                                        conflictType={conflictData?.conflictType}
                                        graph={conflictData?.graph}
                                    />
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center flex-col text-slate-400 bg-slate-50/50 rounded-2xl m-2 border-2 border-dashed border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all group">
                                    <div className="p-6 bg-white rounded-2xl shadow-sm mb-4 group-hover:shadow-md transition-shadow">
                                        <BrainCircuit className="w-14 h-14 text-slate-300 group-hover:text-indigo-300 transition-colors" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-500 group-hover:text-slate-700 transition-colors"> Run analysis to generate relationship graph</p>
                                    <p className="text-xs text-slate-400 mt-1"><b>Visualize connections and conflicts</b></p>
                                </div>
                            )}
                        </div>

                        {/* ROW 3: Risk Summary Section */}
                        <div className="flex flex-col gap-4 mt-1">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                                <div className="p-3 bg-gradient-to-br from-rose-600 via-rose-500 to-orange-600 rounded-2xl shadow-xl shadow-rose-500/40 ring-2 ring-rose-100 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <ShieldCheck className="w-4 h-4 text-white relative z-10" />
                                </div>
                                <b>Conflict Risk Assessment</b>
                            </h3>

                            {/* Inner Grid for Risk Levels */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col h-full w-full">
                                    {hasResults ? (
                                        <RiskOverviewCard
                                            level={1}
                                            hasConflict={isLevel1}
                                            riskScore={isLevel1 ? (conflictData?.score ?? 45) : 0}
                                            relationships={level1Tags}
                                            description={isLevel1 ? (conflictData?.reason || "Direct portfolio overlap.") : "No direct conflict."}
                                            conflictType={conflictData?.conflictType}
                                            className="h-full shadow-sm hover:shadow-md transition-shadow"
                                        />
                                    ) : (
                                        <div className="h-full min-h-[260px] bg-gradient-to-br from-blue-50 via-indigo-50/50 to-white border-2 border-dashed border-indigo-200 rounded-[2rem] flex flex-col items-center justify-center text-slate-400 gap-4 transition-all hover:border-indigo-300 hover:from-indigo-100/60 hover:to-indigo-50/30 hover:shadow-lg group">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 border-2 border-indigo-200 flex items-center justify-center shadow-md group-hover:shadow-xl group-hover:scale-110 transition-all">
                                                <Users className="w-8 h-8 text-indigo-600 group-hover:text-indigo-700 transition-colors" />
                                            </div>
                                            <div className="text-center">
                                                <span className="text-xs font-black uppercase tracking-wider text-indigo-700 block mb-1"><b>Level 1 Check</b></span>
                                                <span className="text-xs font-semibold text-indigo-500/80"><b>Direct Portfolio Overlap</b></span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col h-full w-full">
                                    {hasResults ? (
                                        <RiskOverviewCard
                                            level={2}
                                            hasConflict={isLevel2}
                                            riskScore={isLevel2 ? (conflictData?.score ?? 85) : 0}
                                            relationships={level2Tags}
                                            description={isLevel2 ? (conflictData?.reason || "Indirect subsidiary/competitor.") : "No indirect conflict."}
                                            className="h-full shadow-sm hover:shadow-md transition-shadow"
                                        />
                                    ) : (
                                        <div className="h-full min-h-[260px] bg-gradient-to-br from-purple-50 via-violet-50/50 to-white border-2 border-dashed border-purple-200 rounded-[2rem] flex flex-col items-center justify-center text-slate-400 gap-4 transition-all hover:border-purple-300 hover:from-purple-100/60 hover:to-purple-50/30 hover:shadow-lg group">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-violet-100 border-2 border-purple-200 flex items-center justify-center shadow-md group-hover:shadow-xl group-hover:scale-110 transition-all">
                                                <BrainCircuit className="w-8 h-8 text-purple-600 group-hover:text-purple-700 transition-colors" />
                                            </div>
                                            <div className="text-center">
                                                <span className="text-xs font-black uppercase tracking-wider text-purple-700 block mb-1"><b>Level 2 Check</b></span>
                                                <span className="text-xs font-semibold text-purple-500/80"><b>Deep Subsidiary Analysis</b></span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ROW 4: Conflict Explanation */}
                        <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white mt-4">
                            {/* Header */}
                            <div className="bg-slate-900 px-4 py-3 flex items-center gap-2.5">
                                <div className="bg-white/10 p-2 rounded-lg border border-white/20 backdrop-blur-sm">
                                    <MessageSquare className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white leading-tight"><b>Detailed Explanation</b></h3>
                                    <p className="text-xs text-slate-300 font-medium"><b>Plain-english breakdown of findings</b></p>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50">
                                {hasResults ? (
                                    <ConflictExplanationPanel
                                        conflicts={explanationConflicts}
                                        hideHeader={true}
                                        className="shadow-sm border border-slate-200 rounded-lg bg-white"
                                    />
                                ) : (
                                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl min-h-[220px] flex flex-col items-center justify-center text-slate-400 gap-3 group hover:border-blue-300 transition-colors">
                                        <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                                            <MessageSquare className="w-6 h-6 text-blue-500" />
                                        </div>
                                        <div className="text-center px-8">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1"><b>Explanation Pending</b></span>
                                            <span className="text-xs font-medium text-slate-400"><b>Run analysis to view details</b></span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ROW 5: Compliance Actions */}
                        <div className="rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white mt-4 mb-8">
                            {/* Header */}
                            <div className="bg-slate-900 px-4 py-3 flex items-center gap-2.5">
                                <div className="bg-white/10 p-2 rounded-lg border border-white/20 backdrop-blur-sm">
                                    <ShieldCheck className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white leading-tight"><b>Compliance Actions</b></h3>
                                    <p className="text-xs text-slate-300 font-medium"><b>Recommended next steps</b></p>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50">
                                {hasResults ? (
                                    <ComplianceActions
                                        reportData={conflictData}
                                        fileNamePrefix={`COI_${selectedInvestor}_${selectedTarget}`}
                                        hideHeader={true}
                                        className="shadow-sm border border-slate-200 rounded-lg bg-white"
                                    />
                                ) : (
                                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl min-h-[180px] flex flex-col items-center justify-center text-slate-400 gap-3 group hover:border-emerald-300 transition-colors">
                                        <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                            <ShieldCheck className="w-6 h-6 text-emerald-500" />
                                        </div>
                                        <div className="text-center px-8">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1"><b>Actions Unavailable</b></span>
                                            <span className="text-xs font-medium text-slate-400"><b>Analysis required</b></span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </main>

            {/* --- Mobile Bottom Nav --- */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 z-[80] flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.02)] safe-area-pb">
                <ActionItem icon={<Home />} label="Home" onClick={() => onNavigate('home')} />
                <ActionItem icon={<Users className="w-6 h-6" />} label="Network" onClick={() => onNavigate('network')} />
                <ActionItem icon={<BrainCircuit className="w-6 h-6" />} label="Analyze" onClick={() => onNavigate('conflict-report')} active={true} />
                <ActionItem icon={<Bell className="w-6 h-6" />} label="Alerts" badge={unreadAlerts > 0} onClick={() => onNavigate('notifications')} />
                <ActionItem icon={<MessageSquare className="w-6 h-6" />} label="Inbox" badge={unreadInbox > 0} onClick={() => onNavigate('messages')} />
            </div>

            <MobileChatOverlay currentUser={currentUser} />

            {/* --- Profile Modal --- */}
            {showProfileModal && (
                <ProfileModal
                    currentUser={currentUser}
                    onClose={() => setShowProfileModal(false)}
                    onNavigate={onNavigate}
                />
            )}
        </div>
    );
};

// Sub-components (Copied from HomePage for consistency)
function ActionItem({ icon, label, onClick, badge, active }: { icon: any, label: string, onClick: () => void, badge?: boolean, active?: boolean }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center gap-1.5 p-1.5 md:p-2 rounded-2xl transition-all duration-300 group min-w-16 md:min-w-20 relative ${active ? 'bg-indigo-50/80' : 'hover:bg-slate-50'}`}
        >
            <div className={`relative transform transition-transform duration-300 ${active ? 'scale-105' : 'group-hover:scale-110'}`}>
                <div className={`p-1.5 rounded-xl transition-colors duration-300 ${active ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 group-hover:text-slate-700 bg-transparent'}`}>
                    {React.cloneElement(icon, {
                        strokeWidth: active ? 2.5 : 2,
                        className: "w-5 h-5 md:w-6 md:h-6"
                    })}
                </div>
                {badge && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white shadow-sm animate-pulse"></span>}
            </div>
            <span className={`text-[9px] md:text-[11px] font-bold tracking-tight transition-colors duration-300 ${active ? 'text-indigo-700' : 'text-slate-400 group-hover:text-slate-600'}`}>{label}</span>
        </button>
    );
}

function ProfileModal({ currentUser, onClose, onNavigate }: { currentUser: User, onClose: () => void, onNavigate: (p: string) => void }) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative">
                <button onClick={onClose} className="absolute top-3 right-3 p-2 bg-black/10 hover:bg-black/20 text-white rounded-full transition-colors z-10 backdrop-blur-md">
                    <X className="w-4 h-4" />
                </button>
                <div className="h-28 bg-gradient-to-r from-gray-800 to-gray-900"></div>
                <div className="px-6 pb-6 -mt-12 text-center">
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-24 h-24 rounded-full border-4 border-white shadow-md mx-auto object-cover bg-white" />
                    <h2 className="mt-3 text-xl font-bold text-gray-900"><b>{currentUser.name}</b></h2>
                    <p className="text-sm text-gray-500 mb-4"><b>{currentUser.headline}</b></p>
                    <button onClick={() => { onClose(); onNavigate('profile'); }} className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold transition-all shadow-lg">
                        <b>View Full Profile</b>
                    </button>
                </div>
            </div>


        </div>
    );
}

export default ConflictReportPage;
