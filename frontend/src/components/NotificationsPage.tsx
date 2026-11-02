import React, { useState, useEffect } from 'react';
import {
    ThumbsUp,
    MessageCircle,
    UserPlus,
    Briefcase,
    TrendingUp,
    Sparkles,
    Users,
    Bell,
    MessageSquare,
    BrainCircuit,
    PieChart,
    Building2,
    DollarSign,
    Home
} from 'lucide-react';
import { MobileChatOverlay } from './common/MobileChatOverlay';
import { SearchResultsDropdown } from './SearchResultsDropdown';
import { apiFetch } from '../apiFetch';
import { alertReadKey, investmentAlertId, saveReadIds, useUnreadBadges } from '../useUnreadBadges';

type NotificationsPageProps = {
    currentUser: any;
    onViewJob: (jobId: string) => void;
    onNavigateToChat: (userId: string) => void;
    onNavigate: (page: string) => void;
    onSearch: (query: string) => void;
    onQueryChange?: (query: string) => void;
    ragResults?: any;
    isSearching?: boolean;
};

// --- Sub-components for Header ---
const ActionItem = ({ icon, label, onClick, badge, active }: { icon: any, label: string, onClick: () => void, badge?: boolean, active?: boolean }) => (
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

export function NotificationsPage({ currentUser, onViewJob, onNavigateToChat, onNavigate, onSearch, onQueryChange, ragResults, isSearching }: NotificationsPageProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [notifications, setNotifications] = useState<any[]>([]);
    const [companyUpdates, setCompanyUpdates] = useState<any[]>([]);
    const [portfolioModel, setPortfolioModel] = useState<{ growthRate: number; projectedValue: number; baseValue: number; basis: string } | null>(null);
    const [publicFilings, setPublicFilings] = useState<any[]>([]);
    const [filingsUpdatedAt, setFilingsUpdatedAt] = useState<string | null>(null);
    const [filingsError, setFilingsError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [feedError, setFeedError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false); // Mobile search
    const [activeTab, setActiveTab] = useState<'notifications' | 'updates'>('notifications');
    const readKey = alertReadKey(String(currentUser?.id || 'guest'));
    const readIds = () => { try { return new Set<string>(JSON.parse(localStorage.getItem(readKey) || '[]')); } catch { return new Set<string>(); } };
    const { unreadAlerts, unreadInbox } = useUnreadBadges(String(currentUser?.id || ''));
    const markRead = (ids: string[]) => { saveReadIds(readKey, ids); setNotifications(items => items.map(item => ids.includes(item.id) ? { ...item, unread: false } : item)); setCompanyUpdates(items => items.map((item, index) => ids.includes(investmentAlertId(item, index)) ? { ...item, unread: false } : item)); };
    const formatMoney = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: value >= 1_000_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
    const updateDate = (update: any) => update.time && Number.isFinite(Date.parse(update.time)) ? new Date(update.time).toLocaleDateString() : Number(update.year) > 2000 ? String(update.year) : 'Date not recorded';

    useEffect(() => {
        if (!companyUpdates.length) { setPortfolioModel(null); return; }
        const totalValue = companyUpdates.reduce((sum, item) => sum + (Number(item.valuation) > 0 ? Number(item.valuation) : 0), 0);
        if (!(totalValue > 0)) { setPortfolioModel(null); return; }
        const years = companyUpdates.map(item => Number(item.year)).filter(year => Number.isFinite(year) && year > 2000);
        const totalRaised = companyUpdates.reduce((sum, item) => sum + (Number(item.amount) > 0 ? Number(item.amount) : 0), 0);
        const oldestYear = years.length ? Math.min(...years) : new Date().getFullYear();
        const multiple = totalRaised > 0 ? totalValue / totalRaised : Infinity;
        const recordedInputs = years.length > 0 && new Date().getFullYear() - oldestYear >= 1 && multiple >= 0.5 && multiple <= 20;
        const fundingYear = recordedInputs ? oldestYear : new Date().getFullYear() - 2;
        const fundingAmount = recordedInputs ? totalRaised : totalValue / 2.4;
        const controller = new AbortController();
        const predictionUrl = import.meta.env.VITE_PREDICTION_URL || 'http://localhost:8002';
        const loadForecast = async () => {
            try {
                const response = await apiFetch(`${predictionUrl}/predict`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ company: 'Tracked company portfolio', domain: 'diversified startup portfolio', funding_amount: fundingAmount, valuation: totalValue, funding_year: fundingYear, competitors: [], umbrella_companies: [] }) });
                if (!response.ok) throw new Error(`Growth model returned HTTP ${response.status}`);
                const result = await response.json();
                const projectedValue = Number(result?.valuation_projection?.['1_year']);
                const growthRate = Number(result?.growth_rate);
                if (!Number.isFinite(projectedValue) || !Number.isFinite(growthRate)) throw new Error('Growth model response was incomplete');
                setPortfolioModel({ growthRate, projectedValue, baseValue: totalValue, basis: recordedInputs ? 'Model estimate from dated investment records.' : 'Illustrative model scenario: the recorded funding and valuation history is incomplete or inconsistent, so this is not a reported return.' });
            } catch {
                if (!controller.signal.aborted) setPortfolioModel({ growthRate: 0, projectedValue: totalValue, baseValue: totalValue, basis: 'Tracked company valuations are shown. The growth service is unavailable, so no forecast has been invented.' });
            }
        };
        loadForecast();
        return () => controller.abort();
    }, [companyUpdates]);

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

    useEffect(() => {
        if (!currentUser?.id) return;
        const controller = new AbortController();
        let active = true;
        let inFlight = false;
        const fetchNotifications = async () => {
            if (inFlight || document.visibilityState === 'hidden') return;
            inFlight = true;
            setRefreshing(true);
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                const res = await apiFetch(`${apiUrl}/connections/notifications`, {
                    headers: { 'x-user-id': currentUser.id }, signal: controller.signal
                });
                if (!res.ok) throw new Error(`Alerts returned HTTP ${res.status}`);
                const data = await res.json();
                if (!Array.isArray(data)) throw new Error('Alerts response was invalid');

                const requestsRes = await apiFetch(`${apiUrl}/connections/requests/incoming`, {
                    headers: { 'x-user-id': currentUser.id }, signal: controller.signal
                });
                const requests = requestsRes.ok ? await requestsRes.json() : [];
                if (!Array.isArray(requests)) throw new Error('Connection request feed was invalid');
                const acceptedNotifs = data.map((n: any) => ({
                    id: `conn-${n.id}`,
                    type: 'connection',
                    avatar: 'https://randomuser.me/api/portraits/lego/1.jpg',
                    message: `${n.receiver_name} accepted your connection request`,
                    timestamp: n.responded_at && Number.isFinite(Date.parse(n.responded_at)) ? new Date(n.responded_at).toLocaleDateString() : 'Recently',
                    unread: !readIds().has(`conn-${n.id}`),
                    metadata: { userId: String(n.receiver_id) }
                }));
                const requestNotifs = requests.map((n: any) => ({
                    id: `req-${n.id}`, type: 'request',
                    avatar: n.sender_avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
                    message: `${n.sender_name || 'Someone'} sent you a connection request${n.sender_headline ? ` · ${n.sender_headline}` : ''}`,
                    timestamp: n.created_at && Number.isFinite(Date.parse(n.created_at)) ? new Date(n.created_at).toLocaleDateString() : 'Recently',
                    unread: !readIds().has(`req-${n.id}`), metadata: { page: 'network' }
                }));

                let updateData: any[] = [];
                let updateFeedWarning: string | null = null;
                try {
                    const resUpdates = await apiFetch(`${apiUrl}/api/investments/updates`, {
                        headers: { 'x-user-id': currentUser.id }, signal: controller.signal
                    });
                    if (!resUpdates.ok) throw new Error(`Investment updates returned HTTP ${resUpdates.status}`);
                    const parsedUpdates = await resUpdates.json();
                    if (!Array.isArray(parsedUpdates)) throw new Error('Investment updates response was invalid');
                    updateData = parsedUpdates;
                } catch (error) {
                    if (controller.signal.aborted) return;
                    updateFeedWarning = error instanceof Error ? error.message : 'Investment updates are unavailable.';
                }
                if (!active) return;
                setNotifications([...requestNotifs, ...acceptedNotifs]);
                setCompanyUpdates(updateData.map((update: any, index: number) => ({ ...update, unread: !readIds().has(investmentAlertId(update, index)) })));
                setLastUpdated(new Date());
                setFeedError(updateFeedWarning);
            } catch (e) {
                if (!controller.signal.aborted && active) setFeedError(e instanceof Error ? e.message : 'Unable to refresh alerts.');
            } finally {
                inFlight = false;
                if (active) setRefreshing(false);
            }
        };
        fetchNotifications();
        const intervalId = window.setInterval(fetchNotifications, 15000);
        const onVisibilityChange = () => { if (document.visibilityState === 'visible') fetchNotifications(); };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => { active = false; controller.abort(); window.clearInterval(intervalId); document.removeEventListener('visibilitychange', onVisibilityChange); };
    }, [currentUser?.id, refreshToken]);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        const loadFilings = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                const response = await apiFetch(`${apiUrl}/api/market/updates`, { signal: controller.signal });
                const data = await response.json();
                if (!response.ok && !data.entries?.length) throw new Error(data.error || 'SEC filing feed is unavailable.');
                if (!active) return;
                setPublicFilings(Array.isArray(data.entries) ? data.entries : []);
                setFilingsUpdatedAt(data.fetchedAt || null);
                setFilingsError(data.error || null);
            } catch (error) {
                if (active && !controller.signal.aborted) setFilingsError(error instanceof Error ? error.message : 'SEC filing feed is unavailable.');
            }
        };
        loadFilings();
        const timer = window.setInterval(() => { if (document.visibilityState === 'visible') loadFilings(); }, 5 * 60 * 1000);
        return () => { active = false; controller.abort(); window.clearInterval(timer); };
    }, []);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (onSearch) onSearch(searchQuery);
        setIsSearchExpanded(false);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'like': return <ThumbsUp className="w-5 h-5 text-blue-600" />;
            case 'comment': return <MessageCircle className="w-5 h-5 text-green-600" />;
            case 'connection': return <UserPlus className="w-5 h-5 text-purple-600" />;
            case 'job': return <Briefcase className="w-5 h-5 text-orange-600" />;
            default: return <TrendingUp className="w-5 h-5 text-gray-600" />;
        }
    };

    return (
        <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
            {/* --- Responsive Header (Copied from HomePage) --- */}
            <div className="bg-white px-4 md:px-8 py-3 md:py-6 shadow-sm border-b border-slate-100 z-50 flex-shrink-0 relative">
                <div className="flex items-center justify-between gap-4 w-full h-14 md:h-24">

                    {/* Desktop Profile */}
                    <button
                        onClick={() => onNavigate('profile')}
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
                            <span className="text-lg font-bold text-gray-900 leading-tight group-hover:text-slate-800">{currentUser.name}</span>
                            <span className="text-xs text-gray-500 font-medium">View Profile</span>
                        </div>
                    </button>

                    <button
                        onClick={() => onNavigate('profile')}
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
                            <div className="absolute top-full left-0 right-0 mt-2 z-[100] shadow-2xl rounded-2xl border border-slate-100 overflow-hidden bg-white">
                                <SearchResultsDropdown
                                    results={ragResults}
                                    isVisible={true}
                                    isLoading={isSearching || false}
                                    onSelectResult={(id) => onNavigate(`profile:${id}`)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Desktop Nav Icons */}
                    <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
                        <ActionItem icon={<Home />} label="Home" onClick={() => onNavigate('home')} />
                        <ActionItem icon={<Users />} label="Network" onClick={() => onNavigate('network')} />
                        <ActionItem icon={<Bell />} label="Alerts" badge={unreadAlerts > 0} onClick={() => onNavigate('notifications')} active={true} />
                        <ActionItem icon={<MessageSquare />} label="Inbox" badge={unreadInbox > 0} onClick={() => onNavigate('messages')} />
                        <ActionItem icon={<BrainCircuit />} label="Deep Analysis" onClick={() => onNavigate('conflict-report')} />
                    </div>
                </div>
            </div>

            {/* --- Main Content --- */}
            <div className="flex-1 overflow-auto bg-slate-50 pb-20 md:pb-0">
                <div className="max-w-[1600px] mx-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6">

                    {/* Mobile Tab Selector */}
                    <div className="lg:hidden flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-2">
                        <button
                            onClick={() => setActiveTab('notifications')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'notifications' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500'}`}
                        >
                            Activity
                        </button>
                        <button
                            onClick={() => setActiveTab('updates')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'updates' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500'}`}
                        >
                            Market Updates
                        </button>
                    </div>

                    {/* LEFT: Main Notification Details (notifications list) - Hidden on mobile if tab is Updates */}
                    <div className={`flex-1 flex flex-col gap-6 min-w-0 ${activeTab === 'updates' ? 'hidden lg:flex' : 'flex'}`}>
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 min-h-[500px]">
                            <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
                                <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Notifications</h2>
                                <div className="flex items-center gap-3"><span className="text-[10px] text-slate-400">{refreshing ? 'Updating…' : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ''}</span><button type="button" onClick={() => setRefreshToken(value => value + 1)} disabled={refreshing} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-40">Refresh</button><button type="button" onClick={() => markRead([...notifications.map(n => n.id), ...companyUpdates.map((item, index) => investmentAlertId(item, index))])} disabled={!notifications.some(n => n.unread) && !companyUpdates.some((item: any) => item.unread)} className="text-sm font-semibold text-slate-500 hover:text-slate-900 disabled:opacity-40">Mark all as read</button></div>
                            </div>

                            {feedError && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><span>Could not refresh live alerts: {feedError}</span><button type="button" onClick={() => { setFeedError(null); setRefreshToken(value => value + 1); }} className="font-bold underline">Retry</button></div>}

                            <div className="space-y-4">

                                {/* Section 1: Connections */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Recent Connections</h3>
                                    <div className="space-y-2">
                                        {notifications.slice(0, 4).map(notification => (
                                            <div
                                                key={notification.id}
                                                onClick={() => {
                                                    if (notification.unread) markRead([notification.id]);
                                                    if (notification.type === 'connection' && notification.metadata?.userId) {
                                                        onNavigateToChat(notification.metadata.userId);
                                                    } else if (notification.metadata?.page) {
                                                        onNavigate(notification.metadata.page);
                                                    } else if (notification.isJob) {
                                                        onViewJob(notification.id);
                                                    }
                                                }}
                                                className={`group p-3 md:p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${notification.unread ? 'border-rose-200 bg-rose-50/70 hover:bg-rose-50' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                <div className="relative">
                                                    <img
                                                        src={notification.avatar}
                                                        alt="Avatar"
                                                        className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border border-slate-100"
                                                    />
                                                    <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-sm">
                                                        {getIcon(notification.type)}
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-slate-900 font-medium text-sm md:text-[15px]">{notification.message}</p>
                                                    <p className="text-slate-500 text-xs mt-1">{notification.timestamp}</p>
                                                </div>

                                                {notification.unread && (
                                                    <div className="w-2.5 h-2.5 bg-rose-600 rounded-full mt-2 self-start ring-4 ring-rose-100"></div>
                                                )}
                                            </div>
                                        ))}
                                        {notifications.length === 0 && !refreshing && <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600"><p className="font-semibold text-slate-800">You’re all caught up</p><p className="mt-1">New connection requests and accepted connections will appear here. Find people in Network to get started.</p><button onClick={() => onNavigate('network')} className="mt-3 font-bold text-indigo-600 hover:text-indigo-800">Explore Network →</button></div>}
                                    </div>
                                </div>

                                {/* Section 2: Investment Activity */}
                                <div className="pt-2 border-t border-slate-100">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 mt-2">Portfolio Activity</h3>
                                    <div className="space-y-2">
                                        {companyUpdates.slice(0, 4).map((update, i) => (
                                            <div
                                                key={investmentAlertId(update, i)} onClick={() => { if (update.unread) markRead([investmentAlertId(update, i)]); if (update.founder_id) onNavigateToChat(String(update.founder_id)); }}
                                                className={`group p-3 md:p-4 rounded-xl border transition-all flex items-start gap-4 ${update.unread ? 'border-rose-200 bg-rose-50/70' : 'border-transparent bg-emerald-50/30'} ${update.founder_id ? 'cursor-pointer hover:border-slate-200' : ''}`}
                                            >
                                                <div className="relative">
                                                    <img
                                                        src={`https://i.pravatar.cc/150?u=${update.founder_id || (i + 10)}`}
                                                        alt="Company"
                                                        className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border border-slate-100"
                                                    />
                                                    <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-sm">
                                                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-slate-900 font-medium text-sm md:text-[15px]">Investment successful in {update.company}</p>
                                                    <p className="text-slate-500 text-xs mt-1">{update.time && Number.isFinite(Date.parse(update.time)) ? new Date(update.time).toLocaleDateString() : (Number(update.year) > 2000 ? String(update.year) : 'Date not recorded')} • {update.round}</p>
                                                </div>

                                                {update.unread && <div className="w-2.5 h-2.5 bg-rose-600 rounded-full mt-2 self-start ring-4 ring-rose-100"></div>}
                                            </div>
                                        ))}
                                        {companyUpdates.length === 0 && <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No confirmed investment activity yet. Matched founder and investor submissions will appear here.</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Sidebar Widgets - Hidden on mobile if tab is Notifications */}
                    <div className={`w-full lg:w-96 flex-shrink-0 flex flex-col gap-6 min-w-0 ${activeTab === 'notifications' ? 'hidden lg:flex' : 'flex'}`}>

                        {/* Widget 1: Investment Only Updates */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-emerald-50 rounded-lg"><PieChart className="w-5 h-5 text-emerald-600" /></div>
                                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Investment Updates</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <h4 className="font-bold text-slate-800 text-sm">Tracked Company Growth</h4>
                                    {portfolioModel ? <><p className="mt-1 text-sm text-slate-700">Current tracked valuation: <strong>{formatMoney(portfolioModel.baseValue)}</strong></p><p className="mt-1 text-sm text-slate-700">1-year model scenario: <strong>{formatMoney(portfolioModel.projectedValue)}</strong> ({portfolioModel.growthRate >= 0 ? '+' : ''}{(portfolioModel.growthRate * 100).toFixed(1)}%)</p><p className="mt-2 text-[10px] leading-relaxed text-slate-500">{portfolioModel.basis} Aggregate company valuations are not your ownership stake or realized return.</p></> : <p className="text-slate-600 text-sm mt-1">No company valuations are recorded yet. Confirm investment details to populate the growth model.</p>}
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <h4 className="font-bold text-slate-800 text-sm">New Opportunities</h4>
                                    <p className="text-slate-600 text-sm mt-1">{companyUpdates.length} recorded investment update{companyUpdates.length === 1 ? '' : 's'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Widget 2: Founder Company Updates */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-blue-50 rounded-lg"><Building2 className="w-5 h-5 text-blue-600" /></div>
                                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Company Updates</h3>
                            </div>
                            <div className="space-y-3">
                                {companyUpdates.slice(0, 4).length > 0 ? (
                                    companyUpdates.slice(0, 4).map((update, i) => (
                                        <div key={i} className="flex gap-3 items-center p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                            <img
                                                src={`https://i.pravatar.cc/150?u=${update.founder_id || (i % 5) + 5}`}
                                                className="w-10 h-10 rounded-lg bg-slate-200 object-cover"
                                            />
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-xs">{update.company}</h4>
                                                <p className="text-[10px] text-slate-500">{update.round} • {update.time && Number.isFinite(Date.parse(update.time)) ? new Date(update.time).toLocaleDateString() : (Number(update.year) > 2000 ? String(update.year) : 'Date not recorded')}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-4 text-slate-400 text-xs">
                                        No recent company updates
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Live market prices are not provided by the connected data sources. */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-amber-50 rounded-lg"><DollarSign className="w-5 h-5 text-amber-600" /></div>
                                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Market Watch</h3>
                            </div>
                            <p className="text-sm text-slate-600">Live stock and private-market prices are not connected. These are current SEC Form D notices, not verified deal announcements.</p>
                            <p className="mt-2 text-[10px] text-slate-400">{filingsUpdatedAt ? `EDGAR feed updated ${new Date(filingsUpdatedAt).toLocaleString()}` : filingsError || 'Loading public filings…'}</p>
                            {publicFilings.slice(0, 3).map((filing: any, index: number) => <a key={`${filing.url}-${index}`} href={filing.url} target="_blank" rel="noreferrer" className="mt-2 block rounded-lg border border-slate-100 p-2 text-xs font-semibold text-slate-700 hover:border-indigo-200 hover:text-indigo-700">{filing.title}<span className="mt-1 block text-[10px] font-normal text-slate-400">{filing.filedAt && Number.isFinite(Date.parse(filing.filedAt)) ? new Date(filing.filedAt).toLocaleDateString() : 'SEC EDGAR'}</span></a>)}
                            <button type="button" onClick={() => onNavigate('home')} className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800">Open market intelligence</button>
                        </div>

                    </div>
                </div>
            </div>

            {/* --- Mobile Bottom Nav --- */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 z-[80] flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.02)] safe-area-pb">
                <ActionItem icon={<Home />} label="Home" onClick={() => onNavigate('home')} />
                <ActionItem icon={<Users className="w-6 h-6" />} label="Network" onClick={() => onNavigate('network')} />
                <ActionItem icon={<BrainCircuit className="w-6 h-6" />} label="Analyze" onClick={() => onNavigate('conflict-report')} />
                <ActionItem icon={<Bell className="w-6 h-6" />} label="Alerts" badge={unreadAlerts > 0} onClick={() => onNavigate('notifications')} active={true} />
                <ActionItem icon={<MessageSquare className="w-6 h-6" />} label="Inbox" badge={unreadInbox > 0} onClick={() => onNavigate('messages')} />
            </div>

            <MobileChatOverlay currentUser={currentUser} />
        </div>
    );
}
