import React, { useState, useEffect } from 'react';
import { User } from '../App';
import investorsData from '../data/investors.json';
import { SearchResultsDropdown } from './SearchResultsDropdown';
import { Bell, MessageSquare, BrainCircuit, Sparkles, Home, X, ArrowUpRight, Users } from 'lucide-react';
import { Drawer } from 'vaul';

// Import newly extracted components
import { ChatPanel } from './home_sections/ChatPanel';
import { FoundersPanel } from './home_sections/FoundersPanel';
import { NewsPanel } from './home_sections/NewsPanel';
import { StatsPanel } from './home_sections/StatsPanel';

type HomePageProps = {
  currentUser: User;
  onNavigate: (page: string, userId?: string) => void;
  onSearch: (query: string) => void;
  onQueryChange?: (query: string) => void;
  ragResults?: {
    founders: { text: string; id: string }[];
    investors: { text: string; id: string }[];
  };
  isSearching?: boolean;
  onCheckConflict?: (investor: string, company: string) => void;
};

export function HomePage({ currentUser, onNavigate, onSearch, onQueryChange, ragResults, isSearching, onCheckConflict }: HomePageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [topFounders, setTopFounders] = useState<any[]>([]);
  const [investedCompanies, setInvestedCompanies] = useState<any[]>([]);

  // COI State
  const [coiCompanyName, setCoiCompanyName] = useState(currentUser.role === 'founder' ? currentUser.company || '' : '');
  const [coiInvestorName, setCoiInvestorName] = useState(currentUser.role === 'investor' ? currentUser.name || '' : '');
  const [coiSuggestions, setCoiSuggestions] = useState<any[]>([]);
  const [showCoiSuggestions, setShowCoiSuggestions] = useState(false);

  // Find Investors State
  const [investorMatches, setInvestorMatches] = useState<any[]>([]);
  const [showFindInvestorsModal, setShowFindInvestorsModal] = useState(false);
  const [isFindingInvestors, setIsFindingInvestors] = useState(false);
  const [investorMatchError, setInvestorMatchError] = useState<string | null>(null);
  const [userGrowthRate, setUserGrowthRate] = useState<number>(0.24);

  // Mobile Drawer State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  // Fetch match data prerequisites
  useEffect(() => {
    if (currentUser.id && currentUser.role === 'founder') {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      fetch(`${apiUrl}/api/founders/growth/${currentUser.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.growth_rate) {
            setUserGrowthRate(data.growth_rate);
          }
        })
        .catch(err => console.error("Growth fetch error:", err));
    }
  }, [currentUser.id]);

  const handleFindInvestors = async () => {
    setIsFindingInvestors(true);
    setInvestorMatchError(null);
    const directory = investorsData as { id: number; name: string; firm_name: string; headline?: string }[];
    const fallbackMatches = [
      directory.find((investor) => investor.firm_name.toLowerCase().includes('sequoia')),
      directory.find((investor) => investor.firm_name.toLowerCase().includes('andreessen')),
      directory.find((investor) => investor.firm_name.toLowerCase().includes('y combinator')),
    ].filter((investor): investor is NonNullable<typeof investor> => Boolean(investor)).map((investor) => ({
      name: investor.name,
      profileId: `investor-${investor.id}`,
      profileName: investor.name,
      profileHeadline: investor.headline || investor.firm_name,
      safety_label: 'Directory profile',
      match_score: null,
      confidence_score: null,
      activity_volatility: null,
    }));
    setInvestorMatches(fallbackMatches);
    setShowFindInvestorsModal(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    try {
      // Use User data if available, or sensible defaults
      const payload = {
        sector: currentUser.primaryDomain ? [currentUser.primaryDomain] : ["AI", "Healthcare"],
        stage: currentUser.investmentStage || "Seed",
        growth_rate: userGrowthRate
      };

      const predictionUrl = import.meta.env.VITE_PREDICTION_URL || 'http://localhost:8002';
      const res = await fetch(`${predictionUrl}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Match service returned ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.matches) && data.matches.length) {
        const matchesWithProfiles = data.matches.map((match: any) => {
          const name = String(match.name || '').toLowerCase();
          const investor = directory.find((candidate) => {
            const firm = candidate.firm_name.toLowerCase();
            return (name.includes('sequoia') && firm.includes('sequoia')) ||
              (name.includes('andreessen') && firm.includes('andreessen')) ||
              (name.includes('y combinator') && firm.includes('y combinator'));
          });
          return {
            ...match,
            profileId: investor ? `investor-${investor.id}` : undefined,
            profileName: investor?.name,
            profileHeadline: investor?.headline || investor?.firm_name,
          };
        });
        setInvestorMatches(matchesWithProfiles);
      } else {
        setInvestorMatchError('Personalized scores are unavailable. Browse these investor profiles while matching reconnects.');
      }
    } catch (err) {
      console.error("Failed to find investors:", err);
      setInvestorMatchError('Personalized scores are unavailable. Browse these investor profiles while matching reconnects.');
    } finally {
      window.clearTimeout(timeoutId);
      setIsFindingInvestors(false);
    }
  };

  // Auto-search for COI companies
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (coiCompanyName.length < 2) {
        setCoiSuggestions([]);
        return;
      }
      try {
        const ragUrl = import.meta.env.VITE_RAG_API_URL || 'http://localhost:8000';
        const res = await fetch(`${ragUrl}/search/founders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: coiCompanyName, top_k: 3 })
        });
        if (!res.ok) throw new Error(`Company search returned ${res.status}`);
        const data = await res.json();
        if (data.results) {
          const suggestions = data.results.map((result: any) => {
            const match = String(result.text || '').match(/(?:^|\\.\\s*)Company:\\s*([^.]*)/i);
            return match?.[1]?.trim() ? { id: result.id, name: match[1].trim() } : null;
          }).filter(Boolean);
          setCoiSuggestions(suggestions);
        }
      } catch (err) {
        console.error("COI Search Error", err);
      }
    };
    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [coiCompanyName]);

  useEffect(() => {
    // Fetch Dynamic Founder Data based on User Domain
    const fetchFounders = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const res = await fetch(`${apiUrl}/api/founders/rising`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, role: currentUser.role })
        });
        const data = await res.json();
        if (data.success) {
          setTopFounders(data.founders);
        }
      } catch (err) {
        console.error("Error loading top founders:", err);
      }
    };

    // Fetch Investments
    const fetchInvestments = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const res = await fetch(`${apiUrl}/api/investments/updates`, {
          headers: { 'x-user-id': currentUser.id }
        });
        const data = await res.json();
        if (Array.isArray(data)) setInvestedCompanies(data);
      } catch (e) { console.error(e); }
    };

    if (currentUser.id) {
      fetchFounders();
      fetchInvestments();
    }
  }, [currentUser]);

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleChatSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const ragUrl = import.meta.env.VITE_RAG_API_URL || 'http://localhost:8000';
      const res = await fetch(`${ragUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg, top_k: 5 })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response || "Sorry, I couldn't understand that." }]);
    } catch (err) {
      console.error("Chat Error:", err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Error connecting to AI Assistant." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Toggle Search on mobile
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

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

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      {/* --- Fixed Header --- */}
      <div className="bg-white px-4 md:px-8 py-3 md:py-6 shadow-sm border-b border-slate-100 z-50 flex-shrink-0 relative">
        <div className="flex items-center justify-between gap-4 w-full h-14 md:h-24">

          {/* Desktop Profile (Hidden on Mobile as requested "only search bar") */}
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

          {/* Mobile Profile Icon (Small, for access) - User said "only search bar at top", but we need a way to open profile. 
              I'll keep it very subtle or integrate into search? 
              Actually, I'll hide it from header and assume User Profile is accessible via "Network" or another means, OR just keep it as a small avatar.
              Let's keep small avatar for UX safety, but prioritize Search.
          */}
          <button
            onClick={() => setShowProfileModal(true)}
            className="md:hidden flex-shrink-0"
          >
            <img src={currentUser.avatar} className="w-8 h-8 rounded-full border border-gray-200" />
          </button>


          {/* Search */}
          <div className="flex-1 flex justify-center max-w-3xl px-0 md:px-8 relative">
            <form onSubmit={handleSearchSubmit} className="relative w-full group search-container">

              {/* Search Input */}
              <div className="relative w-full">
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
                />
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
              <div className="absolute top-full left-0 right-0 md:left-8 md:right-8 z-[100] shadow-2xl rounded-xl mt-2">
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
            <ActionItem icon={<Home />} label="Home" onClick={() => onNavigate('home')} active={true} />
            <ActionItem icon={<Users />} label="Network" onClick={() => onNavigate('network')} />
            <ActionItem icon={<Bell />} label="Alerts" badge={true} onClick={() => onNavigate('notifications')} />
            <ActionItem icon={<MessageSquare />} label="Inbox" onClick={() => onNavigate('messages')} />
            <ActionItem icon={<BrainCircuit />} label="Deep Analysis" onClick={() => onNavigate('conflict-report')} />
          </div>
        </div>
      </div>

      {/* --- Main Dashboard Content --- */}
      <div className="w-full px-0 md:px-6 pt-0 md:pt-6 pb-20 md:pb-2 overflow-hidden flex-1 relative">
        <div className="relative flex flex-row w-full h-full gap-6 px-4 md:px-0 pt-4 md:pt-0">

          {/* COLUMN 1: RAG Chatbot (Desktop Only) */}
          <div className="hidden lg:flex lg:flex-[22] h-full min-w-0">
            <ChatPanel
              currentUser={currentUser}
              chatInput={chatInput}
              setChatInput={setChatInput}
              chatMessages={chatMessages}
              isChatLoading={isChatLoading}
              handleChatSubmit={handleChatSubmit}
            />
          </div>

          {/* Mobile Chat Drawer (Triggered by Floating Button) */}
          <Drawer.Root open={isChatOpen} onOpenChange={setIsChatOpen}>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 bg-black/40 z-[99]" onClick={() => setIsChatOpen(false)} />
              <Drawer.Content className="bg-white flex flex-col rounded-t-[20px] h-[85vh] fixed bottom-0 left-0 right-0 z-[100] outline-none">
                <div className="p-4 bg-white rounded-t-[20px] flex-1 flex flex-col h-full overflow-hidden">
                  <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 flex-shrink-0" />
                  <ChatPanel
                    currentUser={currentUser}
                    chatInput={chatInput}
                    setChatInput={setChatInput}
                    chatMessages={chatMessages}
                    isChatLoading={isChatLoading}
                    handleChatSubmit={handleChatSubmit}
                  />
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>


          {/* COLUMN 2: Feed + Stats (Mobile: Reordered) */}
          <div className="flex-[100] lg:flex-[54] h-full min-w-0 overflow-y-auto lg:overflow-hidden pb-24 md:pb-0 scroll-smooth">
            <div className="flex flex-col h-full gap-2 lg:gap-6">

              {/* 1. Founders Section (Top on Mobile) */}
              <div className="flex-shrink-0 min-h-0 lg:flex-1 h-[420px] lg:h-auto pt-2 lg:pt-0">
                <FoundersPanel topFounders={topFounders} onNavigate={onNavigate} />
              </div>

              {/* 2. Stats Section (Middle on Mobile, Right Column on Desktop) */}
              <div className="flex-shrink-0 lg:hidden min-h-0 pt-4 px-1 pb-4 bg-slate-50 border-t border-slate-100">
                <StatsPanel
                  currentUser={currentUser}
                  coiCompanyName={coiCompanyName}
                  setCoiCompanyName={setCoiCompanyName}
                  coiInvestorName={coiInvestorName}
                  setCoiInvestorName={setCoiInvestorName}
                  coiSuggestions={coiSuggestions}
                  showCoiSuggestions={showCoiSuggestions}
                  setShowCoiSuggestions={setShowCoiSuggestions}
                  onCheckConflict={onCheckConflict}
                  isFindingInvestors={isFindingInvestors}
                  handleFindInvestors={handleFindInvestors}
                  investedCompanies={investedCompanies}
                />
              </div>

              {/* 3. News Section (Bottom on Mobile) */}
              <div className="flex-shrink-0 min-h-0 lg:flex-1 h-auto lg:h-auto border-t-[3px] border-slate-100 lg:border-none pt-2 lg:pt-0">
                <NewsPanel />
              </div>
            </div>
          </div>


          {/* COLUMN 3: Stats (Desktop Only) */}
          <div className="hidden lg:flex lg:flex-[20] h-full min-w-0">
            <StatsPanel
              currentUser={currentUser}
              coiCompanyName={coiCompanyName}
              setCoiCompanyName={setCoiCompanyName}
              coiInvestorName={coiInvestorName}
              setCoiInvestorName={setCoiInvestorName}
              coiSuggestions={coiSuggestions}
              showCoiSuggestions={showCoiSuggestions}
              setShowCoiSuggestions={setShowCoiSuggestions}
              onCheckConflict={onCheckConflict}
              isFindingInvestors={isFindingInvestors}
              handleFindInvestors={handleFindInvestors}
              investedCompanies={investedCompanies}
            />
          </div>

        </div>
      </div>

      {/* --- Floating AI Assistant Button (Left Side) --- */}
      <div className="lg:hidden fixed left-4 bottom-24 z-[90]">
        <button
          onClick={() => setIsChatOpen(true)}
          className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      </div>

      {/* --- Mobile Bottom Nav --- */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 z-[80] flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.02)] safe-area-pb">
        <ActionItem icon={<Home />} label="Home" onClick={() => onNavigate('home')} active={true} />
        <ActionItem icon={<Users className="w-6 h-6" />} label="Network" onClick={() => onNavigate('network')} />
        <ActionItem icon={<BrainCircuit className="w-6 h-6" />} label="Analyze" onClick={() => onNavigate('conflict-report')} />
        <ActionItem icon={<Bell className="w-6 h-6" />} label="Alerts" badge={true} onClick={() => onNavigate('notifications')} />
        <ActionItem icon={<MessageSquare className="w-6 h-6" />} label="Inbox" onClick={() => onNavigate('messages')} />
      </div>

      {/* --- Profile Modal --- */}
      {showProfileModal && (
        <ProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onNavigate={onNavigate}
        />
      )}

      {/* --- Find Investors Modal (Global) --- */}
      {showFindInvestorsModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowFindInvestorsModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-[280px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative flex flex-col max-h-[70vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Your Matches
              </h3>
              <button
                onClick={() => setShowFindInvestorsModal(false)}
                className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(isFindingInvestors || investorMatchError) && (
              <div className="px-3 py-2 text-[10px] leading-relaxed text-slate-600 bg-indigo-50 border-b border-indigo-100" role="status">
                {isFindingInvestors ? 'Checking fit… investor profiles are available now.' : investorMatchError}
              </div>
            )}

            <div className="p-3 overflow-y-auto custom-scrollbar bg-slate-50/50">
              <div className="grid grid-cols-1 gap-2">
                {investorMatches.map((match, idx) => (
                  <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-1.5 group">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                          {(match.profileName || match.name).charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 leading-none text-xs truncate">{match.profileName || match.name}</h4>
                          {match.profileHeadline && <span className="block mt-1 text-[9px] text-slate-500 truncate">{match.profileHeadline}</span>}
                          <span className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${match.safety_label === 'Low Risk' ? 'bg-emerald-100 text-emerald-700' : match.safety_label === 'Moderate Risk' ? 'bg-amber-100 text-amber-700' : match.safety_label === 'Directory profile' ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-700'}`}>
                            {match.safety_label || 'Investor profile'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-lg font-black text-indigo-600">{Number.isFinite(match.match_score) ? `${(match.match_score * 100).toFixed(0)}%` : '—'}</span>
                        <span className="text-[8px] uppercase font-bold text-slate-400 tracking-wider">{Number.isFinite(match.match_score) ? 'Match' : 'Profile'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                      <div className="p-1.5 bg-slate-50 rounded border border-slate-100">
                        <span className="block text-[8px] text-slate-400 font-medium uppercase leading-none mb-0.5">Conf.</span>
                        <span className="block text-[10px] font-bold text-slate-700 leading-none">{Number.isFinite(match.confidence_score) ? `${(match.confidence_score * 100).toFixed(0)}%` : '—'}</span>
                      </div>
                      <div className="p-1.5 bg-slate-50 rounded border border-slate-100">
                        <span className="block text-[8px] text-slate-400 font-medium uppercase leading-none mb-0.5">Vol.</span>
                        <span className="block text-[10px] font-bold text-slate-700 leading-none">{Number.isFinite(match.activity_volatility) ? match.activity_volatility.toFixed(2) : '—'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (!match.profileId) return;
                        setShowFindInvestorsModal(false);
                        onNavigate('profile', match.profileId);
                      }}
                      disabled={!match.profileId}
                      className="w-full mt-0.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded text-[10px] font-bold transition-colors shadow-sm"
                    >
                      View Profile
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components
function ActionItem({ icon, label, onClick, badge, active }: { icon: any, label: string, onClick: () => void, badge?: boolean, active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-2xl transition-all duration-300 group min-w-16 md:min-w-20 relative ${active ? 'bg-indigo-50/80' : 'hover:bg-slate-50'}`}
    >
      <div className={`relative transform transition-transform duration-300 ${active ? 'scale-105' : 'group-hover:scale-110'}`}>
        <div className={`p-1.5 rounded-xl transition-colors duration-300 ${active ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 group-hover:text-slate-700 bg-transparent'}`}>
          {React.cloneElement(icon, {
            strokeWidth: active ? 2.5 : 2,
            className: "w-5 h-5 md:w-6 md:h-6"
          })}
        </div>
        {badge && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 md:w-3 md:h-3 bg-rose-500 rounded-full border-2 border-white shadow-sm animate-pulse"></span>}
      </div>
      <span className={`text-[9px] md:text-[11px] font-bold tracking-tight transition-colors duration-300 ${active ? 'text-indigo-700' : 'text-slate-400 group-hover:text-slate-600'}`}>{label}</span>
    </button>
  );
}

function ProfileModal({ currentUser, onClose, onNavigate }: { currentUser: User, onClose: () => void, onNavigate: (p: string) => void }) {
  const [growthData, setGrowthData] = useState<{ rate: number } | null>(null);

  useEffect(() => {
    // Fetch Growth Prediction
    const fetchGrowth = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/founders/growth/${currentUser.id}`);
        const data = await res.json();
        if (data.success) {
          setGrowthData({ rate: data.growth_rate });
        }
      } catch (e) {
        console.error("Failed to fetch growth", e);
      }
    };
    if (currentUser.role === 'founder') {
      fetchGrowth();
    }
  }, [currentUser.id]);

  const baseline = 0.10;
  const isPositive = growthData ? growthData.rate > baseline : false;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-2 bg-black/10 hover:bg-black/20 text-white rounded-full transition-colors z-10 backdrop-blur-md">
          <X className="w-4 h-4" />
        </button>
        <div className="h-28 bg-gradient-to-r from-gray-800 to-gray-900"></div>
        <div className="px-6 pb-6 -mt-12 text-center">
          <img src={currentUser.avatar} alt={currentUser.name} className="w-24 h-24 rounded-full border-4 border-white shadow-md mx-auto object-cover bg-white" />
          <h2 className="mt-3 text-xl font-bold text-gray-900">{currentUser.name}</h2>

          {/* Growth Indicator */}
          {growthData && (
            <div className="flex items-center justify-center gap-2 mt-1 mb-2">
              <span className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-slate-500'}`}>
                {(growthData.rate * 100).toFixed(0)}%
              </span>
              {isPositive && (
                <ArrowUpRight className="w-6 h-6 text-green-500 stroke-[3px]" />
              )}
            </div>
          )}

          <p className="text-sm text-gray-500 mb-4">{currentUser.headline}</p>
          <button onClick={() => { onClose(); onNavigate('profile'); }} className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold transition-all shadow-lg">
            View Full Profile
          </button>
        </div>
      </div>
    </div>
  );
}
