import React, { useState, useRef, useEffect } from 'react';
import { User, Post } from '../App';
import { Camera, Edit2, MapPin, Link as LinkIcon, Briefcase, ShieldAlert, CheckCircle2, Award, BookOpen, Clock, Home, Users, Bell, MessageSquare, BrainCircuit, Sparkles, Search } from 'lucide-react';
import { EditProfileModal } from './EditProfileModal';
import { SearchResultsDropdown } from './SearchResultsDropdown';
import { GrowthPredictionSection } from './GrowthPredictionSection';
import { MobileChatOverlay } from './common/MobileChatOverlay';
import { useUnreadBadges } from '../useUnreadBadges';

type ProfilePageProps = {
  user: User; // The profile being viewed
  currentUser: User; // The logged-in user (for header)
  isOwnProfile: boolean;
  isFollowing: boolean;
  onUpdateProfile: (user: User) => void;
  onFollowUser: () => void;
  userPosts: Post[];
  onViewConflictReport: () => void;
  onNavigate: (page: string, userId?: string) => void;
  onSearch: (query: string) => void;
  onQueryChange?: (query: string) => void;
  ragResults?: any;
  isSearching?: boolean;
};

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

export function ProfilePage({ user, currentUser, isOwnProfile, isFollowing, onUpdateProfile, onFollowUser, userPosts, onViewConflictReport, onNavigate, onSearch, onQueryChange, ragResults, isSearching }: ProfilePageProps) {
  const { unreadAlerts, unreadInbox } = useUnreadBadges(String(currentUser?.id || ''));
  const safeCurrentUser = currentUser || { id: 'guest', name: 'Guest', avatar: 'https://i.pravatar.cc/150?u=guest', headline: '', connections: 0, about: '', experience: '', education: '', coverImage: '' };

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileImage, setProfileImage] = useState(user.avatar);
  const [coverImage, setCoverImage] = useState(user.coverImage);
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'experience' | 'education' | 'skills'>('about');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false); // Mobile search

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setProfileImage(result);
        onUpdateProfile({ ...user, avatar: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setCoverImage(result);
        onUpdateProfile({ ...user, coverImage: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(searchQuery);
    setIsSearchExpanded(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">

      {/* --- Responsive Header (Copied from HomePage) --- */}
      <div className="sticky top-0 bg-white px-4 md:px-8 py-3 md:py-6 shadow-sm border-b border-slate-100 z-50 flex-shrink-0">
        <div className="flex items-center justify-between gap-4 w-full h-14 md:h-24">

          {/* Desktop Profile (Click to go to own profile) */}
          <button
            onClick={() => onNavigate('profile', safeCurrentUser.id || 'current-user')}
            className="hidden md:flex items-center gap-4 hover:bg-slate-50 p-2 rounded-xl transition-all group flex-shrink-0 min-w-52"
          >
            <div className="relative">
              <img
                src={safeCurrentUser.avatar}
                alt={safeCurrentUser.name}
                className="w-14 h-14 rounded-full border-2 border-gray-100 group-hover:border-slate-300 transition-colors object-cover"
              />
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-lg font-bold text-gray-900 leading-tight group-hover:text-slate-800">{safeCurrentUser.name}</span>
              <span className="text-xs text-gray-500 font-medium">View Profile</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('profile', safeCurrentUser.id || 'current-user')}
            className="md:hidden flex-shrink-0"
          >
            <img src={safeCurrentUser.avatar} className="w-8 h-8 rounded-full border border-gray-200" />
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
                  placeholder="Search..."
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
              <div className="absolute top-full left-4 right-4 mt-2 z-[100] shadow-2xl rounded-2xl border border-slate-100 overflow-hidden">
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
            <ActionItem icon={<BrainCircuit />} label="Deep Analysis" onClick={() => onNavigate('conflict-report')} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-4 md:py-8 font-sans text-slate-900 animate-in fade-in duration-500 pb-20 md:pb-8">
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden relative">

          {/* Cover Image */}
          <div className="relative h-48 md:h-64 bg-slate-900 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 opacity-90"></div>
            {coverImage && (
              <img
                src={coverImage}
                alt="Cover"
                className="w-full h-full object-cover relative z-10 opacity-80 group-hover:opacity-100 transition-opacity duration-700"
              />
            )}

            {isOwnProfile && (
              <button
                onClick={() => coverInputRef.current?.click()}
                className="absolute top-4 right-4 md:top-6 md:right-6 bg-white/10 backdrop-blur-md rounded-2xl p-2 md:p-3 shadow-lg hover:bg-white/20 transition-all z-20 border border-white/20 text-white"
              >
                <Camera className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverImageChange}
              className="hidden"
            />
          </div>

          {/* Profile Header Content */}
          <div className="px-4 md:px-8 pb-8 relative">
            <div className="flex flex-col md:flex-row justify-between items-start -mt-16 md:-mt-20 mb-8 relative z-20">

              {/* Avatar */}
              <div className="relative group">
                <div className="relative p-1.5 bg-white rounded-3xl shadow-xl">
                  <img
                    src={profileImage}
                    alt={user.name}
                    className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover border border-slate-100"
                  />
                </div>

                {isOwnProfile && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2 right-2 bg-slate-900 text-white rounded-xl p-2.5 shadow-lg hover:scale-105 transition-all border-2 border-white"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                  className="hidden"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 mt-4 md:mt-24 items-center w-full md:w-auto">
                {isOwnProfile ? (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 font-bold hover:bg-white hover:border-slate-300 hover:shadow-md transition-all whitespace-nowrap"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={onViewConflictReport}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-3 rounded-2xl border-2 border-slate-200 text-slate-700 font-bold hover:border-slate-900 hover:text-slate-900 transition-all bg-white whitespace-nowrap"
                      title="Check for conflicts of interest"
                    >
                      <ShieldAlert className="w-5 h-5" />
                      <span className="hidden md:inline">Detect Conflict</span>
                      <span className="md:hidden">Check</span>
                    </button>
                    <button
                      onClick={onFollowUser}
                      className={`flex-1 md:flex-none px-6 md:px-8 py-3 rounded-2xl font-bold transition-all shadow-lg hover:-translate-y-0.5 whitespace-nowrap ${isFollowing
                        ? 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600'
                        : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-indigo-200'
                        }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">{user.name}</h1>
              <p className="text-base md:text-lg text-slate-500 font-medium">{user.headline}</p>

              <div className="flex flex-wrap items-center gap-4 md:gap-6 mt-4 text-sm font-medium text-slate-500">
                {user.location && <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {user.location}
                </span>}
                <span className="flex items-center gap-1.5 text-indigo-600 font-bold bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                  <CheckCircle2 className="w-4 h-4" />
                  {user.connections} connections
                </span>

                {/* Social Links */}
                {(user.website || user.linkedin || user.otherLinks?.length) && (
                  <div className="flex gap-3 ml-2 border-l border-slate-200 pl-4">
                    {user.website && (
                      <a href={user.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-slate-900 transition-colors">
                        <LinkIcon className="w-3.5 h-3.5" /> Website
                      </a>
                    )}
                    {user.linkedin && (
                      <a href={user.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-blue-700 transition-colors">
                        <LinkIcon className="w-3.5 h-3.5" /> LinkedIn
                      </a>
                    )}
                    {user.otherLinks?.filter((link) => link.url !== user.website && link.url !== user.linkedin).map((link) => (
                      <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-indigo-700 transition-colors">
                        <LinkIcon className="w-3.5 h-3.5" /> {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Growth Prediction Card */}
            <GrowthPredictionSection user={user} />
          </div>

          {/* Tabs */}
          <div className="border-t border-slate-100 px-4 md:px-8 bg-slate-50/50">
            <div className="flex gap-8 overflow-x-auto no-scrollbar">
              {['about', 'posts', 'experience', 'education', 'skills'].map((tab) => {
                const label = tab === 'posts' ? (user.role === 'investor' ? 'Past Investments' : user.role === 'founder' ? 'Company & Funding' : 'Posts') :
                  tab === 'skills' ? (user.role === 'investor' ? 'Investment Stage' : 'Skills') :
                    tab.charAt(0).toUpperCase() + tab.slice(1);

                const isActive = activeTab === tab;

                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`py-5 border-b-[3px] transition-all whitespace-nowrap text-sm font-bold tracking-wide ${isActive
                      ? 'border-indigo-600 text-indigo-900'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="px-4 md:px-8 py-10 min-h-[400px]">
            {activeTab === 'about' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">About</h2>
                <p className="text-slate-600 leading-relaxed whitespace-pre-line text-lg max-w-4xl">{user.about}</p>

                {user.publicConnections && user.publicConnections.length > 0 && (
                  <section className="mt-8 max-w-4xl">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Public connections</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {user.publicConnections.map((connection) => (
                        <article key={`${connection.name}-${connection.relationship}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="font-bold text-slate-800">{connection.name}</p>
                          <p className="mt-1 text-sm leading-relaxed text-slate-600">{connection.relationship}</p>
                          <a href={connection.source} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:underline">
                            View source <LinkIcon className="h-3.5 w-3.5" />
                          </a>
                        </article>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">Publicly documented work or investment relationships. These are not private contact or mutual-connection data.</p>
                  </section>
                )}

                {(user.role === 'founder' && user.companyTenureLabel) || (user.role === 'investor' && user.investorFirmTenureLabel) ? (
                  <section className="mt-8 max-w-4xl rounded-2xl border border-indigo-100 bg-indigo-50/70 p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">{user.role === 'founder' ? 'Company age' : 'Firm history'}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-800">{user.role === 'founder' ? user.companyMaturity : user.investorFirmMaturity}</span>
                    </div>
                    <p className="mt-2 font-semibold text-slate-800">{user.role === 'founder' ? user.companyTenureLabel : user.investorFirmTenureLabel}</p>
                    {(user.role === 'founder' ? user.companyTrendSummary : user.investmentTrendSummary) && (
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{user.role === 'founder' ? user.companyTrendSummary : user.investmentTrendSummary}</p>
                    )}
                    {user.role === 'founder' && user.trendSources?.map((source, index) => <a key={source} href={source} target="_blank" rel="noreferrer" className="mt-3 mr-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline">{index === 0 ? 'Company history source' : `Additional source ${index}`} <LinkIcon className="h-4 w-4" /></a>)}
                    {user.role === 'investor' && user.firmHistorySource && <a href={user.firmHistorySource} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline">Source for firm history <LinkIcon className="h-4 w-4" /></a>}
                  </section>
                ) : null}

                  {(user.role === 'investor' || user.role === 'founder') && user.dataStatus && (<p className="mt-4 text-xs text-slate-500">{user.dataStatus}</p>)}
                  {(user.role === 'investor' || user.role === 'founder') && user.profileSource && (<a href={user.profileSource} target="_blank" rel="noreferrer" className="inline-flex mt-4 items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline">Verify profile at source <LinkIcon className="w-4 h-4" /></a>)}
                  {(user.role === 'investor' || user.role === 'founder') && user.avatarSource && (<a href={user.avatarSource} target="_blank" rel="noreferrer" className="inline-flex mt-4 ml-4 items-center gap-2 text-sm font-semibold text-slate-600 hover:underline">Portrait source <LinkIcon className="w-4 h-4" /></a>)}

                {user.role === 'investor' && (user.investmentThesis || user.totalInvestmentsCount !== undefined) && (
                  <section className="mt-6 max-w-4xl rounded-2xl border border-slate-200 bg-white p-6">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Investment profile</h3>
                    {user.totalInvestmentsCount !== undefined && <p className="mt-2 text-sm text-slate-700">Source-listed investments: <strong>{user.totalInvestmentsCount}</strong></p>}
                    {user.investmentThesis && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{user.investmentThesis}</p>}
                    {user.sourceConfidence !== undefined && <p className="mt-2 text-xs text-slate-400">Source dataset confidence: {user.sourceConfidence}</p>}
                  </section>
                )}

                {(user.primaryDomain || user.secondaryDomain) && (
                  <div className="mt-8 pt-8 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Focus Areas</h3>
                    <div className="flex flex-wrap gap-3">
                      {user.primaryDomain && (
                        <span className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold border border-indigo-100 shadow-sm">
                          Primary: {user.primaryDomain}
                        </span>
                      )}
                      {user.secondaryDomain && (
                        <span className="px-4 py-2 bg-white text-slate-600 rounded-xl text-sm font-bold border border-slate-200 shadow-sm">
                          Secondary: {user.secondaryDomain}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'posts' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">{user.role === 'investor' ? 'Past Investments' : user.role === 'founder' ? 'Company & Funding' : 'Posts'}</h2>
                {(user.role === 'investor' && user.pastInvestments) || (user.role === 'founder' && (user.companyFunding || user.pastInvestments || user.companyTenureLabel)) ? (
                  <div className="space-y-4">
                    {user.role === 'founder' && user.companyTenureLabel && <section className="bg-indigo-50/70 p-8 rounded-2xl border border-indigo-100"><h3 className="text-sm font-bold uppercase tracking-wide text-indigo-700 mb-3">Operating history · {user.companyMaturity}</h3><p className="text-slate-700 leading-relaxed">{user.companyTenureLabel}</p>{user.companyTrendSummary && <p className="mt-3 text-slate-700 leading-relaxed">{user.companyTrendSummary}</p>}{user.trendSource && <a href={user.trendSource} target="_blank" rel="noreferrer" className="inline-flex mt-4 items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline">Company and trend source <LinkIcon className="w-4 h-4" /></a>}</section>}
                    {user.role === 'founder' && user.companyFunding && <section className="bg-slate-50 p-8 rounded-2xl border border-slate-100"><h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Company & funding context</h3><p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{user.companyFunding}</p></section>}
                    {user.pastInvestments && <section className="bg-slate-50 p-8 rounded-2xl border border-slate-100"><h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">{user.role === 'founder' ? 'Founder and investment history' : 'Selected investment history'}</h3><p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{user.pastInvestments}</p></section>}
                  </div>
                ) : (
                  userPosts.length > 0 ? (
                    <div className="grid gap-6">
                      {userPosts.map(post => (
                        <div key={post.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                          <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                          {post.image && (
                            <img src={post.image} alt="Post" className="mt-4 rounded-xl w-full object-cover max-h-96" />
                          )}
                          <div className="flex gap-6 mt-4 pt-4 border-t border-slate-50 text-sm font-medium text-slate-500">
                            <span>{post.likes} likes</span>
                            <span>{post.comments.length} comments</span>
                            <span className="text-slate-400 ml-auto">{post.timestamp}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <Edit2 className="w-6 h-6 opacity-50" />
                      </div>
                      <p>No content available</p>
                    </div>
                  )
                )}
              </div>
            )}

            {activeTab === 'experience' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Experience</h2>
                <div className="flex gap-5 items-start">
                  <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-indigo-100">
                    <Briefcase className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{user.experience}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Present</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'education' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Education</h2>
                <div className="flex gap-5 items-start">
                  <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-100">
                    <BookOpen className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{user.education}</h3>
                    <p className="text-slate-500 mt-1">{user.education.includes('For this project demo') ? 'Illustrative demo detail only; education is not verified and should not be treated as a real credential.' : 'Public profile details; degree completion is specified only where stated.'}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'skills' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">{user.role === 'investor' ? 'Investment Stage Preference' : 'Skills'}</h2>
                {user.role === 'investor' && user.investmentStage ? (
                  <span className="px-6 py-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl inline-flex items-center gap-2 font-bold shadow-sm">
                    <Award className="w-5 h-5" />
                    {user.investmentStage}
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <span className="px-5 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">User Experience Design</span>
                    <span className="px-5 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">Product Strategy</span>
                    <span className="px-5 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">Venture Capital</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isEditingProfile && (
          <EditProfileModal
            user={user}
            onClose={() => setIsEditingProfile(false)}
            onSave={(updatedUser) => {
              onUpdateProfile(updatedUser);
              setIsEditingProfile(false);
            }}
          />
        )}
      </div>

      {/* --- Mobile Bottom Nav --- */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 z-[80] flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.02)] safe-area-pb">
        <ActionItem icon={<Home />} label="Home" onClick={() => onNavigate('home')} />
        <ActionItem icon={<Users className="w-6 h-6" />} label="Network" onClick={() => onNavigate('network')} />
        <ActionItem icon={<BrainCircuit className="w-6 h-6" />} label="Analyze" onClick={() => onNavigate('conflict-report')} />
        <ActionItem icon={<Bell className="w-6 h-6" />} label="Alerts" badge={unreadAlerts > 0} onClick={() => onNavigate('notifications')} />
        <ActionItem icon={<MessageSquare className="w-6 h-6" />} label="Inbox" badge={unreadInbox > 0} onClick={() => onNavigate('messages')} />
      </div>

      <MobileChatOverlay currentUser={currentUser} />
    </div>
  );
}

