import React, { useState, useEffect, useRef } from 'react';
import { User } from '../App';
import { apiFetch } from '../apiFetch';
import { inboxSeenKey, inboxUnreadKey, saveSeenConversation, useUnreadBadges } from '../useUnreadBadges';
import {
  Search,
  Send as SendIcon,
  Image,
  File,
  Plus,
  Sparkles,
  Users,
  Bell,
  MessageSquare,
  BrainCircuit,
  Home,
  Shield,
  Lock,
  Trash2,
  Check,
  X,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { SearchResultsDropdown } from './SearchResultsDropdown';
import { AiChatComposer } from './AiChatComposer';

type MessagesPageProps = {
  gun: any;
  gunUser: any;
  currentUser: User;
  onViewProfile: (userId: string) => void;
  targetUserId?: string | null;
  demoConnections?: any[];
  onNavigate: (page: string) => void;
  onSearch: (query: string) => void;
  onQueryChange?: (query: string) => void;
  ragResults?: any;
  isSearching?: boolean;
};

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  type: string;
  fileName?: string;
}

interface Conversation {
  userId: string;
  userName: string;
  userAvatar: string;
  role?: 'INVESTOR' | 'FOUNDER';
  company?: string | null;
  firm?: string | null;
  headline?: string | null;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  roomKey?: string;
}

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

export function MessagesPage({ gun, gunUser, currentUser, onViewProfile, targetUserId, demoConnections = [], onNavigate, onSearch, onQueryChange, ragResults, isSearching }: MessagesPageProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(targetUserId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false); // Mobile search
  const [clearRequestPending, setClearRequestPending] = useState(false);
  const { unreadAlerts, unreadInbox } = useUnreadBadges(String(currentUser?.id || ''), currentUser.isDemo ? { incoming: [], accepted: [] } : undefined);

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



  const [currentRoomKey, setCurrentRoomKey] = useState<string | null>(null);
  const [currentConnectionId, setCurrentConnectionId] = useState<string | null>(null);

  // Investment Flow State
  const [showInvModal, setShowInvModal] = useState(false);
  const [invStatus, setInvStatus] = useState<'NONE' | 'PENDING' | 'MATCHED' | 'MISMATCH'>('NONE');
  const [invFormData, setInvFormData] = useState({ round: 'Seed', year: new Date().getFullYear().toString(), amount: '' });
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);
  const [isAiComposerOpen, setIsAiComposerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // File Inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [previewAttachment, setPreviewAttachment] = useState<{
    type: 'image' | 'file';
    content: string;
    name: string;
  } | null>(null);

  // 1. Fetch Conversations (Accepted Connections)
  useEffect(() => {
    void fetchConnections();
  }, [currentUser.id, currentUser.isDemo, demoConnections]);

  useEffect(() => {
    if (targetUserId && (!currentUser.isDemo || conversations.some(conversation => conversation.userId === targetUserId))) {
      setSelectedConversation(targetUserId);
      saveSeenConversation(String(currentUser.id), String(targetUserId));
    }
  }, [targetUserId, currentUser.id, currentUser.isDemo, conversations]);

  const fetchConnections = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      if (currentUser.isDemo) {
        let seenIds: string[] = [];
        let unreadIds: string[] = [];
        try { seenIds = JSON.parse(localStorage.getItem(inboxSeenKey(String(currentUser.id))) || '[]'); } catch { /* use empty seen list */ }
        try { unreadIds = JSON.parse(localStorage.getItem(inboxUnreadKey(String(currentUser.id))) || '[]'); } catch { /* use empty unread list */ }
        const mapped = demoConnections.filter(request => request.status === 'ACCEPTED').map((request: any) => {
          const isSender = String(request.senderId) === String(currentUser.id);
          const peerId = String(isSender ? request.receiverId : request.senderId);
          return {
            userId: peerId,
            userName: isSender ? request.receiverName : request.senderName,
            userAvatar: (isSender ? request.receiverAvatar : request.senderAvatar) || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
            role: String(isSender ? request.receiverRole : request.senderRole || '').toUpperCase() as 'INVESTOR' | 'FOUNDER',
            company: null,
            firm: null,
            headline: isSender ? request.receiverHeadline : request.senderHeadline,
            lastMessage: 'Start a conversation',
            timestamp: '',
            unread: !seenIds.includes(peerId) || unreadIds.includes(peerId)
          };
        }).filter((item: Conversation, index: number, all: Conversation[]) => all.findIndex(peer => peer.userId === item.userId) === index);
        setConversations(mapped);
        return;
      }
      const res = await apiFetch(`${apiUrl}/inbox`, {
        headers: { 'x-user-id': currentUser.id }
      });
      const data = await res.json();
      if (data && data.connections) {
        let seenIds: string[] = [];
        let unreadIds: string[] = [];
        try { seenIds = JSON.parse(localStorage.getItem(inboxSeenKey(String(currentUser.id))) || '[]'); } catch { /* use empty seen list */ }
        try { unreadIds = JSON.parse(localStorage.getItem(inboxUnreadKey(String(currentUser.id))) || '[]'); } catch { /* use empty unread list */ }
        const mapped = data.connections.map((c: any) => ({
          userId: String(c.other_user_id),
          userName: c.other_user_name || `User ${c.other_user_id}`,
          userAvatar: c.other_user_avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
          role: c.other_user_role as 'INVESTOR' | 'FOUNDER' | undefined,
          company: c.other_user_company || null,
          firm: c.other_user_firm || null,
          headline: c.other_user_headline || null,
          lastMessage: c.other_user_headline || 'Tap to chat',
          timestamp: '',
          unread: !seenIds.includes(String(c.other_user_id)) || unreadIds.includes(String(c.other_user_id))
        }));
        // Deduplicate by userId to prevent key warnings
        const unique = mapped.reduce((acc: any[], current: any) => {
          if (!acc.find(item => item.userId === current.userId)) {
            acc.push(current);
          }
          return acc;
        }, []);
        setConversations(unique);
      }
    } catch (e) { console.error(e); }
  };

  // 2. Initializing Chat & Listening to Messages
  useEffect(() => {
    if (!selectedConversation || !gun) return;

    let chatNode: any = null;
    const targetUserId = selectedConversation;

    const initChat = async () => {
      setMessages([]); // Clear previous
      console.log("initChat starting", { targetUserId, currentUser: currentUser.id });
      try {
        if (currentUser.isDemo) {
          const roomKey = `demo-${[String(currentUser.id), String(targetUserId)].sort().join('--')}`;
          setCurrentRoomKey(roomKey);
          setCurrentConnectionId(null);
          chatNode = gun.get('startupforge-demo-v1').get('messages').get(roomKey);
          chatNode.map().on((node: any, msgId: string) => {
            if (node && typeof node === 'object' && typeof node.text === 'string') processIncomingMessage(node, msgId);
          });
          return;
        }
        // Get Room Key from Backend
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const res = await apiFetch(`${apiUrl}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUser.id
          },
          body: JSON.stringify({ targetUserId: String(targetUserId) })
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("Failed to init chat", res.status, errText);
          throw new Error("Failed to init chat");
        }
        const { roomKey, connectionId } = await res.json();
        console.log("Got roomKey", roomKey, "connectionId", connectionId);
        setCurrentRoomKey(roomKey);
        setCurrentConnectionId(connectionId);

        // Subscribe to Gun
        chatNode = gun.get('chats').get(roomKey);

        chatNode.map().on((node: any, msgId: string) => {
          console.log('INCOMING MSG NODE:', node);
          if (!node || !node.text) return;
          processIncomingMessage(node, msgId);
        });

      } catch (e) { console.error(e); }
    };

    initChat();

    return () => {
      if (chatNode) chatNode.off();
    };
  }, [selectedConversation, gun, currentUser.id, currentUser.isDemo]);

  const demoConversationIds = currentUser.isDemo ? conversations.map(conversation => conversation.userId).join('|') : '';
  useEffect(() => {
    if (!currentUser.isDemo || !gun || !demoConversationIds) return;
    const nodes = conversations.map(conversation => ({
      conversation,
      node: gun.get('startupforge-demo-v1').get('messages').get(`demo-${[String(currentUser.id), String(conversation.userId)].sort().join('--')}`)
    }));
    nodes.forEach(({ conversation, node }) => node.map().on((message: any) => {
      if (!message || typeof message.text !== 'string' || message.type === 'request_clear' || message.type === 'accept_clear') return;
      const preview = message.type === 'image' ? 'Image' : message.type === 'file' ? (message.fileName || 'File') : message.text;
      setConversations(previous => previous.map(item => item.userId === conversation.userId ? {
        ...item,
        lastMessage: preview,
        timestamp: new Date(Number(message.ts) || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        unread: String(message.sender) !== String(currentUser.id) && selectedConversation !== conversation.userId
      } : item));
      if (String(message.sender) !== String(currentUser.id) && selectedConversation !== conversation.userId) {
        const key = inboxUnreadKey(String(currentUser.id));
        try {
          const ids = new Set<string>((JSON.parse(localStorage.getItem(key) || '[]') as string[]).map(String));
          ids.add(conversation.userId);
          localStorage.setItem(key, JSON.stringify([...ids]));
          window.dispatchEvent(new Event('startupforge:unread-changed'));
        } catch { /* Keep the inbox usable if local storage is blocked. */ }
      }
    }));
    return () => nodes.forEach(({ node }) => node.off());
  }, [currentUser.id, currentUser.isDemo, demoConversationIds, gun, selectedConversation]);

  // 3. Poll Investment Status (when chat is open)
  useEffect(() => {
    if (!currentConnectionId) return;

    const checkStatus = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const res = await apiFetch(`${apiUrl}/api/investments/status/${currentConnectionId}`, {
          headers: { 'x-user-id': currentUser.id }
        });
        const data = await res.json();

        if (data.status === 'PENDING') {
          setInvStatus('PENDING');
        } else if (data.status === 'MATCHED') {
          setInvStatus('MATCHED');
          if (data.deal) setInvFormData({ round: String(data.deal.round), year: String(data.deal.year), amount: String(data.deal.amount) });
        } else {
          setInvStatus('NONE');
        }
      } catch (e) { console.error(e); }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, [currentConnectionId, currentUser.id]);

  const downloadInvestmentAgreement = () => {
    if (invStatus !== 'MATCHED') return;
    const founder = currentUser.role === 'founder' ? currentUser : selectedUser;
    const investor = currentUser.role === 'investor' ? currentUser : selectedUser;
    const organizationOf = (person: User | Conversation | undefined) => {
      if (!person) return '';
      if ('company' in person && person.company?.trim()) return person.company.trim();
      if ('firm' in person && person.firm?.trim()) return person.firm.trim();
      if ('headline' in person && person.headline?.trim()) {
        return person.headline.trim().replace(/^(founder|investor)\s+(at|of)\s+/i, '');
      }
      if ('lastMessage' in person && person.lastMessage && person.lastMessage !== 'Tap to chat') return person.lastMessage;
      return '';
    };
    const ascii = (value: unknown) => String(value || 'To be agreed')
      .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2013\u2014]/g, '-').replace(/\u20ac/g, 'EUR').replace(/[^\x20-\x7e]/g, '?');
    const amount = Number(String(invFormData.amount).replace(/[^0-9.]/g, ''));
    const formattedAmount = Number.isFinite(amount) && amount > 0
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
      : ascii(invFormData.amount);
    const lines: { text: string; size: number; bold?: boolean; rule?: boolean }[] = [];
    const add = (text: string, size = 11, bold = false, rule = false) => lines.push({ text: ascii(text), size, bold, rule });
    const wrap = (text: string, size = 10) => {
      const value = ascii(text);
      const max = size >= 14 ? 64 : 88;
      const words = value.split(/\s+/);
      let row = '';
      for (const word of words) {
        if (row && `${row} ${word}`.length > max) { add(row, size); row = word; }
        else row = row ? `${row} ${word}` : word;
      }
      if (row) add(row, size);
    };

    add('STARTUPFORGE', 10, true);
    add('Agreed Investment Details', 20, true);
    add(`Record date: ${new Date().toLocaleDateString()}    Record ID: ${currentConnectionId || 'N/A'}`, 9);
    add('MATCHED BY BOTH PARTIES', 10, true, true);
    wrap('This record summarizes the investment details submitted by the founder and investor and matched on StartupForge. It records the fields below as entered; it does not add terms that were not submitted.', 10);
    add('FOUNDER', 12, true, true);
    add(`Name: ${founder?.name || founder?.userName || 'Not provided'}`);
    add(`Company: ${organizationOf(founder) || 'Organization not listed in profile'}`);
    add(`Profile: ${founder?.headline || 'Founder'}`);
    add('INVESTOR', 12, true, true);
    add(`Name: ${investor?.name || investor?.userName || 'Not provided'}`);
    add(`Company / firm: ${organizationOf(investor) || 'Organization not listed in profile'}`);
    add(`Profile: ${investor?.headline || 'Investor'}`);
    add('MATCHED INVESTMENT DETAILS', 12, true, true);
    add(`Funding round: ${invFormData.round}`);
    add(`Investment amount: ${formattedAmount}${Number.isFinite(amount) && amount > 0 ? ' USD' : ''}`);
    add(`Investment year: ${invFormData.year}`);
    add('Agreement status: Both parties submitted matching investment details.');
    add('Acknowledged in StartupForge by: Founder and investor');
    add('');
    wrap('This is a platform record of the matched details above. Any additional investment terms must be agreed and documented separately by the parties.', 9);
    const pageLines: typeof lines[] = [];
    for (let i = 0; i < lines.length; i += 38) pageLines.push(lines.slice(i, i + 38));
    const pageIds = pageLines.map((_, i) => 5 + i * 2);
    const objects: string[] = ['', '<< /Type /Catalog /Pages 2 0 R >>',
      `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
    pageLines.forEach((page, pageIndex) => {
      let y = 746;
      const commands: string[] = [];
      if (pageIndex > 0) {
        commands.push(`BT /F2 8 Tf 0.40 0.44 0.50 rg 54 764 Td (STARTUPFORGE - AGREED INVESTMENT DETAILS) Tj ET`);
        commands.push('0.78 0.82 0.88 RG 54 754 m 558 754 l S');
        y = 738;
      }
      for (const line of page) {
        if (line.rule) {
          y -= 5;
          commands.push(`0.78 0.82 0.88 RG 54 ${y} m 558 ${y} l S`);
          y -= 11;
        }
        if (line.text) {
          const font = line.bold ? 'F2' : 'F1';
          const safeText = line.text.replace(/([\\()])/g, '\\$1');
          commands.push(`BT /${font} ${line.size} Tf 0.10 0.14 0.22 rg 54 ${y} Td (${safeText}) Tj ET`);
        }
        y -= line.size + 4;
      }
      commands.push(`BT /F1 8 Tf 0.40 0.44 0.50 rg 54 34 Td (StartupForge - Matched details record - Page ${pageIndex + 1} of ${pageLines.length}) Tj ET`);
      const stream = commands.join('\n');
      const pageId = pageIds[pageIndex];
      const contentId = pageId + 1;
      objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0…11446 tokens truncated…rName: r.sender_name || `User ${r.sender_id}`,
          userHeadline: r.sender_headline || r.sender_role || 'Founder',
          userAvatar: r.sender_avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
          mutualConnections: 0
        }));
        setRequests(mapped);
      }
    } catch (e) {
      console.error("Failed to fetch requests", e);
    }
  };

  useEffect(() => {
    if (currentUser.id) {
      fetchRequests();
    }
  }, [currentUser.id, currentUser.isDemo, demoConnectionRequests]);

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
    if (onSearch) onSearch(searchQuery);
    setIsSearchExpanded(false);
  };

  const handleAcceptInternal = async (reqId: string) => {
    try {
      if (currentUser.isDemo) {
        await onRespondToDemoConnectionRequest?.(reqId, 'ACCEPTED');
        return;
      }
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await apiFetch(`${apiUrl}/connections/accept/${reqId}`, {
        method: 'POST',
        headers: { 'x-user-id': currentUser.id }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Accept request failed (${response.status})`);
      }
      await fetchRequests();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not accept the connection request.');
    }
  };

  const handleRejectInternal = async (reqId: string) => {
    try {
      await onRejectRequest(reqId);
      await fetchRequests();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not reject the connection request.');
    }
  };


  // --- Render Helpers ---

  const renderTopProfiles = (users: User[]) => (
    <div className="flex flex-row gap-4 overflow-x-auto pb-6 pt-2 custom-scrollbar px-1">
      {users.slice(0, 5).map((user) => (
        <div key={`${user.role || activeTab}-${user.id}`} className="flex flex-col items-center min-w-[100px] p-3 rounded-2xl hover:bg-white hover:shadow-lg transition-all duration-300 cursor-pointer group border border-transparent hover:border-slate-100 relative" onClick={() => onViewProfile(user.id)}>
          <div className="relative mb-3 transform group-hover:scale-105 transition-transform duration-300">
            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-md opacity-0 group-hover:opacity-20 transition-opacity"></div>
            <img
              src={user.avatar}
              alt={user.name}
              className="w-16 h-16 rounded-full border-[3px] border-white shadow-md object-cover relative z-10"
            />
            {isConnectedTo(user) && (
              <div className="absolute bottom-1 right-0 bg-emerald-500 border-[3px] border-white rounded-full p-0.5 z-20 shadow-sm">
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </div>
            )}
          </div>
          <span className="text-sm font-bold text-slate-800 text-center leading-tight line-clamp-1 w-full group-hover:text-indigo-600 transition-colors">{user.name}</span>
          <span className="text-[10px] font-semibold text-slate-400 text-center truncate w-full mt-1 bg-slate-50 px-2 py-0.5 rounded-full">{user.headline}</span>
        </div>
      ))}
    </div>
  );

  const renderUserCard = (user: User) => (
    <div key={`${user.role || activeTab}-${user.id}`} className="bg-white border border-slate-200/60 rounded-2xl p-4 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 hover:border-indigo-100 group hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-4 flex-1 min-w-0" onClick={() => onViewProfile(user.id)}>
          <div className="relative">
            <img src={user.avatar} alt={user.name} className="w-14 h-14 rounded-2xl object-cover border border-slate-100 shadow-sm group-hover:shadow-md transition-all cursor-pointer" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
              <div className={`w-2.5 h-2.5 rounded-full ${isConnectedTo(user) ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
            </div>
          </div>
          <div className="flex-1 min-w-0 py-0.5">
            <h4 className="font-bold text-slate-800 text-[15px] truncate group-hover:text-indigo-600 transition-colors cursor-pointer tracking-tight">{user.name}</h4>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs font-medium text-slate-500 line-clamp-1 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">{user.headline}</span>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <Users className="w-3 h-3 text-slate-400" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{user.connections} connections</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (user.id === currentUser.id || (user.role === currentUser.role && user.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase())) return;
            if (!isConnectedTo(user)) {
              void onFollowUser(
                user.id,
                user.role || (activeTab === 'investors' ? 'investor' : 'founder'),
                user.name,
                user.headline,
                user.company || ''
              ).then(sent => {
                if (sent && !currentUser.isDemo) (user as any).isConnected = true;
              });
            }
          }}
          disabled={user.id === currentUser.id || (user.role === currentUser.role && user.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) || isConnectedTo(user)}
          className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all shadow-sm flex-shrink-0 ${isConnectedTo(user)
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            : followedUsers.has(user.id)
              ? 'bg-slate-50 text-slate-400 border border-slate-200'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 hover:shadow-md'
            }`}
        >
          {isConnectedTo(user) ? <UserCheck className="w-5 h-5" /> : followedUsers.has(user.id) ? <Check className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      {/* --- Responsive Header --- */}
      <div className="bg-white px-4 md:px-8 py-3 md:py-6 shadow-sm border-b border-slate-100 z-50 flex-shrink-0 relative">
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
                  placeholder="Search people..."
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
                  onSelectResult={(id) => onViewProfile(id)}
                />
              </div>
            )}
          </div>

          {/* Desktop Nav Icons */}
          <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
            <ActionItem icon={<Home />} label="Home" onClick={() => onNavigate('home')} />
            <ActionItem icon={<Users />} label="Network" onClick={() => onNavigate('network')} active={true} />
            <ActionItem icon={<Bell />} label="Alerts" badge={unreadAlerts > 0} onClick={() => onNavigate('notifications')} />
            <ActionItem icon={<MessageSquare />} label="Inbox" badge={unreadInbox > 0} onClick={() => onNavigate('messages')} />
            <ActionItem icon={<BrainCircuit />} label="Deep Analysis" onClick={() => onNavigate('conflict-report')} />
          </div>
        </div>
      </div>

      {/* --- Main Network Content --- */}
      <div className="flex-1 overflow-y-auto w-full max-w-[1700px] mx-auto p-4 md:p-8 pb-24 md:pb-8 custom-scrollbar">

        {/* Invitations Section (If any) */}
        {requests.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-4 md:p-6 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 rounded-xl text-white"><UserPlus className="w-5 h-5" /></div>
                <h2 className="text-lg md:text-xl font-bold text-slate-900">Connections Pending</h2>
              </div>
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-indigo-200">{requests.length} New</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 relative z-10">
              {requests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 bg-slate-50/80 border border-slate-100 rounded-2xl hover:shadow-md transition-all hover:bg-white group">
                  <div className="flex items-center gap-4">
                    <img src={request.userAvatar} className="w-14 h-14 rounded-2xl object-cover shadow-sm" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{request.userName}</h4>
                      <p className="text-xs text-slate-500 font-medium bg-white px-2 py-0.5 rounded-md inline-block shadow-sm mt-1">{request.userHeadline}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleRejectInternal(request.id)} className="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 rounded-xl transition-colors shadow-sm"><X className="w-4 h-4" /></button>
                    <button onClick={() => handleAcceptInternal(request.id)} className="w-9 h-9 flex items-center justify-center bg-slate-900 text-white hover:bg-indigo-600 rounded-xl transition-all shadow-md hover:scale-105"><Check className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unified Tabbed Content (Compact & Inner Scroll) */}
        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col min-h-0 h-full">
          {/* Header with Tabs */}
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-sm z-20">
            <div className="flex items-center gap-4">
              <div className="flex bg-slate-100/80 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('founders')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'founders' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Founders
                </button>
                <button
                  onClick={() => setActiveTab('investors')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'investors' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Investors
                </button>
              </div>
              <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-slate-200">
                {activeTab === 'founders' ? <Users className="w-4 h-4 text-indigo-600" /> : <TrendingUp className="w-4 h-4 text-emerald-600" />}
                <div>
                  <h3 className="text-sm font-black tracking-tight text-slate-800 leading-none">{activeTab === 'founders' ? 'Founder Network' : 'Investor Network'}</h3>
                  <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">{activeTab === 'founders' ? 'Connect with fellow visionaries' : 'Find your next round'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable List Area */}
          <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-slate-50/30 custom-scrollbar">
            {/* Top Profiles Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4 px-1">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{activeTab === 'founders' ? 'Recently Active' : 'Top VCs & Angels'}</h4>
                <span className="h-px flex-1 bg-slate-200 ml-4"></span>
              </div>
              {renderTopProfiles(activeTab === 'founders' ? founders : investors)}
            </div>

            {/* Grid Grid */}
            <div>
              <div className="flex items-center justify-between mb-4 px-1">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{activeTab === 'founders' ? 'Discover Founders' : 'Explore Investors'}</h4>
                <span className="h-px flex-1 bg-slate-200 ml-4"></span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {(activeTab === 'founders' ? founders : investors).map(renderUserCard)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Mobile Bottom Nav --- */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 z-[80] flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.02)] safe-area-pb">
        <ActionItem icon={<Home />} label="Home" onClick={() => onNavigate('home')} />
        <ActionItem icon={<Users className="w-6 h-6" />} label="Network" onClick={() => onNavigate('network')} active={true} />
        <ActionItem icon={<BrainCircuit className="w-6 h-6" />} label="Analyze" onClick={() => onNavigate('conflict-report')} />
        <ActionItem icon={<Bell className="w-6 h-6" />} label="Alerts" badge={unreadAlerts > 0} onClick={() => onNavigate('notifications')} />
        <ActionItem icon={<MessageSquare className="w-6 h-6" />} label="Inbox" badge={unreadInbox > 0} onClick={() => onNavigate('messages')} />
      </div>

      {/* --- Profile Modal --- */}
      {showProfileModal && (
        <ProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onNavigate={onNavigate}
        />
      )}

      {/* --- Mobile Chat Overlay --- */}
      <MobileChatOverlay currentUser={currentUser} />
    </div>
  );
}

// --- Sub-components ---

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
          <h2 className="mt-3 text-xl font-bold text-gray-900">{currentUser.name}</h2>
          <p className="text-sm text-gray-500 mb-4">{currentUser.headline}</p>
          <button onClick={() => { onClose(); onNavigate('profile'); }} className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold transition-all shadow-lg">
            View Full Profile
          </button>
        </div>
      </div>
    </div>
  );
}

