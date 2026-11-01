import React, { useState, useEffect, useRef } from 'react';
import { User } from '../App';
import { apiFetch } from '../apiFetch';
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

type MessagesPageProps = {
  gun: any;
  gunUser: any;
  currentUser: User;
  onViewProfile: (userId: string) => void;
  targetUserId?: string | null;
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

export function MessagesPage({ gun, gunUser, currentUser, onViewProfile, targetUserId, onNavigate, onSearch, onQueryChange, ragResults, isSearching }: MessagesPageProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(targetUserId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false); // Mobile search
  const [clearRequestPending, setClearRequestPending] = useState(false);

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
  const [isGenerating, setIsGenerating] = useState(false);
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
    fetchConnections();
  }, []);

  useEffect(() => {
    if (targetUserId) {
      setSelectedConversation(targetUserId);
    }
  }, [targetUserId]);

  const fetchConnections = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await apiFetch(`${apiUrl}/inbox`, {
        headers: { 'x-user-id': currentUser.id }
      });
      const data = await res.json();
      if (data && data.connections) {
        const mapped = data.connections.map((c: any) => ({
          userId: String(c.other_user_id),
          userName: c.other_user_name || `User ${c.other_user_id}`,
          userAvatar: c.other_user_avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
          lastMessage: c.other_user_headline || 'Tap to chat',
          timestamp: '',
          unread: false
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
  }, [selectedConversation, gun, currentUser.id]);

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
    add(`Company: ${founder?.company || 'Not provided'}`);
    add(`Profile: ${founder?.headline || 'Founder'}`);
    add('INVESTOR', 12, true, true);
    add(`Name: ${investor?.name || investor?.userName || 'Not provided'}`);
    add(`Company / firm: ${investor?.company || 'Not provided'}`);
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
      objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (let id = 1; id < objects.length; id++) {
      offsets[id] = pdf.length;
      pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const companySlug = ascii(founder?.company || founder?.userName || 'startup').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    link.href = url;
    link.download = `StartupForge_Agreed_Investment_Details_${companySlug || 'startup'}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const handleReportInvestment = async () => {
    if (!currentConnectionId) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await apiFetch(`${apiUrl}/api/investments/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ connectionId: currentConnectionId })
      });
      setInvStatus('PENDING'); // Optimistic update
    } catch (e) { console.error(e); }
  };

  const submitInvestment = async () => {
    if (!currentConnectionId) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await apiFetch(`${apiUrl}/api/investments/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          connectionId: currentConnectionId,
          role: currentUser.role, // 'founder' | 'investor'
          data: invFormData
        })
      });
      const data = await res.json();

      if (data.status === 'MATCHED') {
        setInvStatus('MATCHED');
        if (data.deal) setInvFormData({ round: String(data.deal.round), year: String(data.deal.year), amount: String(data.deal.amount) });
        setSubmissionFeedback("Investment Confirmed!");
        setTimeout(() => {
          setShowInvModal(false);
          setSubmissionFeedback(null);
        }, 1500);
      } else if (data.mismatch) {
        setSubmissionFeedback("Mismatch! details do not match partner's submission.");
      } else {
        setSubmissionFeedback("Submitted! Waiting for partner to confirm.");
        setTimeout(() => {
          setShowInvModal(false);
          setSubmissionFeedback(null);
        }, 1500);
      }
    } catch (e) { console.error(e); }
  };

  const processIncomingMessage = async (node: any, id: string) => {
    // 1. Handle Clear Requests
    if (node.type === 'request_clear') {
      if (node.sender !== currentUser.id) {
        setClearRequestPending(true);
      }
      return;
    }

    // 2. Handle Clear Confirmation (Actual Delete)
    if (node.type === 'accept_clear') {
      setMessages([]);
      setClearRequestPending(false);
      return;
    }

    // Check if message already exists
    setMessages(prev => {
      if (prev.find(m => m.id === id)) return prev;

      const content = typeof node.text === 'string' && node.text.startsWith('SEA') ? 'Encrypted Message' : node.text;

      return [...prev, {
        id,
        senderId: String(node.sender),
        content: content,
        timestamp: node.ts,
        type: node.type || 'text',
        fileName: node.fileName
      }].sort((a, b) => a.timestamp - b.timestamp);
    });

    // Scroll to bottom
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const requestClearChat = () => {
    if (!currentRoomKey || !gun) return;
    const payload = {
      sender: currentUser.id,
      text: "REQUEST_CLEAR",
      type: 'request_clear',
      ts: Date.now()
    };
    gun.get('chats').get(currentRoomKey).set(payload);
    // Optimistically show pending state or just wait? 
    // Usually only receiver needs to know. 
    // But we should maybe show "Waiting for confirmation"
    alert("Clear request sent. Waiting for other user to accept.");
  };

  const confirmClearChat = () => {
    if (!currentRoomKey || !gun) return;

    // 1. Send Accept Message (Trigger for both clients to wipe)
    const payload = {
      sender: currentUser.id,
      text: "ACCEPT_CLEAR",
      type: 'accept_clear',
      ts: Date.now()
    };
    gun.get('chats').get(currentRoomKey).set(payload);

    // 2. Actually Nullify Data (Best Effort)
    gun.get('chats').get(currentRoomKey).map().once((msg: any, key: string) => {
      gun.get('chats').get(currentRoomKey).get(key).put(null);
    });

    setClearRequestPending(false);
  };

  const cancelClearRequest = () => {
    setClearRequestPending(false);
  };

  const sendMessage = async (content?: string) => {
    console.log('CLICK SEND', {
      currentRoomKey,
      content,
      previewAttachment,
      gun: !!gun
    });
    if (!currentRoomKey || !gun) {
      console.error("Missing RoomKey or Gun instance", { currentRoomKey, gun: !!gun });
      return;
    }

    // Determine payload based on whether we have an attachment or text
    let finalContent = content;
    let finalType = 'text';
    let finalFileName = undefined;

    if (previewAttachment) {
      finalContent = previewAttachment.content;
      finalType = previewAttachment.type;
      finalFileName = previewAttachment.name;
    } else if (!content || !content.trim()) {
      return; // Nothing to send
    }

    const payload = {
      sender: currentUser.id,
      text: finalContent,
      type: finalType,
      ts: Date.now(),
      fileName: finalFileName || null // Gun doesn't like undefined
    };

    console.log('SENT PAYLOAD', payload);
    gun.get('chats').get(currentRoomKey).set(payload);
    setMessageText('');
    setPreviewAttachment(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result as string;
      setPreviewAttachment({
        type,
        content: b64,
        name: file.name
      });
      // Reset input so same file can be selected again if needed (after cancel)
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const cancelAttachment = () => {
    setPreviewAttachment(null);
  };

  const handleHeaderSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(headerSearchQuery);
  };

  const handleAutocomplete = async () => {
    if (messages.length === 0) return;
    setIsGenerating(true);
    try {
      const history = messages.map(m => ({
        isMe: m.senderId === currentUser.id,
        content: m.content
      }));

      const ragUrl = import.meta.env.VITE_RAG_API_URL || 'http://localhost:8000';
      const res = await apiFetch(`${ragUrl}/chat/autocomplete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          history,
          userContext: `Role: ${currentUser.headline || 'User'}. Name: ${currentUser.name}`
        })
      });

      const data = await res.json();
      if (data.reply) {
        setMessageText(data.reply);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedUser = conversations.find(c => c.userId === selectedConversation);

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      {/* --- Responsive Header --- */}
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
              <span className="text-lg font-bold text-slate-900 leading-tight group-hover:text-slate-700 transition-colors">{currentUser.name}</span>
              <span className="text-xs text-slate-500 font-medium">View Profile</span>
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
            <form onSubmit={(e) => { handleHeaderSearchSubmit(e); setIsSearchExpanded(false); }} className="relative w-full group search-container">
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
                  placeholder="Search messages..."
                  value={headerSearchQuery}
                  onChange={(e) => {
                    setHeaderSearchQuery(e.target.value);
                    if (onQueryChange) onQueryChange(e.target.value);
                  }}
                />
                <div className="hidden md:flex absolute inset-y-0 right-4 items-center pointer-events-none z-50">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs">|</span>
                    <kbd className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 border border-slate-600 border-b-2 rounded-lg text-[10px] font-bold text-slate-300 tracking-wider">
                      âŒ˜ K
                    </kbd>
                  </div>
                </div>
              </div>
            </form>
            {/* RAG Search Results Dropdown */}
            {headerSearchQuery.length >= 2 && ragResults && (
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
            <ActionItem icon={<Users />} label="Network" onClick={() => onNavigate('network')} />
            <ActionItem icon={<Bell />} label="Alerts" badge={true} onClick={() => onNavigate('notifications')} />
            <ActionItem icon={<MessageSquare />} label="Inbox" onClick={() => onNavigate('messages')} active={true} />
            <ActionItem icon={<BrainCircuit />} label="Deep Analysis" onClick={() => onNavigate('conflict-report')} />
          </div>
        </div>
      </div>

      {/* --- Main Content (Messages Layout) --- */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-0 md:px-4 py-0 md:py-4 pb-20 md:pb-4 overflow-hidden h-full">
        <div className="bg-white md:rounded-[2rem] border-x-0 md:border border-slate-200 h-full flex overflow-hidden shadow-none md:shadow-xl ring-0 md:ring-1 ring-slate-100/50">

          {/* Sidebar */}
          <div className={`w-full md:w-80 border-r border-slate-100 flex-col bg-slate-50/50 ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Messages</h2>
                <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded-full border border-emerald-100 shadow-sm" title="End-to-End Encrypted">
                  <Lock className="w-2.5 h-2.5 text-emerald-600" />
                  <span className="text-[9px] font-bold text-emerald-700 tracking-wide">SECURE</span>
                </div>
              </div>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-100 focus:border-slate-300 text-sm transition-all placeholder-slate-400 font-medium shadow-sm"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1 custom-scrollbar">
              {conversations.length === 0 ? (
                <div className="p-5 text-center text-sm text-slate-500">No accepted connections yet. Connect with someone from Network to start a conversation.</div>
              ) : conversations.filter(c => c.userName.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                <div className="p-5 text-center text-sm text-slate-500">No conversations match “{searchQuery}”.</div>
              ) : conversations
                .filter(c => c.userName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(conversation => (
                  <button
                    key={conversation.userId}
                    onClick={() => setSelectedConversation(conversation.userId)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all duration-200 border border-transparent ${selectedConversation === conversation.userId
                      ? 'bg-white shadow-md border-slate-100 ring-1 ring-slate-50 scale-[1.02]'
                      : 'hover:bg-white hover:shadow-sm hover:border-slate-100 text-slate-600'
                      } `}
                  >
                    <img src={conversation.userAvatar} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className={`text-sm font-bold truncate ${selectedConversation === conversation.userId ? 'text-slate-900' : 'text-slate-700'}`}>{conversation.userName}</h3>
                        {conversation.unread && <span className="w-2 h-2 bg-blue-500 rounded-full ring-2 ring-white"></span>}
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${selectedConversation === conversation.userId ? 'text-slate-500 font-medium' : 'text-slate-400 opacity-80'}`}>{conversation.lastMessage}</p>
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Chat Area */}
          {selectedConversation && selectedUser ? (
            <div className={`flex-1 flex-col bg-white ${selectedConversation ? 'flex' : 'hidden md:flex'}`}>
              {/* Header */}
              <div className="grid grid-cols-[auto_1fr_auto] items-center z-10 sticky top-0 px-4 md:px-6 py-3 bg-white/80 backdrop-blur-sm border-b border-slate-100">

                {/* Left: User Info */}
                <div className="justify-self-start flex items-center gap-3">
                  {/* Back Button for Mobile */}
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="md:hidden p-1.5 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="relative group cursor-pointer">
                    <img src={selectedUser.userAvatar} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-bold text-sm leading-tight">{selectedUser.userName}</h3>
                    <div className="flex items-center gap-1">
                      <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                      <span className="text-slate-400 text-[10px] font-medium">Encrypted</span>
                    </div>
                  </div>
                </div>

                {/* Center: Report Button (Hidden on small mobile if needed, or compact) */}
                <div className="justify-self-center hidden sm:block">
                  <button
                    onClick={handleReportInvestment}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-full shadow-lg shadow-indigo-200 transition-all font-bold text-xs uppercase tracking-wider animate-pulse ring-4 ring-indigo-50"
                  >
                    <Briefcase className="w-4 h-4" />
                    Report Investment
                  </button>
                </div>
                {/* Mobile Report Icon only */}
                <div className="justify-self-center sm:hidden">
                  <button onClick={handleReportInvestment} className="p-2 bg-indigo-600 text-white rounded-full shadow-md"><Briefcase className="w-4 h-4" /></button>
                </div>


                {/* Right: Actions */}
                <div className="justify-self-end flex flex-col items-end gap-2">
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100 group cursor-help hover:border-slate-200 transition-colors">
                    <Shield className="w-4 h-4 text-emerald-500 fill-emerald-50" />
                    <span className="text-xs font-bold text-slate-600 group-hover:text-emerald-700 transition-colors uppercase tracking-wide">Decentralized Chat</span>
                  </div>
                  <button
                    onClick={requestClearChat}
                    className="text-xs font-bold flex items-center gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors"
                    title="Request to Clear Chat"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Clear Chat</span>
                  </button>
                </div>
              </div>

              {/* NEW: Persistent Notification Bar */}
              {invStatus === 'PENDING' && (
                <div className="bg-blue-50/80 backdrop-blur-sm border-b border-blue-100 px-4 py-3 flex items-center justify-between animate-in slide-in-from-top-2 z-0">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-blue-100 rounded-full">
                      <AlertTriangle className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-medium text-sm text-blue-800">Investment reported. Confirm details to record this deal.</span>
                  </div>
                  <button
                    onClick={() => setShowInvModal(true)}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Confirm Details
                  </button>
                </div>
              )}
              {invStatus === 'MATCHED' && (
                <div className="bg-emerald-50/80 backdrop-blur-sm border-b border-emerald-100 px-4 py-3 flex items-center justify-center animate-in slide-in-from-top-2 z-0">
                  <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" />
                  <span className="font-bold text-emerald-800 text-sm">Investment details matched by both parties.</span>
                  <button onClick={downloadInvestmentAgreement} className="ml-3 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">Download matched details PDF</button>
                </div>
              )}

              {/* Clear Request Banner */}
              {clearRequestPending && (
                <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-900">Clear Chat Request</p>
                      <p className="text-xs text-red-700">Other user wants to permanently erase this chat.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={cancelClearRequest}
                      className="p-2 bg-white border border-red-200 text-slate-600 rounded-lg hover:bg-slate-50 text-xs font-bold transition-colors"
                    >
                      Decline
                    </button>
                    <button
                      onClick={confirmClearChat}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm text-xs font-bold transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      Accept & Erase
                    </button>
                  </div>
                </div>
              )}

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 scroll-smooth">
                {messages.map(msg => {
                  const isMe = msg.senderId === currentUser.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`
                        max-w-[85%] md:max-w-[70%] rounded-3xl px-4 md:px-5 py-2.5 text-sm relative shadow-sm transition-all
                        ${isMe
                          ? 'bg-slate-900 text-white rounded-br-sm'
                          : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm shadow-sm'
                        }
                      `}>
                        {msg.type === 'text' && <p className="leading-relaxed break-words">{msg.content}</p>}
                        {msg.type === 'image' && <img src={msg.content} alt="Shared" className="rounded-lg max-w-full hover:opacity-95 transition-opacity cursor-pointer" />}
                        {msg.type === 'file' && (
                          <a
                            href={msg.content}
                            download={msg.fileName || 'download'}
                            className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer text-inherit no-underline ${isMe ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-50 hover:bg-slate-100'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <div className={`p-2 rounded-lg ${isMe ? 'bg-white/20' : 'bg-slate-200'}`}>
                              <File className="w-5 h-5" />
                            </div>
                            <span className="truncate font-medium hover:underline">{msg.fileName}</span>
                          </a>
                        )}
                        <p className={`text-[10px] mt-2 text-right opacity-70 ${isMe ? 'text-slate-300' : 'text-slate-400'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="bg-white p-3 border-t border-slate-100 pb-24 md:pb-3">
                {/* Preview Area */}
                {previewAttachment && (
                  <div className="p-2 bg-slate-50 border border-slate-200 flex items-center justify-between mb-2 rounded-2xl mx-1">
                    <div className="flex items-center gap-3 overflow-hidden ml-1">
                      {previewAttachment.type === 'image' ? (
                        <img src={previewAttachment.content} alt="Preview" className="h-10 w-10 object-cover rounded-xl border border-slate-200" />
                      ) : (
                        <div className="h-10 w-10 bg-slate-200 flex items-center justify-center rounded-xl">
                          <File className="w-5 h-5 text-slate-500" />
                        </div>
                      )}
                      <span className="text-slate-700 text-xs font-bold truncate max-w-[200px]">{previewAttachment.name}</span>
                    </div>
                    <button onClick={cancelAttachment} className="p-1 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      className={`p-2.5 rounded-full transition-all duration-200 ${previewAttachment ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 hover:scale-105 active:scale-95'}`}
                      disabled={!!previewAttachment}
                      title="Upload Image"
                    >
                      <Image className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`hidden sm:block p-2.5 rounded-full transition-all duration-200 ${previewAttachment ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 hover:scale-105 active:scale-95'}`}
                      disabled={!!previewAttachment}
                      title="Upload File"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                    <button
                      onClick={handleAutocomplete}
                      className={`p-2.5 rounded-full transition-all duration-200 ${isGenerating ? 'animate-pulse text-purple-500 bg-purple-50' : 'text-slate-400 hover:bg-purple-50 hover:text-purple-600 hover:scale-105 active:scale-95'}`}
                      disabled={isGenerating || !!previewAttachment}
                      title="AI Autocomplete"
                    >
                      <Sparkles className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={messageText}
                      onChange={e => setMessageText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendMessage(messageText)}
                      placeholder={previewAttachment ? "Add a caption..." : "Message securely..."}
                      disabled={!!previewAttachment}
                      className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 rounded-full px-5 py-3 border border-transparent focus:bg-white focus:border-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all font-medium text-sm"
                    />
                  </div>

                  <button
                    onClick={() => sendMessage(messageText)}
                    className={`p-3 rounded-full shadow-md transform transition-all duration-200 flex items-center justify-center ${!messageText && !previewAttachment ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white hover:bg-slate-800 hover:scale-105 active:scale-95'}`}
                    disabled={!messageText && !previewAttachment}
                  >
                    <SendIcon className="w-5 h-5" />
                  </button>

                  <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'image')} />
                  <input type="file" ref={fileInputRef} className="hidden" onChange={e => handleFileChange(e, 'file')} />
                </div>

                {/* Security Footer */}
                <div className="mt-2 py-1 flex items-center justify-center gap-1.5 select-none opacity-60 hover:opacity-100 transition-opacity">
                  <Lock className="w-2.5 h-2.5 text-slate-400" />
                  <p className="text-[9px] text-slate-400 font-medium tracking-wide">
                    End-to-End Encrypted via <span className="font-semibold">Decentralized Ledger</span>
                  </p>
                </div>
              </div>

            </div>
          ) : (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-slate-50 text-slate-400">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                <MessageSquare className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-lg font-medium text-slate-600">No chat selected</p>
              <p className="text-sm mt-2 max-w-xs text-center text-slate-500">Choose a person from the sidebar to start messaging securely.</p>
            </div>
          )}
        </div>
      </div >

      {/* --- Mobile Bottom Nav --- */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 z-[80] flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.02)] safe-area-pb">
        <ActionItem icon={<Home />} label="Home" onClick={() => onNavigate('home')} />
        <ActionItem icon={<Users className="w-6 h-6" />} label="Network" onClick={() => onNavigate('network')} />
        <ActionItem icon={<BrainCircuit className="w-6 h-6" />} label="Analyze" onClick={() => onNavigate('conflict-report')} />
        <ActionItem icon={<Bell className="w-6 h-6" />} label="Alerts" badge={true} onClick={() => onNavigate('notifications')} />
        <ActionItem icon={<MessageSquare className="w-6 h-6" />} label="Inbox" onClick={() => onNavigate('messages')} active={true} />
      </div>

      {/* Investment Confirmation Modal */}
      {
        showInvModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 relative animate-in zoom-in-95 ring-1 ring-white/50">
              <button onClick={() => setShowInvModal(false)} className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                  <Briefcase className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">
                  Confirm Investment
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Both parties must submit identical details (Round, Year, Amount) to verify this transaction on the ledger.
                </p>
              </div>

              <div className="space-y-5">
                {/* Auto-filled names */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Startup</label>
                    <p className="font-bold text-slate-900 truncate text-sm">
                      {currentUser.role === 'founder' ? currentUser.company || currentUser.name : selectedUser?.userName}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Investor</label>
                    <p className="font-bold text-slate-900 truncate text-sm">
                      {currentUser.role === 'investor' ? currentUser.company || currentUser.name : selectedUser?.userName}
                    </p>
                  </div>
                </div>

                {/* Inputs */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Investment Round</label>
                    <div className="relative">
                      <select
                        value={invFormData.round}
                        onChange={e => setInvFormData({ ...invFormData, round: e.target.value })}
                        className="w-full appearance-none bg-white rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all text-slate-700 hover:border-slate-300"
                      >
                        <option>Pre-seed</option>
                        <option>Seed</option>
                        <option>Series A</option>
                        <option>Series B</option>
                        <option>Series C+</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Year</label>
                      <input
                        type="number"
                        value={invFormData.year}
                        onChange={e => setInvFormData({ ...invFormData, year: e.target.value })}
                        className="w-full bg-white rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all placeholder-slate-400 text-slate-700 hover:border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Amount (USD)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                        <input
                          type="text"
                          value={invFormData.amount}
                          onChange={e => setInvFormData({ ...invFormData, amount: e.target.value })}
                          placeholder="e.g. 1000000"
                          className="w-full bg-white rounded-xl border border-slate-200 pl-7 pr-4 py-2.5 text-sm font-medium focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all placeholder-slate-400 text-slate-700 hover:border-slate-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {submissionFeedback && (
                <div className={`mt-5 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${submissionFeedback.includes('Mismatch') ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                  {submissionFeedback.includes('Mismatch') ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {submissionFeedback}
                </div>
              )}

              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => setShowInvModal(false)}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitInvestment}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-200 hover:shadow-xl hover:shadow-slate-200 transition-all transform active:scale-95"
                >
                  Confirm & Record
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
