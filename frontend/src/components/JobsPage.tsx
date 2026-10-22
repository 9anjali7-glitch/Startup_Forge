import { Search, MapPin, Briefcase, DollarSign, Filter, Bookmark, Home, Users, Bell, MessageSquare, BrainCircuit, Sparkles } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { MobileChatOverlay } from './common/MobileChatOverlay';
import { SearchResultsDropdown } from './SearchResultsDropdown';

type JobsPageProps = {
  currentUser?: any;
  onNavigate?: (page: string, userId?: string) => void;
  onSearch?: (query: string) => void;
  onQueryChange?: (query: string) => void;
  ragResults?: any;
  isSearching?: boolean;
};

// --- Sub-components for Header ---
const ActionItem = ({ icon, label, onClick, badge, active }: { icon: any, label: string, onClick?: () => void, badge?: boolean, active?: boolean }) => (
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

export function JobsPage({ currentUser, onNavigate, onSearch, onQueryChange, ragResults, isSearching }: JobsPageProps) {
  const [savedJobs, setSavedJobs] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem(`startupforge:saved-jobs:${currentUser?.id || 'guest'}`) || '[]')); } catch { return new Set(); } });
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem(`startupforge:applied-jobs:${currentUser?.id || 'guest'}`) || '[]')); } catch { return new Set(); } });
  const [jobTypeFilters, setJobTypeFilters] = useState<string[]>([]);
  const [workTypeFilters, setWorkTypeFilters] = useState<string[]>([]);
  const [experienceFilters, setExperienceFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false); // Mobile search

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

  const jobs = [
    {
      id: 'job-1',
      title: 'Senior Product Designer',
      company: 'Tech Corp',
      companyLogo: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=100&h=100&fit=crop',
      location: 'San Francisco, CA',
      salary: '$120k-$160k',
      type: 'Full-time',
      workType: 'Remote',
      postedDate: '2 days ago',
      applicants: 45,
      experience: 'Senior',
      description: 'We are looking for a talented Senior Product Designer to join our team...'
    },
    {
      id: 'job-2',
      title: 'UX/UI Designer',
      company: 'StartupXYZ',
      companyLogo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100&h=100&fit=crop',
      location: 'New York, NY',
      salary: '$100k-$140k',
      type: 'Full-time',
      workType: 'Hybrid',
      postedDate: '5 days ago',
      applicants: 78,
      experience: 'Mid-level',
      description: 'Join our growing startup as a UX/UI Designer and help shape our product...'
    },
    {
      id: 'job-3',
      title: 'Product Designer',
      company: 'Design Studio',
      companyLogo: 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=100&h=100&fit=crop',
      location: 'Austin, TX',
      salary: '$90k-$120k',
      type: 'Full-time',
      workType: 'On-site',
      postedDate: '1 week ago',
      applicants: 32,
      experience: 'Entry level',
      description: 'Creative product designer needed for innovative projects...'
    },
    {
      id: 'job-4',
      title: 'Lead UX Designer',
      company: 'Innovation Labs',
      companyLogo: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=100&h=100&fit=crop',
      location: 'Seattle, WA',
      salary: '$140k-$180k',
      type: 'Full-time',
      workType: 'Remote',
      postedDate: '3 days ago',
      applicants: 89,
      experience: 'Senior',
      description: 'Lead a team of talented designers and create amazing user experiences...'
    }
  ];

  const handleToggleSave = (jobId: string) => {
    const newSaved = new Set(savedJobs);
    if (newSaved.has(jobId)) {
      newSaved.delete(jobId);
    } else {
      newSaved.add(jobId);
    }
    setSavedJobs(newSaved);
    localStorage.setItem(`startupforge:saved-jobs:${currentUser?.id || 'guest'}`, JSON.stringify([...newSaved]));
  };
  const handleApply = (jobId: string) => {
    const next = new Set(appliedJobs); next.add(jobId); setAppliedJobs(next);
    localStorage.setItem(`startupforge:applied-jobs:${currentUser?.id || 'guest'}`, JSON.stringify([...next]));
  };
  const toggleFilter = (setter: React.Dispatch<React.SetStateAction<string[]>>, filters: string[], value: string) => {
    setter(filters.includes(value) ? filters.filter(item => item !== value) : [...filters, value]);
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = !location ||
      job.location.toLowerCase().includes(location.toLowerCase());
    const matchesType = jobTypeFilters.length === 0 || jobTypeFilters.includes(job.type);
    const matchesWorkType = workTypeFilters.length === 0 || workTypeFilters.includes(job.workType);
    const matchesExperience = experienceFilters.length === 0 || experienceFilters.includes(job.experience);
    return matchesSearch && matchesLocation && matchesType && matchesWorkType && matchesExperience;
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(searchQuery);
    setIsSearchExpanded(false);
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      {/* --- Responsive Header (Copied from HomePage) --- */}
      <div className="bg-white px-4 md:px-8 py-3 md:py-6 shadow-sm border-b border-slate-100 z-50 flex-shrink-0 relative">
        <div className="flex items-center justify-between gap-4 w-full h-14 md:h-24">

          {/* Desktop Profile */}
          <button
            onClick={() => onNavigate?.('profile')}
            className="hidden md:flex items-center gap-4 hover:bg-slate-50 p-2 rounded-xl transition-all group flex-shrink-0 min-w-52"
          >
            {currentUser && (
              <>
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
              </>
            )}
          </button>

          <button
            onClick={() => onNavigate?.('profile')}
            className="md:hidden flex-shrink-0"
          >
            {currentUser && <img src={currentUser.avatar} className="w-8 h-8 rounded-full border border-gray-200" />}
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
                  placeholder="Search jobs..."
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
                  onSelectResult={(id) => onNavigate?.('profile', id)}
                />
              </div>
            )}
          </div>

          {/* Desktop Nav Icons */}
          <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
            <ActionItem icon={<Home />} label="Home" onClick={() => onNavigate?.('home')} />
            <ActionItem icon={<Users />} label="Network" onClick={() => onNavigate?.('network')} />
            <ActionItem icon={<Bell />} label="Alerts" badge={false} onClick={() => onNavigate?.('notifications')} />
            <ActionItem icon={<MessageSquare />} label="Inbox" onClick={() => onNavigate?.('messages')} />
            <ActionItem icon={<BrainCircuit />} label="Deep Analysis" onClick={() => onNavigate?.('conflict-report')} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 px-0 md:px-4 py-0 md:py-6 pb-20 md:pb-4">
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6 p-4">

          {/* Left Sidebar - Filters (Hidden on Mobile for now, needs a toggle or dedicated page) */}
          <div className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-72 flex-shrink-0`}>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 sticky top-6">
              <h3 className="text-gray-900 mb-4 flex items-center gap-2 font-bold">
                <Filter className="w-5 h-5 text-slate-500" />
                Filters
              </h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Job type</label>
                  <div className="space-y-2.5">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={jobTypeFilters.includes('Full-time')} onChange={() => toggleFilter(setJobTypeFilters, jobTypeFilters, 'Full-time')} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">Full-time</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={jobTypeFilters.includes('Part-time')} onChange={() => toggleFilter(setJobTypeFilters, jobTypeFilters, 'Part-time')} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">Part-time</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={jobTypeFilters.includes('Contract')} onChange={() => toggleFilter(setJobTypeFilters, jobTypeFilters, 'Contract')} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">Contract</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Work type</label>
                  <div className="space-y-2.5">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={workTypeFilters.includes('Remote')} onChange={() => toggleFilter(setWorkTypeFilters, workTypeFilters, 'Remote')} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">Remote</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={workTypeFilters.includes('Hybrid')} onChange={() => toggleFilter(setWorkTypeFilters, workTypeFilters, 'Hybrid')} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">Hybrid</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={workTypeFilters.includes('On-site')} onChange={() => toggleFilter(setWorkTypeFilters, workTypeFilters, 'On-site')} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">On-site</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Experience level</label>
                  <div className="space-y-2.5">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={experienceFilters.includes('Entry level')} onChange={() => toggleFilter(setExperienceFilters, experienceFilters, 'Entry level')} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">Entry level</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={experienceFilters.includes('Mid-level')} onChange={() => toggleFilter(setExperienceFilters, experienceFilters, 'Mid-level')} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">Mid-level</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={experienceFilters.includes('Senior')} onChange={() => toggleFilter(setExperienceFilters, experienceFilters, 'Senior')} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">Senior</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <button type="button" onClick={() => setShowFilters(value => !value)} className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 lg:hidden"><Filter className="h-4 w-4" />{showFilters ? 'Hide filters' : 'Show filters'}</button>
            {/* Search Bar (Secondary, specific to Jobs) */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 shadow-sm hidden md:block">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, skill, or company"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm font-medium"
                  />
                </div>
                <div className="flex-1 relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, state, or zip code"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm font-medium"
                  />
                </div>
                <button type="button" onClick={() => onSearch?.(searchQuery)} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-colors shadow-sm shadow-indigo-200">Search</button>
              </div>
            </div>

            {/* Job Preferences Banner */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 mb-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm text-indigo-600">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-slate-900 font-bold text-lg">Example job listings</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                    These sample listings demonstrate search and filters. Applications and saved jobs are stored on this device only.
                  </p>
                  <button type="button" onClick={() => document.querySelector<HTMLInputElement>('input[placeholder="Search by title, skill, or company"]')?.focus()} className="mt-3 px-5 py-2 bg-white text-indigo-700 border border-indigo-200 rounded-full hover:bg-slate-50 text-sm font-bold shadow-sm transition-all">Search jobs</button>
                </div>
              </div>
            </div>

            {/* Jobs List */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 px-1">
                {filteredJobs.length} jobs found
              </h2>

              {filteredJobs.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No sample jobs match. Clear a filter or try another search.</div> : filteredJobs.map(job => (
                <div key={job.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex gap-4">
                    <img
                      src={job.companyLogo}
                      alt={job.company}
                      className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover border border-slate-100"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg md:text-xl font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                            {job.title}
                          </h3>
                          <p className="text-slate-600 font-medium mt-0.5">{job.company}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleSave(job.id); }}
                          className={`p-2 rounded-full hover:bg-slate-50 transition-colors ${savedJobs.has(job.id) ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'
                            }`}
                        >
                          <Bookmark className="w-5 h-5" fill={savedJobs.has(job.id) ? 'currentColor' : 'none'} />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-3 mt-3 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {job.location}
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                          {job.salary}
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          {job.type}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${job.workType === 'Remote' ? 'bg-emerald-100 text-emerald-700' :
                          job.workType === 'Hybrid' ? 'bg-purple-100 text-purple-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                          {job.workType}
                        </span>
                        <span className="text-xs font-bold px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                          {job.type}
                        </span>
                      </div>

                      <p className="text-sm text-slate-600 mt-3 line-clamp-2">{job.description}</p>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                        <p className="text-xs font-medium text-slate-400">
                          {job.applicants} applicants • Posted {job.postedDate}
                        </p>
                        <button type="button" onClick={() => handleApply(job.id)} disabled={appliedJobs.has(job.id)} className="px-6 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:bg-emerald-600 disabled:cursor-default text-sm font-bold shadow-sm shadow-indigo-200 transition-all">{appliedJobs.has(job.id) ? 'Applied on this device' : 'Mark as applied'}</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- Mobile Bottom Nav --- */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 z-[80] flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.02)] safe-area-pb">
        <ActionItem icon={<Home />} label="Home" onClick={() => onNavigate?.('home')} />
        <ActionItem icon={<Users className="w-6 h-6" />} label="Network" onClick={() => onNavigate?.('network')} />
        <ActionItem icon={<BrainCircuit className="w-6 h-6" />} label="Analyze" onClick={() => onNavigate?.('conflict-report')} />
        <ActionItem icon={<Bell className="w-6 h-6" />} label="Alerts" badge={true} onClick={() => onNavigate?.('notifications')} />
        <ActionItem icon={<MessageSquare className="w-6 h-6" />} label="Inbox" onClick={() => onNavigate?.('messages')} />
      </div>

      <MobileChatOverlay currentUser={currentUser} />
    </div>
  );
}
