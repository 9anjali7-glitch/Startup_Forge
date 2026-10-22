import { useState, useEffect, useRef } from 'react'; // Refresh
import Gun from 'gun/gun';
import 'gun/sea';
import 'gun/axe';

// Components
import { HomePage } from './components/HomePage';
import { ProfilePage } from './components/ProfilePage';
import { NavigationBar } from './components/NavigationBar';
import { MessagesPage } from './components/MessagesPage';
import { NetworkPage } from './components/NetworkPage';
import { NotificationsPage } from './components/NotificationsPage';
import { JobsPage } from './components/JobsPage';
import { CreatePostModal } from './components/CreatePostModal';
import ConflictReportPage from './components/ConflictReportPage';
import { LandingPage } from './components/LandingPage';
import { Toaster } from './components/ui/sonner';

// Import Data
import foundersData from './data/founders.json';
import investorsData from './data/investors.json';
export type User = {
  id: string;
  name: string;
  headline: string;
  avatar: string;
  coverImage: string;
  connections: number;
  about: string;
  experience: string;
  education: string;
  role?: string;
  // Enhanced Profile Data
  pastInvestments?: string;
  investmentStage?: string;
  primaryDomain?: string;
  secondaryDomain?: string;
  website?: string;
  linkedin?: string;
  isActive?: boolean;
  company?: string;
  location?: string;
  // Prediction Data
  valuation?: number;
  fundingYear?: number;
  fundingRound?: string;
  competitors?: string[];
  umbrella?: string[];
};

const getInvestorProfile = (userId: string): User | undefined => {
  if (!userId.startsWith('investor-')) return undefined;
  const investorId = Number(userId.slice('investor-'.length));
  const investor = (investorsData as any[]).find((entry) => entry.id === investorId);
  if (!investor) return undefined;
  return {
    id: userId,
    name: investor.name,
    headline: investor.headline || investor.firm_name,
    avatar: investor.avatar,
    coverImage: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&h=400',
    connections: 0,
    about: `${investor.name} is listed in the StartupForge investor directory.`,
    experience: investor.firm_name,
    education: 'Not provided',
    role: 'investor',
    company: investor.firm_name,
  };
};

export type Comment = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  timestamp: string;
};

export type Post = {
  id: string;
  userId: string;
  userName: string;
  userHeadline: string;
  userAvatar: string;
  content: string;
  image?: string;
  attachment?: { type: 'video' | 'document'; data: string; name: string };
  likes: number;
  comments: Comment[];
  reposts: number;
  timestamp: string;
  liked: boolean;
  saved: boolean;
};

export type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'voice' | 'image' | 'file';
  fileName?: string;
};

export type Conversation = {
  userId: string;
  userName: string;
  userAvatar: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
};

export type ConnectionRequest = {
  id: string;
  userId: string;
  userName: string;
  userHeadline: string;
  userAvatar: string;
  mutualConnections: number;
  // Backend fields
  sender_id?: string;
  sender_role?: string;
  message?: string;
};



// --- Main App ---
function App() {
  // Gun State
  const [gun, setGun] = useState<any>(null);
  const [gunUser, setGunUser] = useState<any>(null);
  const [userPair, setUserPair] = useState<any>(null); // SEA Keypair

  // UI State
  const [targetChatUserId, setTargetChatUserId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState<'home' | 'profile' | 'messages' | 'network' | 'notifications' | 'jobs' | 'conflict-report'>('home');
  const [viewingUserId, setViewingUserId] = useState<string>('current-user');
  const [history, setHistory] = useState<string[]>(['home']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [extraSearchResults, setExtraSearchResults] = useState<User[]>([]);
  const [fetchedUser, setFetchedUser] = useState<User | null>(null);

  // RAG Search State
  const [isSearching, setIsSearching] = useState(false);
  const [ragResults, setRagResults] = useState<{ founders: { text: string; id: string }[], investors: { text: string; id: string }[] }>({ founders: [], investors: [] });
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  // COI State
  const [coiTarget, setCoiTarget] = useState<{ investor: string; company: string } | null>(null);

  // Domain State
  const [connectedUsers, setConnectedUsers] = useState<Set<string>>(new Set());
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);

  const [currentUser, setCurrentUser] = useState<User>({
    id: '',
    name: '',
    headline: 'Startup Founder',
    avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    coverImage: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&h=400&fit=crop',
    connections: 0,
    about: 'Waiting for bio...',
    experience: '-',
    education: '-'
  });

  // Hardcoded placeholders for now, will replace with API data
  const [users, setUsers] = useState<User[]>([
    {
      id: '2',
      name: 'Bill Gates',
      headline: 'Co-chair, Bill & Melinda Gates Foundation',
      avatar: 'https://cdn-icons-png.flaticon.com/512/147/147144.png',
      role: 'investor',
      connections: 500,
      coverImage: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200',
      about: 'Philanthropist',
      experience: 'Microsoft',
      education: 'Harvard (Dropped out)'
    },
    {
      id: '3',
      name: 'Elon Musk',
      headline: 'CEO of Tesla, SpaceX',
      avatar: 'https://cdn-icons-png.flaticon.com/512/147/147142.png',
      role: 'founder',
      connections: 1000,
      coverImage: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200',
      about: 'Mars Colonizer',
      experience: 'Zip2, PayPal, Tesla, SpaceX',
      education: 'UPenn'
    },
    {
      id: '4',
      name: 'Sam Altman',
      headline: 'CEO of OpenAI',
      avatar: 'https://cdn-icons-png.flaticon.com/512/147/147140.png',
      role: 'founder',
      connections: 800,
      coverImage: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200',
      about: 'Building AGI',
      experience: 'Y Combinator',
      education: 'Stanford (Dropped out)'
    }
  ]);


  const [posts, setPosts] = useState<Post[]>([
    {
      id: 'post-1',
      userId: 'user-1',
      userName: 'Michael Chen',
      userHeadline: 'Software Engineer at Google | Full Stack Developer',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
      content: '🚀 Excited to share that our team just launched a new feature that improves page load times by 40%! Big thanks to everyone involved. #webdev #performance',
      image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=500&fit=crop',
      likes: 234,
      comments: [],
      reposts: 18,
      timestamp: '2h ago',
      liked: false,
      saved: false
    },
    {
      id: 'post-2',
      userId: 'user-2',
      userName: 'Emily Rodriguez',
      userHeadline: 'Marketing Director | Brand Strategy | Digital Marketing Expert',
      userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
      content: 'Just wrapped up an amazing brand strategy workshop with the team. The key to successful branding? Consistency, authenticity, and knowing your audience inside out. What are your top branding tips?',
      likes: 189,
      comments: [],
      reposts: 12,
      timestamp: '5h ago',
      liked: true,
      saved: false
    },
    {
      id: 'post-3',
      userId: 'user-3',
      userName: 'David Park',
      userHeadline: 'Data Scientist | AI & Machine Learning | Python Expert',
      userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
      content: 'Working on a fascinating ML project that predicts customer behavior with 92% accuracy. The power of data never ceases to amaze me! 📊 #datascience #machinelearning',
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=500&fit=crop',
      likes: 312,
      comments: [],
      reposts: 24,
      timestamp: '1d ago',
      liked: false,
      saved: false
    }
  ]);




  const [conversations, setConversations] = useState<Conversation[]>([
    {
      userId: 'user-1',
      userName: 'Michael Chen',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
      lastMessage: 'Thanks for the connection!',
      timestamp: '2h ago',
      unread: true
    },
    {
      userId: 'user-2',
      userName: 'Emily Rodriguez',
      userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
      lastMessage: 'Would love to discuss the project',
      timestamp: '1d ago',
      unread: false
    }
  ]);

  const [messages, setMessages] = useState<{ [key: string]: Message[] }>({
    'user-1': [
      {
        id: 'msg-1',
        senderId: 'user-1',
        receiverId: 'current-user',
        content: 'Thanks for the connection!',
        timestamp: '2h ago',
        type: 'text'
      }
    ],
    'user-2': [
      {
        id: 'msg-2',
        senderId: 'user-2',
        receiverId: 'current-user',
        content: 'Would love to discuss the project',
        timestamp: '1d ago',
        type: 'text'
      }
    ]
  });



  const navigateTo = (page: 'home' | 'profile' | 'messages' | 'network' | 'notifications' | 'jobs' | 'conflict-report', userId?: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(page === 'profile' && userId ? `profile-${userId}` : page);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentPage(page);
    if (userId) {
      setViewingUserId(userId);
    }
  };

  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const target = history[newIndex];
      if (target === 'home') {
        setCurrentPage('home');
      } else if (target === 'messages') {
        setCurrentPage('messages');
      } else if (target === 'network') {
        setCurrentPage('network');
      } else if (target === 'notifications') {
        setCurrentPage('notifications');
      } else if (target === 'jobs') {
        setCurrentPage('jobs');
      } else if (target.startsWith('profile-')) {
        setCurrentPage('profile');
        setViewingUserId(target.replace('profile-', ''));
      }
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const target = history[newIndex];
      if (target === 'home') {
        setCurrentPage('home');
      } else if (target === 'messages') {
        setCurrentPage('messages');
      } else if (target === 'conflict-report') {
        setCurrentPage('conflict-report');
      } else if (target === 'network') {
        setCurrentPage('network');
      } else if (target === 'notifications') {
        setCurrentPage('notifications');
      } else if (target === 'jobs') {
        setCurrentPage('jobs');
      } else if (target.startsWith('profile-')) {
        setCurrentPage('profile');
        setViewingUserId(target.replace('profile-', ''));
      }
    }
  };

  const handleLikePost = (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          liked: !post.liked,
          likes: post.liked ? post.likes - 1 : post.likes + 1
        };
      }
      return post;
    }));
  };

  // --- Connection Request Logic ---
  const handleSendConnectionRequest = async (targetUserId: string, targetRole = 'founder') => {
    console.log("targetUserId =", targetUserId);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/connections/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          sender_id: currentUser.id,
          sender_role: currentUser.role,
          receiver_id: String(targetUserId),
          receiver_role: targetRole,
          message: `Hi, I'd like to connect!`
        })
      });

      if (res.ok) {
        // Optimistically update UI or show success
        const newFollowed = new Set(followedUsers);
        newFollowed.add(targetUserId);
        setFollowedUsers(newFollowed);
        alert("Connection request sent!");
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error}`);
      }
    } catch (e) { console.error(e); alert("Network error"); }
  };

  const handleUpdateProfile = (updatedUser: User) => {
    setCurrentUser(updatedUser);
  };

  const handleAddComment = (postId: string, content: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        const newComment: Comment = {
          id: `comment-${Date.now()}`,
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          content,
          timestamp: 'Just now'
        };
        return {
          ...post,
          comments: [...post.comments, newComment]
        };
      }
      return post;
    }));
  };

  const handleSavePost = (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return { ...post, saved: !post.saved };
      }
      return post;
    }));
  };

  const handleRepost = (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return { ...post, reposts: post.reposts + 1 };
      }
      return post;
    }));
  };

  const handleUnfollow = (userId: string) => {
    const newFollowed = new Set(followedUsers);
    newFollowed.delete(userId);
    setFollowedUsers(newFollowed);
  };

  const handleCreatePost = (content: string, image?: string, attachment?: Post['attachment']) => {
    const newPost: Post = {
      id: `post-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userHeadline: currentUser.headline,
      userAvatar: currentUser.avatar,
      content,
      image,
      attachment,
      likes: 0,
      comments: [],
      reposts: 0,
      timestamp: 'Just now',
      liked: false,
      saved: false
    };
    setPosts([newPost, ...posts]);
  };

  const handleAcceptRequest = (requestId: string) => {
    setConnectionRequests(connectionRequests.filter(req => req.id !== requestId));
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/connections/reject/${requestId}`, {
        method: 'POST', headers: { 'x-user-id': currentUser.id }
      });
      if (res.ok) setConnectionRequests(connectionRequests.filter(req => req.id !== requestId));
      else console.error('Failed to reject connection request:', await res.text());
    } catch (err) { console.error('Failed to reject connection request', err); }
  };

  const handleSendMessage = (userId: string, content: string, type: 'text' | 'voice' | 'image' | 'file' = 'text', fileName?: string) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId: 'current-user',
      receiverId: userId,
      content,
      timestamp: 'Just now',
      type,
      fileName
    };

    setMessages({
      ...messages,
      [userId]: [...(messages[userId] || []), newMessage]
    });

    // Update conversation
    setConversations(conversations.map(conv => {
      if (conv.userId === userId) {
        return { ...conv, lastMessage: content, timestamp: 'Just now' };
      }
      return conv;
    }));
  };

  // --- RAG SEARCH INTEGRATION ---
  const performSearch = async (query: string) => {
    setIsSearching(true);
    setRagResults({ founders: [], investors: [] });

    try {
      // Parallel fetch
      // Parallel fetch - ASSUMING RAG IS ON SEPARATE PORT 8000 LOCALLY BUT SHOULD BE MAPPED IN PROD
      // If RAG is a separate service, we need VITE_RAG_API_URL or similar.
      // For now, let's keep localhost:8000 if not defined, but ideally this should be env var.
      const ragUrl = import.meta.env.VITE_RAG_API_URL || 'http://127.0.0.1:8000';
      const [foundersRes, investorsRes] = await Promise.all([
        fetch(`${ragUrl}/search/founders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, top_k: 5 })
        }).catch(err => { console.error("Founders Fetch Err:", err); return null; }),
        fetch(`${ragUrl}/search/investors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, top_k: 5 })
        }).catch(err => { console.error("Investors Fetch Err:", err); return null; })
      ]);

      let fResults = [];
      let iResults = [];

      if (foundersRes && foundersRes.ok) {
        const data = await foundersRes.json();
        fResults = data.results || [];
      }

      if (investorsRes && investorsRes.ok) {
        const data = await investorsRes.json();
        iResults = data.results || [];
      }

      setRagResults({
        founders: fResults,
        investors: iResults
      });

    } catch (err) {
      console.error("RAG Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleQueryChange = (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setRagResults({ founders: [], investors: [] });
      return;
    }

    if (timeoutId.current) clearTimeout(timeoutId.current);
    timeoutId.current = setTimeout(() => {
      performSearch(query);
    }, 500);
  };

  const handleSearch = (query: string) => {
    if (timeoutId.current) clearTimeout(timeoutId.current);
    performSearch(query);
  };

  const filteredUsers = searchQuery
    ? [
      ...users.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.headline.toLowerCase().includes(searchQuery.toLowerCase())
      ),
      ...extraSearchResults
    ]
    : [];

  // --- Dynamic Profile Fetching ---
  useEffect(() => {
    if (viewingUserId === 'current-user') {
      setFetchedUser(null);
      return;
    }

    const localUser = users.find(u => u.id === viewingUserId) || extraSearchResults.find(u => u.id === viewingUserId) || getInvestorProfile(viewingUserId);
    if (!localUser) {
      // Fetch from API
      console.log(`Fetching profile for: ${viewingUserId}`);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      fetch(`${apiUrl}/api/users/${viewingUserId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setFetchedUser(data.user);
          }
        })
        .catch(err => console.error("Error fetching user profile:", err));
    } else {
      setFetchedUser(null);
    }
  }, [viewingUserId, users, extraSearchResults]);

  const viewingUser = viewingUserId === 'current-user'
    ? currentUser
    : (users.find(u => u.id === viewingUserId) || extraSearchResults.find(u => u.id === viewingUserId) || getInvestorProfile(viewingUserId) || fetchedUser || currentUser);

  const isOwnProfile = viewingUserId === 'current-user';

  // --- Init Gun on Mount ---
  useEffect(() => {
    // We could init gun here or in the login handler. 
    // For this flow, let's init in login handler to keep it simple.
  }, []);

  const handleAppLogin = (id: string, role: string, name: string) => {
    // 1. Init Gun
    // 1. Init Gun with backend URL
    // 1. Init Gun with backend URL
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const gunUrl = import.meta.env.VITE_GUN_URL || (apiUrl + '/gun');
    const gunInstance = Gun([gunUrl]);
    setGun(gunInstance);

    const user = gunInstance.user();
    // For auth alias, we stick to the stable ID to ensure continuity even if name display changes
    const alias = `forge_secure_${id}`;
    const pass = `pass_${id}_for_startup_forge_2025`;

    user.auth(alias, pass, (ack: any) => {
      if (ack.err) {
        // Try create
        user.create(alias, pass, (reg: any) => {
          if (reg.err) {
            // Handle existing user overlap or error
            if (reg.err.includes("already exists")) {
              // Retry auth just in case
              user.auth(alias, pass, () => finishLogin(id, role, name, user));
            } else {
              alert(reg.err);
            }
          } else {
            user.auth(alias, pass, () => finishLogin(id, role, name, user));
          }
        });
      } else {
        finishLogin(id, role, name, user);
      }
    });

    function finishLogin(id: string, role: string, name: string, user: any) {
      setGunUser(user);
      setIsLoggedIn(true);
      // Use the Real Name from DB
      setCurrentUser(prev => ({
        ...prev,
        id,
        name: name,
        headline: `${role === 'investor' ? 'Investor' : 'Founder'} at Startup Forge`,
        role
      }));

      // Load Inbox logic here potentially
      // loadInbox(id, role);
    }
  };

  if (!isLoggedIn) {
    return <LandingPage onLogin={handleAppLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster />
      {currentPage !== 'home' && currentPage !== 'network' && currentPage !== 'notifications' && currentPage !== 'messages' && currentPage !== 'conflict-report' && currentPage !== 'profile' && (
        <NavigationBar
          canGoBack={historyIndex > 0}
          canGoForward={historyIndex < history.length - 1}
          onBack={goBack}
          onForward={goForward}
          currentPage={currentPage}
          onNavigate={(page) => {
            if (page === 'home') {
              navigateTo('home');
            } else if (page === 'profile') {
              navigateTo('profile', 'current-user');
            } else if (page === 'messages') {
              navigateTo('messages');
            } else if (page === 'network') {
              navigateTo('network');
            } else if (page === 'notifications') {
              navigateTo('notifications');
            } else if (page === 'jobs') {
              navigateTo('jobs');
            }
          }}
          onSearch={handleSearch}
          searchResults={filteredUsers}
          onSelectUser={(userId) => navigateTo('profile', userId)}
        />
      )}

      {currentPage === 'home' && (
        <HomePage
          currentUser={currentUser}
          onNavigate={(page, userId) => {
            if (page === 'network') navigateTo('network');
            else if (page === 'notifications') navigateTo('notifications');
            else if (page === 'messages') navigateTo('messages');
            else if (page === 'profile') navigateTo('profile', userId || 'current-user');
            else if (page === 'conflict-report') navigateTo('conflict-report');
            else if (page === 'jobs') navigateTo('jobs');
            else if (page === 'home') navigateTo('home');
          }}
          onSearch={handleSearch}
          onQueryChange={handleQueryChange}
          ragResults={ragResults}
          isSearching={isSearching}
          onCheckConflict={(investor, company) => {
            setCoiTarget({ investor, company });
            navigateTo('conflict-report');
          }}
        />
      )}

      {currentPage === 'profile' && (
        <ProfilePage
          user={viewingUser}
          isOwnProfile={isOwnProfile}
          isFollowing={followedUsers.has(viewingUserId)}
          onUpdateProfile={handleUpdateProfile}
          onFollowUser={() => handleSendConnectionRequest(viewingUserId, viewingUser.role)}
          userPosts={posts.filter(p => p.userId === viewingUserId)}
          onViewConflictReport={() => navigateTo('conflict-report')}
          currentUser={currentUser}
          onNavigate={(page, id) => {
            if (page === 'home') navigateTo('home');
            else if (page === 'profile') navigateTo('profile', id || 'current-user');
            else if (page === 'network') navigateTo('network');
            else if (page === 'notifications') navigateTo('notifications');
            else if (page === 'messages') navigateTo('messages');
            else if (page === 'conflict-report') navigateTo('conflict-report');
            else navigateTo(page as any);
          }}
          onSearch={handleSearch}
          onQueryChange={handleQueryChange}
          ragResults={ragResults}
          isSearching={isSearching}
        />
      )}

      {currentPage === 'conflict-report' && (
        <ConflictReportPage
          currentUser={currentUser}
          onNavigate={(page, userId) => {
            if (userId) navigateTo('profile', userId);
            else if (page.startsWith('profile:')) navigateTo('profile', page.slice('profile:'.length));
            else if (page === 'network') navigateTo('network');
            else if (page === 'notifications') navigateTo('notifications');
            else if (page === 'messages') navigateTo('messages');
            else if (page === 'profile') navigateTo('profile', 'current-user');
            else if (page === 'conflict-report') navigateTo('conflict-report');
            else if (page === 'jobs') navigateTo('jobs');
            else navigateTo('home');
          }}
          onSearch={handleSearch}
          onQueryChange={handleQueryChange}
          ragResults={ragResults}
          isSearching={isSearching}
          onBack={goBack}
          currentInvestorName={coiTarget?.investor || (currentUser.role === 'investor' ? currentUser.name : '')}
          targetCompanyName={coiTarget?.company || (currentUser.role === 'founder' ? currentUser.company || '' : (viewingUser.id !== currentUser.id ? viewingUser.company || viewingUser.name : ''))}
        />
      )}

      {currentPage === 'messages' && (
        <MessagesPage
          // Pass Gun instance and user for real-time logic
          gun={gun}
          gunUser={gunUser}
          currentUser={currentUser}
          onViewProfile={(userId) => navigateTo('profile', userId)}
          targetUserId={targetChatUserId}
          onNavigate={(page) => {
            if (page === 'home') navigateTo('home');
            else if (page === 'profile') navigateTo('profile', 'current-user');
            else if (page === 'messages') navigateTo('messages');
            else if (page === 'network') navigateTo('network');
            else if (page === 'notifications') navigateTo('notifications');
            else if (page === 'conflict-report') navigateTo('conflict-report');
          }}
          onSearch={handleSearch}
          onQueryChange={handleQueryChange}
          ragResults={ragResults}
          isSearching={isSearching}
        />
      )}

      {currentPage === 'network' && (
        <NetworkPage
          currentUser={currentUser}
          suggestedUsers={users}
          founders={foundersData.map((f: any, i: number) => ({
            id: `founder-${i}`,
            name: f.name,
            headline: f.headline || f.company,
            avatar: f.avatar,
            connections: Math.floor(Math.random() * 500) + 50
          }))}
          investors={investorsData.map((i: any) => ({
            id: `investor-${i.id}`,
            name: i.name,
            headline: i.headline || i.firm_name,
            avatar: i.avatar,
            connections: Math.floor(Math.random() * 500) + 50
          }))}
          followedUsers={followedUsers}
          connectedUsers={connectedUsers}
          onAcceptRequest={handleAcceptRequest}
          onRejectRequest={handleRejectRequest}
          onFollowUser={handleSendConnectionRequest}
          onViewProfile={(userId) => navigateTo('profile', userId)}
          onNavigate={(page, userId) => {
            if (userId) navigateTo('profile', userId);
            else if (page.startsWith('profile:')) navigateTo('profile', page.slice('profile:'.length));
            else if (page === 'network') navigateTo('network');
            else if (page === 'notifications') navigateTo('notifications');
            else if (page === 'messages') navigateTo('messages');
            else if (page === 'profile') navigateTo('profile', 'current-user');
            else if (page === 'conflict-report') navigateTo('conflict-report');
            else if (page === 'jobs') navigateTo('jobs');
            else if (page === 'home') navigateTo('home');
          }}
          onSearch={handleSearch}
          onQueryChange={handleQueryChange}
          ragResults={ragResults}
          isSearching={isSearching}
        />
      )}

      {currentPage === 'notifications' && (
        <NotificationsPage
          currentUser={currentUser}
          onViewJob={(jobId) => navigateTo('jobs')}
          onNavigate={(page, userId) => {
            if (userId) navigateTo('profile', userId);
            else if (page.startsWith('profile:')) navigateTo('profile', page.slice('profile:'.length));
            else if (page === 'network') navigateTo('network');
            else if (page === 'notifications') navigateTo('notifications');
            else if (page === 'messages') navigateTo('messages');
            else if (page === 'profile') navigateTo('profile', 'current-user');
            else if (page === 'conflict-report') navigateTo('conflict-report');
            else if (page === 'jobs') navigateTo('jobs');
            else if (page === 'home') navigateTo('home');
          }}
          onSearch={handleSearch}
          onQueryChange={handleQueryChange}
          ragResults={ragResults}
          isSearching={isSearching}
          onNavigateToChat={(userId) => {
            setTargetChatUserId(userId);
            navigateTo('messages');
          }}
        />
      )}

      {currentPage === 'jobs' && (
        <JobsPage
          currentUser={currentUser}
          onNavigate={(page, userId) => {
            if (userId) navigateTo('profile', userId);
            else if (page.startsWith('profile:')) navigateTo('profile', page.slice('profile:'.length));
            else if (page === 'network') navigateTo('network');
            else if (page === 'notifications') navigateTo('notifications');
            else if (page === 'messages') navigateTo('messages');
            else if (page === 'profile') navigateTo('profile', 'current-user');
            else if (page === 'conflict-report') navigateTo('conflict-report');
            else if (page === 'jobs') navigateTo('jobs');
            else if (page === 'home') navigateTo('home');
          }}
          onSearch={handleSearch}
          onQueryChange={handleQueryChange}
          ragResults={ragResults}
          isSearching={isSearching}
        />
      )}

      {showCreatePost && (
        <CreatePostModal
          currentUser={currentUser}
          users={users}
          onClose={() => setShowCreatePost(false)}
          onPost={handleCreatePost}
        />
      )}
    </div>
  );
}

export default App;
