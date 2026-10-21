import { useState, useEffect, useRef } from 'react';
import { User } from '../App';
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
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  X
} from 'lucide-react';

type MessagesPageProps = {
  gun: any;
  gunUser: any;
  currentUser: User;
  onViewProfile: (userId: string) => void;
  targetUserId?: string | null;
  onNavigate: (page: string) => void;
  onSearch: (query: string) => void;
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
  roomKey?: string; // We'll fetch this
}

// --- Sub-components for Header (Copied for consistency as per user request) ---
const ActionItem = ({ icon, label, badge = false, onClick }: { icon: any, label: string, badge?: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center text-slate-600 hover:text-white hover:bg-slate-900 p-2 rounded-xl transition-all group min-w-20 relative"
  >
    <div className="relative mb-0.5 transform group-hover:scale-105 transition-transform duration-200">
      {icon}
      {badge && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
    </div>
    <span className="text-xs font-medium tracking-wide group-hover:text-white">{label}</span>
  </button>
);

export function MessagesPage({ gun, gunUser, currentUser, onViewProfile, targetUserId, onNavigate, onSearch }: MessagesPageProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(targetUserId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');



  const [currentConnectionId, setCurrentConnectionId] = useState<number | null>(null);
  const [currentRoomKey, setCurrentRoomKey] = useState<string | null>(null);

  // Investment Flow State
  const [showInvModal, setShowInvModal] = useState(false);
  const [invStatus, setInvStatus] = useState<'NONE' | 'PENDING' | 'MATCHED' | 'MISMATCH'>('NONE');
  const [invFormData, setInvFormData] = useState({ round: 'Seed', year: new Date().getFullYear().toString(), amount: '' });
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);
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
      const res = await fetch('/inbox', {
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
        const res = await fetch('/chat', {
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
        const res = await fetch(`/api/investments/status/${currentConnectionId}`, {
          headers: { 'x-user-id': currentUser.id }
        });
        const data = await res.json();

        if (data.status === 'PENDING') {
          // If I haven't submitted yet, show notification to confirm.
          // If I have, show "Waiting for partner" (or keep bar but strictly informational)
          // For simplicity: Show bar if PENDING regardless
          setInvStatus('PENDING');
        } else if (data.status === 'MATCHED') {
          setInvStatus('MATCHED');
          // Clear after 5 seconds
          setTimeout(() => setInvStatus('NONE'), 5000);
        } else {
          setInvStatus('NONE');
        }
      } catch (e) { console.error(e); }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, [currentConnectionId, currentUser.id]);

  const handleReportInvestment = async () => {
    if (!currentConnectionId) return;
    try {
      await fetch('/api/investments/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: currentConnectionId })
      });
      setInvStatus('PENDING'); // Optimistic update
    } catch (e) { console.error(e); }
  };

  const submitInvestment = async () => {
    if (!currentConnectionId) return;
    try {
      const res = await fetch('/api/investments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: currentConnectionId,
          role: currentUser.role, // 'founder' | 'investor'
          data: invFormData
        })
      });
      const data = await res.json();

      if (data.status === 'MATCHED') {
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

  const selectedUser = conversations.find(c => c.userId === selectedConversation);

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      {/* --- Fixed Header (Copied from HomePage) --- */}
      <div className="bg-white px-8 py-6 shadow-sm border-b border-slate-100 z-50 flex-shrink-0">
        <div className="flex items-center justify-between gap-6 w-full h-24">

          {/* Profile */}
          <button
            onClick={() => onNavigate('profile')}
            className="flex items-center gap-4 hover:bg-slate-50 p-2 rounded-xl transition-all group flex-shrink-0 min-w-52"
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

          {/* Search */}
          <div className="flex-1 flex justify-center max-w-3xl px-8">
            <form onSubmit={handleHeaderSearchSubmit} className="relative w-full group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                <div className="bg-slate-800 p-2 rounded-xl">
                  <Sparkles className="h-5 w-5 text-white animate-pulse" />
                </div>
              </div>
              <input
                type="text"
                className="w-full pl-20 pr-20 py-4 bg-slate-900 border border-slate-700 focus:border-slate-500 focus:ring-4 focus:ring-slate-800 rounded-2xl text-base transition-all placeholder-white font-medium outline-none shadow-sm text-white hover:shadow-md hover:border-slate-600"
                placeholder="Ask anything..."
                value={headerSearchQuery}
                onChange={(e) => setHeaderSearchQuery(e.target.value)}
              />
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 text-xs">|</span>
                  <kbd className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 border border-slate-600 border-b-2 rounded-lg text-[10px] font-bold text-slate-300 tracking-wider">
                    ⌘ K
                  </kbd>
                </div>
              </div>
            </form>
          </div>

          {/* Icons */}
          <div className="flex items-center gap-8 flex-shrink-0">
            <ActionItem icon={<Home className="w-7 h-7" />} label="Home" onClick={() => onNavigate('home')} />
            <ActionItem icon={<Users className="w-7 h-7" />} label="Network" onClick={() => onNavigate('network')} />
            <ActionItem icon={<Bell className="w-7 h-7" />} label="Alerts" badge={false} onClick={() => onNavigate('notifications')} />
            <ActionItem icon={<MessageSquare className="w-7 h-7" />} label="Inbox" onClick={() => onNavigate('messages')} />
            <ActionItem icon={<BrainCircuit className="w-7 h-7" />} label="Deep Analysis" onClick={() => onNavigate('conflict-report')} />
          </div>
        </div>
      </div>

      {/* --- Main Content (Messages Layout) --- */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 overflow-hidden">
        <div className="bg-white rounded-lg border border-gray-200 h-full flex overflow-hidden shadow-sm">

          {/* Sidebar */}
          <div className="w-80 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl text-gray-900 mb-3">Messages - DEBUG</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search messages"
                  className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded border-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations
                .filter(c => c.userName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(conversation => (
                  <button
                    key={conversation.userId}
                    onClick={() => setSelectedConversation(conversation.userId)}
                    className={`w-full flex items-start gap-3 p-4 hover:bg-gray-50 text-left ${selectedConversation === conversation.userId ? 'bg-blue-50' : ''
                      } `}
                  >
                    <img src={conversation.userAvatar} alt="" className="w-12 h-12 rounded-full" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm text-gray-900 truncate">{conversation.userName}</h3>
                      </div>
                      <p className="text-sm text-gray-600 truncate mt-1">{conversation.lastMessage}</p>
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Chat Area */}
          {selectedConversation && selectedUser ? (
            <div className="flex-1 flex flex-col bg-[#0b141a]"> {/* WhatsApp Dark BG */}
              {/* Header */}
              <div className="p-4 bg-red-600 border-b border-[#2a3942] flex items-center justify-between text-[#e9edef]">
                <div className="flex items-center gap-3">
                  <img src={selectedUser.userAvatar} alt="" className="w-10 h-10 rounded-full" />
                  <h3 className="text-[#e9edef] font-medium">{selectedUser.userName}</h3>
                </div>

                {/* NEW: Report Investment Action */}
                <button
                  onClick={handleReportInvestment}
                  className="flex items-center gap-2 bg-[#005c4b] hover:bg-[#004f40] text-sm text-[#e9edef] px-3 py-1.5 rounded-lg transition-colors"
                  title="Report a new investment"
                >
                  <Briefcase className="w-4 h-4" />
                  <span className="hidden sm:inline">Report Inv.</span>
                </button>
              </div>

              {/* NEW: Persistent Notification Bar */}
              {invStatus === 'PENDING' && (
                <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-md z-10 animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-300" />
                    <span className="font-medium text-sm">Investment reported. Please confirm details to record this investment.</span>
                  </div>
                  <button
                    onClick={() => setShowInvModal(true)}
                    className="bg-white text-blue-700 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors shadow-sm"
                  >
                    Confirm Investment
                  </button>
                </div>
              )}
              {invStatus === 'MATCHED' && (
                <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-center shadow-md z-10 animate-in slide-in-from-top-2">
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  <span className="font-bold">Investment recorded and verified successfully.</span>
                </div>
              )}

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-[length:400px]">
                {messages.map(msg => {
                  const isMe = msg.senderId === currentUser.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} `}>
                      <div className={`max-w-[65%] rounded-lg px-3 py-2 text-sm relative shadow-sm ${isMe ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none' : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                        } `}>
                        {msg.type === 'text' && <p>{msg.content}</p>}
                        {msg.type === 'image' && <img src={msg.content} alt="Shared" className="rounded-lg max-w-full" />}
                        {msg.type === 'file' && (
                          <a
                            href={msg.content}
                            download={msg.fileName || 'download'}
                            className="flex items-center gap-2 bg-black/20 p-2 rounded hover:bg-black/30 transition-colors cursor-pointer text-inherit no-underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <File className="w-5 h-5" />
                            <span className="truncate hover:underline">{msg.fileName}</span>
                          </a>
                        )}
                        <p className="text-[10px] text-gray-400 text-right mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="bg-[#202c33] flex flex-col">
                {/* Preview Area */}
                {previewAttachment && (
                  <div className="p-3 bg-[#2a3942] border-b border-[#202c33] flex items-center justify-between mx-4 mt-2 rounded-t-lg">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {previewAttachment.type === 'image' ? (
                        <img src={previewAttachment.content} alt="Preview" className="h-16 w-16 object-cover rounded" />
                      ) : (
                        <div className="h-16 w-16 bg-black/20 flex items-center justify-center rounded">
                          <File className="w-8 h-8 text-[#e9edef]" />
                        </div>
                      )}
                      <span className="text-[#e9edef] text-sm truncate max-w-[200px]">{previewAttachment.name}</span>
                    </div>
                    <button onClick={cancelAttachment} className="p-1 hover:bg-white/10 rounded-full text-[#e9edef]">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}

                {/* Controls */}
                <div className="p-3 flex items-center gap-2">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className={`p-2 hover:bg-white/5 rounded-full ${previewAttachment ? 'text-gray-500 cursor-not-allowed' : 'text-[#8696a0]'}`}
                    disabled={!!previewAttachment}
                  >
                    <Image className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2 hover:bg-white/5 rounded-full ${previewAttachment ? 'text-gray-500 cursor-not-allowed' : 'text-[#8696a0]'}`}
                    disabled={!!previewAttachment}
                  >
                    <Plus className="w-6 h-6" />
                  </button>

                  <input
                    type="text"
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage(messageText)}
                    placeholder={previewAttachment ? "Add a caption (optional - not supported yet)" : "Type a message"}
                    disabled={!!previewAttachment}
                    className="flex-1 bg-[#2a3942] text-[#e9edef] rounded-lg px-4 py-2 focus:outline-none disabled:opacity-50"
                  />

                  <button
                    onClick={() => sendMessage(messageText)}
                    className="p-2 text-[#8696a0] hover:bg-white/5 rounded-full"
                  >
                    <SendIcon className="w-6 h-6" />
                  </button>

                  <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'image')} />
                  <input type="file" ref={fileInputRef} className="hidden" onChange={e => handleFileChange(e, 'file')} />
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[#222e35] text-[#8696a0]">
              <div className="text-center">
                <p className="text-lg">Select a chat to start messaging</p>
                <p className="text-sm mt-2">End-to-end encrypted</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Investment Confirmation Modal */}
      {showInvModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in zoom-in-95">
            <button onClick={() => setShowInvModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" />
              Confirm Investment
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Both parties must submit matching details to verify.
            </p>

            <div className="space-y-4">
              {/* Auto-filled names */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Startup</label>
                  <p className="font-medium text-gray-900 truncate">
                    {currentUser.role === 'founder' ? currentUser.company || currentUser.name : selectedUser?.userName}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Investor</label>
                  <p className="font-medium text-gray-900 truncate">
                    {currentUser.role === 'investor' ? currentUser.company || currentUser.name : selectedUser?.userName}
                  </p>
                </div>
              </div>

              {/* Inputs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Investment Round <span className="text-red-500">*</span></label>
                <select
                  value={invFormData.round}
                  onChange={e => setInvFormData({ ...invFormData, round: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option>Pre-seed</option>
                  <option>Seed</option>
                  <option>Series A</option>
                  <option>Series B</option>
                  <option>Series C+</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={invFormData.year}
                  onChange={e => setInvFormData({ ...invFormData, year: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Investment Amount <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={invFormData.amount}
                  onChange={e => setInvFormData({ ...invFormData, amount: e.target.value })}
                  placeholder="e.g. $1M or 1000000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Both parties must enter the exact same value to confirm.</p>
              </div>
            </div>

            {submissionFeedback && (
              <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${submissionFeedback.includes('Mismatch') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {submissionFeedback}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowInvModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors">
                Cancel
              </button>
              <button onClick={submitInvestment} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition-all">
                Submit Confirmation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
