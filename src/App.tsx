import { useState, useCallback, useRef, useEffect } from 'react';
import { Menu, LogOut, User as UserIcon } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Logo } from './components/Logo';
import { HomeView } from './components/HomeView';
import { ResultView } from './components/ResultView';
import { SearchBox } from './components/SearchBox';
import { DiscoverView } from './components/DiscoverView';
import { LibraryView } from './components/LibraryView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { LoginView } from './components/LoginView';
import { ViewState, SearchState, Source, LogEntry, FileContent, HistoryItem, LibraryItem, ChatMessage, UserProfile, SearchMode } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { generateResponse } from './services/llmService';
import { auth, db, logOut } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, serverTimestamp, setDoc, onSnapshot, orderBy, updateDoc, getDoc } from 'firebase/firestore';
import { ProfileModal } from './components/ProfileModal';

export default function App() {
  const [user, loading, error] = useAuthState(auth);
  
  useEffect(() => {
    console.log('Current Auth User:', user?.uid || 'No user');
    console.log('Auth Loading:', loading);
    console.log('Auth Error:', error?.message || 'No error');
  }, [user, loading, error]);

  const [view, setView] = useState<ViewState>('home');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Initialize profile from auth user immediately
  useEffect(() => {
    if (user && !userProfile) {
      setUserProfile({
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'User',
        photoURL: user.photoURL || undefined,
        plan: 'free'
      });
    }
  }, [user]);

  // Handle window resize for sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [searchState, setSearchState] = useState<SearchState>({
    conversationId: undefined,
    query: '',
    messages: [],
    logs: [],
    status: 'Ready',
    isGenerating: false,
    relatedQuestions: [],
    mode: 'search'
  });

  // Sync user profile to Firestore
  // Load from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('atlus_history');
    const savedLibrary = localStorage.getItem('atlus_library');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Error parsing saved history:', e);
      }
    }
    if (savedLibrary) {
      try {
        setLibrary(JSON.parse(savedLibrary));
      } catch (e) {
        console.error('Error parsing saved library:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      
      // Real-time profile listener
      const unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        } else {
          // Initialize profile if it doesn't exist
          const initialProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'User',
            photoURL: user.photoURL || undefined,
            plan: 'free',
            createdAt: new Date().toISOString(),
          };
          setDoc(userRef, initialProfile);
          setUserProfile(initialProfile);
        }
      }, (error) => {
        console.error('Profile subscription error:', error);
      });

      // Sync user profile to Firestore (last login)
      setDoc(userRef, {
        lastLogin: serverTimestamp()
      }, { merge: true });

      // Subscribe to conversations (new format)
      const conversationsQuery = query(
        collection(db, 'users', user.uid, 'conversations'),
        orderBy('lastUpdated', 'desc')
      );
      
      // Subscribe to legacy chat history (old format)
      const legacyHistoryQuery = query(
        collection(db, 'users', user.uid, 'chat_history'),
        orderBy('timestamp', 'desc')
      );

      const formatTimestamp = (ts: any) => {
        if (ts && typeof ts === 'object' && 'toDate' in ts) {
          return ts.toDate().toLocaleString();
        } else if (ts && typeof ts === 'string') {
          try {
            const date = new Date(ts);
            if (!isNaN(date.getTime())) return date.toLocaleString();
          } catch (e) {}
        }
        return ts || 'Unknown date';
      };

      let currentConversations: HistoryItem[] = [];
      let currentLegacyItems: HistoryItem[] = [];

      const updateMergedHistory = () => {
        const merged = [...currentConversations];
        
        // Add legacy items only if they don't exist as conversations (simple check by query/title)
        currentLegacyItems.forEach(legacy => {
          const exists = merged.some(conv => 
            conv.title === legacy.title || 
            (conv.messages.length > 0 && conv.messages[0].content === legacy.messages[0].content)
          );
          if (!exists) {
            merged.push(legacy);
          }
        });

        // Sort by last updated / timestamp
        merged.sort((a, b) => {
          const dateA = new Date(a.lastUpdated || a.timestamp).getTime();
          const dateB = new Date(b.lastUpdated || b.timestamp).getTime();
          return dateB - dateA;
        });

        setHistory(merged);
        try {
          // 2026 "Lightweight Sync": Strip heavy source content before saving to localStorage
          const lightweightHistory = merged.map(item => ({
            ...item,
            messages: item.messages.map(msg => ({
              ...msg,
              sources: msg.sources?.map(s => ({ ...s, content: undefined }))
            }))
          }));
          localStorage.setItem('atlus_history', JSON.stringify(lightweightHistory));
        } catch (e) {
          console.warn('LocalStorage quota exceeded for history sync. Relying on Firestore.', e);
          // If it fails, try clearing old history to make room
          if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            try {
              localStorage.removeItem('atlus_history');
            } catch (inner) {}
          }
        }
      };

      const unsubscribeConversations = onSnapshot(conversationsQuery, (snapshot) => {
        currentConversations = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            title: data.title || 'Untitled',
            messages: data.messages || [],
            timestamp: formatTimestamp(data.timestamp),
            lastUpdated: formatTimestamp(data.lastUpdated || data.timestamp)
          };
        }) as HistoryItem[];
        updateMergedHistory();
      }, (error) => {
        console.error('Conversations subscription error:', error);
      });

      const unsubscribeLegacyHistory = onSnapshot(legacyHistoryQuery, (snapshot) => {
        currentLegacyItems = snapshot.docs.map(doc => {
          const data = doc.data();
          const timestamp = formatTimestamp(data.timestamp);
          return {
            id: doc.id,
            title: data.query || 'Untitled',
            messages: [
              { role: 'user', content: data.query || '', timestamp },
              { role: 'model', content: data.answer || '', timestamp, sources: [] }
            ],
            timestamp,
            lastUpdated: timestamp
          };
        }) as HistoryItem[];
        updateMergedHistory();
      }, (error) => {
        console.error('Legacy history subscription error:', error);
      });

      // Subscribe to library (saved searches)
      const libraryQuery = query(
        collection(db, 'users', user.uid, 'saved_searches'),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribeLibrary = onSnapshot(libraryQuery, (snapshot) => {
        console.log(`Library snapshot received: ${snapshot.docs.length} items`);
        const items = snapshot.docs.map(doc => {
          const data = doc.data();
          let timestamp = data.createdAt || data.timestamp;
          let lastUpdated = data.lastUpdated || timestamp;
          
          // Handle Firestore Timestamp objects
          const formatTimestamp = (ts: any) => {
            if (ts && typeof ts === 'object' && 'toDate' in ts) {
              return ts.toDate().toLocaleString();
            } else if (ts && typeof ts === 'string') {
              try {
                const date = new Date(ts);
                if (!isNaN(date.getTime())) return date.toLocaleString();
              } catch (e) {}
            }
            return ts || 'Unknown date';
          };

          // Migration for old data format
          const messages = data.messages || [
            { role: 'user', content: data.query || 'Untitled', timestamp: formatTimestamp(timestamp) },
            { role: 'model', content: data.answer || '', timestamp: formatTimestamp(timestamp), sources: [] }
          ];

          return {
            id: doc.id,
            title: data.title || data.query || 'Untitled',
            ...data,
            messages,
            timestamp: formatTimestamp(timestamp),
            lastUpdated: formatTimestamp(lastUpdated)
          };
        }) as LibraryItem[];
        
        setLibrary(items);
        try {
          // 2026 "Lightweight Sync": Strip heavy source content before saving to localStorage
          const lightweightLibrary = items.map(item => ({
            ...item,
            messages: item.messages.map(msg => ({
              ...msg,
              sources: msg.sources?.map(s => ({ ...s, content: undefined }))
            }))
          }));
          localStorage.setItem('atlus_library', JSON.stringify(lightweightLibrary));
        } catch (e) {
          console.warn('LocalStorage quota exceeded for library sync. Relying on Firestore.', e);
          // If it fails, try clearing old library to make room
          if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            try {
              localStorage.removeItem('atlus_library');
            } catch (inner) {}
          }
        }
      }, (error) => {
        console.error('Library subscription error:', error);
        addLog('Failed to load library from cloud.', 'error');
      });

      return () => {
        unsubscribeProfile();
        unsubscribeConversations();
        unsubscribeLegacyHistory();
        unsubscribeLibrary();
      };
    }
  }, [user]);

  // Apply theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('atlus_theme', theme);
  }, [theme]);

  // Save to localStorage whenever state changes (only if not empty or if explicitly cleared)
  useEffect(() => {
    if (history.length > 0) {
      try {
        // 2026 "Lightweight Sync": Strip heavy source content from history before saving to localStorage
        const lightweightHistory = history.map(item => ({
          ...item,
          messages: item.messages.map(msg => ({
            ...msg,
            sources: msg.sources?.map(s => ({ ...s, content: undefined })) // Remove heavy scraped content
          }))
        }));
        localStorage.setItem('atlus_history', JSON.stringify(lightweightHistory));
      } catch (e) {
        console.warn('LocalStorage quota exceeded for history. Relying on Firestore.', e);
      }
    }
  }, [history]);

  useEffect(() => {
    if (library.length > 0) {
      try {
        // 2026 "Lightweight Sync": Strip heavy source content from library before saving to localStorage
        const lightweightLibrary = library.map(item => ({
          ...item,
          messages: item.messages.map(msg => ({
            ...msg,
            sources: msg.sources?.map(s => ({ ...s, content: undefined })) // Remove heavy scraped content
          }))
        }));
        localStorage.setItem('atlus_library', JSON.stringify(lightweightLibrary));
      } catch (e) {
        console.warn('LocalStorage quota exceeded for library. Relying on Firestore.', e);
      }
    }
  }, [library]);

  const addLog = useCallback((message: string, status: LogEntry['status'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSearchState(prev => ({
      ...prev,
      logs: [...prev.logs, { timestamp, message, status }]
    }));
  }, []);

  const handleSearch = async (query: string, focus: string = 'all', files: FileContent[] = [], mode: SearchMode = searchState.mode) => {
    // Limit to 50 turns (100 messages)
    if (searchState.messages.length >= 100) {
      addLog('Conversation limit reached (50 turns). Please start a new search.', 'warning');
      return;
    }

    setView('result');
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }

    const conversationId = searchState.conversationId || Math.random().toString(36).substr(2, 9);

    const userMessage: ChatMessage = {
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString()
    };

    const initialAiMessage: ChatMessage = {
      role: 'model',
      content: '',
      timestamp: new Date().toLocaleTimeString(),
      sources: []
    };

    const updatedMessages = [...searchState.messages, userMessage, initialAiMessage];

    setSearchState(prev => ({
      ...prev,
      conversationId,
      query,
      messages: updatedMessages,
      status: 'Thinking...',
      isGenerating: true,
      relatedQuestions: [],
      mode
    }));

    try {
      addLog(`Initiating ${mode} research for: "${query}"`, 'info');
      addLog(`Searching 50+ engines via SearXNG...`, 'info');
      
      if (files.length > 0) {
        addLog(`Analyzing ${files.length} attached files...`, 'info');
      }
      
      addLog(`Generating answer using Atlus AI (Llama 3.3) model with real-time web context...`, 'info');
      
      const answer = await generateResponse([...searchState.messages, userMessage], userProfile, mode, (chunk) => {
        setSearchState(prev => {
          const newMessages = [...prev.messages];
          const lastIndex = newMessages.length - 1;
          if (lastIndex >= 0 && newMessages[lastIndex].role === 'model') {
            const currentContent = newMessages[lastIndex].content;
            
            // 2026 "Ghost Filter": Only filter if we are at the very end of the response
            const isNearEnd = chunk.includes("FOLLOW_UP_START") || currentContent.length > 500;
            
            if (currentContent.includes("FOLLOW_UP_START")) {
              return prev;
            }
            
            let cleanChunk = chunk;
            if (isNearEnd) {
              const introPhrases = ["Here are three", "Related questions", "Follow-up questions"];
              for (const phrase of introPhrases) {
                if (cleanChunk.includes(phrase)) {
                  // Only split if the phrase is followed by the marker or is at the very end
                  const parts = cleanChunk.split(phrase);
                  if (parts[1].includes("FOLLOW_UP_START") || parts[1].length < 20) {
                    cleanChunk = parts[0];
                  }
                }
              }
            }

            newMessages[lastIndex] = { ...newMessages[lastIndex], content: currentContent + cleanChunk };
          }
          return {
            ...prev,
            messages: newMessages,
            status: 'Generating answer...'
          };
        });
      }, (sources) => {
        setSearchState(prev => {
          const newMessages = [...prev.messages];
          const lastIndex = newMessages.length - 1;
          if (lastIndex >= 0 && newMessages[lastIndex].role === 'model') {
            newMessages[lastIndex] = { ...newMessages[lastIndex], sources };
          }
          return {
            ...prev,
            messages: newMessages
          };
        });
        addLog(`Found ${sources.length} relevant sources.`, 'success');
      }, (status) => {
        setSearchState(prev => {
          const newMessages = [...prev.messages];
          const lastIndex = newMessages.length - 1;
          if (lastIndex >= 0 && newMessages[lastIndex].role === 'model') {
            const currentThinking = newMessages[lastIndex].thinking || [];
            // Only add if it's a new status message to avoid duplicates in thinking list
            if (currentThinking[currentThinking.length - 1] !== status) {
              newMessages[lastIndex] = { 
                ...newMessages[lastIndex], 
                thinking: [...currentThinking, status] 
              };
            }
          }
          return {
            ...prev,
            messages: newMessages,
            status
          };
        });
        addLog(status, 'info');
      });

      // Parse follow-up questions using the new strict marker
      const parts = answer.split("FOLLOW_UP_START");
      const finalAnswer = parts[0].trim();
      let relatedQuestions: string[] = [];
      
      if (parts.length > 1) {
        relatedQuestions = parts[1]
          .split('\n')
          .map(q => q.replace(/^[-\d.]+\s*/, '').replace(/\*\*/g, '').replace(/\*/g, '').trim())
          .filter(q => q.length > 5) // Ensure it's a real question
          .slice(0, 3);
      }

      setSearchState(prev => {
        const lastMessages = [...prev.messages];
        if (lastMessages.length > 0) {
          lastMessages[lastMessages.length - 1].content = finalAnswer;
        }
        
        if (user) {
          const conversationId = prev.conversationId || Math.random().toString(36).substr(2, 9);
          const conversationRef = doc(db, 'users', user.uid, 'conversations', conversationId);
          setDoc(conversationRef, {
            userId: user.uid,
            title: lastMessages[0].content.slice(0, 50) + (lastMessages[0].content.length > 50 ? '...' : ''),
            messages: lastMessages,
            timestamp: prev.messages.length <= 2 ? serverTimestamp() : history.find(h => h.id === conversationId)?.timestamp || serverTimestamp(),
            lastUpdated: serverTimestamp()
          }, { merge: true }).catch(err => console.error('Error saving conversation:', err));
        }

        return {
          ...prev,
          messages: lastMessages,
          status: 'Complete',
          isGenerating: false,
          relatedQuestions: relatedQuestions
        };
      });

      addLog('Generation complete.', 'success');
    } catch (error) {
      console.error('Generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setSearchState(prev => {
        const newMessages = [...prev.messages];
        const lastIndex = newMessages.length - 1;
        if (lastIndex >= 0 && newMessages[lastIndex].role === 'model') {
          newMessages[lastIndex] = { ...newMessages[lastIndex], content: newMessages[lastIndex].content + `\n\n**Error:** ${errorMessage}` };
        }
        return {
          ...prev,
          status: 'Error',
          isGenerating: false
        };
      });
      addLog(`Error: ${errorMessage}`, 'error');
    }
  };

  const handleDeleteLastMessage = () => {
    setSearchState(prev => {
      const newMessages = [...prev.messages];
      // Remove last AI message and last User message
      if (newMessages.length >= 2) {
        newMessages.pop(); // Remove model message
        newMessages.pop(); // Remove user message
      }
      return {
        ...prev,
        messages: newMessages,
        query: newMessages.length > 0 ? newMessages[newMessages.length - 2].content : ''
      };
    });
    addLog('Last response deleted.', 'info');
  };

  const resetToHome = () => {
    setView('home');
    setSearchState({
      conversationId: undefined,
      query: '',
      messages: [],
      logs: [],
      status: 'Ready',
      isGenerating: false,
      relatedQuestions: [],
      mode: 'search'
    });
  };

  const handleLoadChat = (item: HistoryItem | LibraryItem) => {
    if (!item.messages || item.messages.length < 2) {
      addLog('Could not load this chat: Invalid message format.', 'error');
      return;
    }
    
    setView('result');
    setSearchState({
      conversationId: item.id,
      query: item.messages[item.messages.length - 2].content,
      messages: item.messages,
      logs: [{ timestamp: new Date().toLocaleTimeString(), message: 'Loaded conversation.', status: 'success' }],
      status: 'Complete',
      isGenerating: false,
      relatedQuestions: [],
      mode: 'search'
    });
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!searchState.conversationId || searchState.messages.length === 0) return;
    
    const newItem: LibraryItem = {
      id: searchState.conversationId,
      title: searchState.messages[0].content.slice(0, 50),
      messages: searchState.messages,
      timestamp: new Date().toLocaleString(),
      lastUpdated: new Date().toLocaleString()
    };
    
    setLibrary(prev => [newItem, ...prev]);
    addLog('Saved to library locally!', 'success');

    if (user) {
      try {
        const savedSearchesRef = doc(db, 'users', user.uid, 'saved_searches', searchState.conversationId);
        await setDoc(savedSearchesRef, {
          userId: user.uid,
          title: newItem.title,
          messages: searchState.messages,
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
        addLog('Synced to cloud library!', 'success');
      } catch (err) {
        console.error('Error saving to Firestore:', err);
        addLog('Failed to sync to cloud.', 'error');
      }
    }
  };

  const removeFromHistory = async (id: string) => {
    if (user) {
      try {
        // Try deleting from both collections to be safe
        await Promise.all([
          deleteDoc(doc(db, 'users', user.uid, 'conversations', id)),
          deleteDoc(doc(db, 'users', user.uid, 'chat_history', id))
        ]);
      } catch (err) {
        console.error('Error deleting history from Firestore:', err);
      }
    } else {
      setHistory(prev => prev.filter(item => item.id !== id));
    }
  };

  const removeFromLibrary = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'saved_searches', id));
      } catch (err) {
        console.error('Error deleting from library in Firestore:', err);
      }
    } else {
      setLibrary(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleSaveProfile = async (updatedProfile: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, updatedProfile);
      setUserProfile(prev => prev ? { ...prev, ...updatedProfile } : null);
      addLog('Profile updated successfully.', 'success');
    } catch (err) {
      console.error('Error updating profile:', err);
      addLog('Failed to update profile.', 'error');
      throw err;
    }
  };

  const handleExportData = () => {
    const data = {
      profile: userProfile,
      history,
      library
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atlus_ai_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('Data export started.', 'success');
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (confirm('Are you absolutely sure you want to delete your account? This will permanently remove all your data.')) {
      try {
        // Delete Firestore data
        await clearAllHistory();
        const libraryRef = collection(db, 'users', user.uid, 'saved_searches');
        const librarySnap = await getDocs(libraryRef);
        await Promise.all(librarySnap.docs.map(d => deleteDoc(d.ref)));
        
        await deleteDoc(doc(db, 'users', user.uid));
        
        // Log out
        await logOut();
        addLog('Account deleted successfully.', 'success');
      } catch (err) {
        console.error('Error deleting account:', err);
        addLog('Failed to delete account.', 'error');
      }
    }
  };

  const clearAllHistory = async () => {
    if (user) {
      try {
        // Clear both collections
        const conversationsRef = collection(db, 'users', user.uid, 'conversations');
        const legacyRef = collection(db, 'users', user.uid, 'chat_history');
        
        const [convSnapshot, legacySnapshot] = await Promise.all([
          getDocs(conversationsRef),
          getDocs(legacyRef)
        ]);
        
        const deletePromises = [
          ...convSnapshot.docs.map(d => deleteDoc(d.ref)),
          ...legacySnapshot.docs.map(d => deleteDoc(d.ref))
        ];
        
        await Promise.all(deletePromises);
        addLog('All history cleared from cloud.', 'success');
      } catch (err) {
        console.error('Error clearing history from Firestore:', err);
      }
    } else {
      setHistory([]);
    }
  };

  const renderView = () => {
    switch (view) {
      case 'home':
        return (
          <HomeView 
            key="home" 
            onSearch={handleSearch} 
            suggestions={searchState.relatedQuestions.length > 0 ? searchState.relatedQuestions : undefined}
          />
        );
      case 'result':
        return (
          <div key="result" className="relative min-h-full flex flex-col">
            <div className="flex-1">
              <ResultView 
                {...searchState}
                onSearch={handleSearch}
                onSave={handleSaveToLibrary}
                onDeleteLastMessage={handleDeleteLastMessage}
                isSaved={library.some(item => item.id === searchState.conversationId)}
              />
            </div>
            <div className="sticky bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background via-background/80 to-transparent z-30">
              <SearchBox 
                onSearch={handleSearch} 
                isResultView 
                isGenerating={searchState.isGenerating}
                className="max-w-3xl shadow-xl mx-auto"
              />
            </div>
          </div>
        );
      case 'discover':
        return <DiscoverView onSearch={handleSearch} />;
      case 'library':
        return <LibraryView items={library} onSearch={handleSearch} onLoadChat={handleLoadChat} onRemove={removeFromLibrary} />;
      case 'history':
        return (
          <HistoryView 
            items={history} 
            onSearch={handleSearch} 
            onLoadChat={handleLoadChat}
            onRemove={removeFromHistory} 
            onClearAll={clearAllHistory} 
          />
        );
      case 'settings':
        return <SettingsView theme={theme} setTheme={setTheme} profile={userProfile} onEditProfile={() => setIsProfileModalOpen(true)} onSaveProfile={handleSaveProfile} />;
      default:
        return <HomeView onSearch={handleSearch} isGenerating={searchState.isGenerating} />;
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <h1 className="text-xl font-bold text-red-500 mb-2">Authentication Error</h1>
        <p className="text-muted mb-4">{error.message}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-accent text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="h-screen h-[100dvh] bg-background text-zinc-100 flex overflow-hidden">
      <Sidebar 
        onNewSearch={resetToHome} 
        setView={setView}
        activeView={view}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        profile={userProfile}
      />
      
      {/* Menu Button - Visible when sidebar is closed */}
      <AnimatePresence>
        {!isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-0 right-0 h-16 flex items-center px-4 bg-background/80 backdrop-blur-md border-b border-border z-50 md:hidden"
          >
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-muted hover:text-accent rounded-lg transition-colors cursor-pointer"
            >
              <Menu size={24} />
            </button>
            <div 
              className="flex-1 flex justify-center pr-8 cursor-pointer"
              onClick={resetToHome}
            >
              <Logo size={28} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Desktop Menu Button - Visible when sidebar is closed */}
      <AnimatePresence>
        {!isSidebarOpen && (
          <motion.button 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onClick={() => setIsSidebarOpen(true)}
            className="fixed top-4 left-4 p-2.5 bg-card border border-border rounded-lg text-muted hover:text-accent z-50 shadow-lg cursor-pointer hidden md:block"
          >
            <Menu size={24} />
          </motion.button>
        )}
      </AnimatePresence>
      
      <main className="flex-1 relative overflow-y-auto overflow-x-hidden min-w-0">
        <AnimatePresence mode="wait">
          {renderView()}
        </AnimatePresence>
      </main>

      <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={userProfile}
        onSave={handleSaveProfile}
        onExportData={handleExportData}
        onDeleteAccount={handleDeleteAccount}
      />
    </div>
  );
}
