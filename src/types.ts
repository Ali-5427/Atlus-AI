export interface FileContent {
  name: string;
  type: string;
  content: string;
  isImageFallback?: boolean;
}

export interface Source {
  title: string;
  url: string;
  favicon: string;
  snippet: string;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  status: 'info' | 'success' | 'warning' | 'error';
}

export type ViewState = 'home' | 'result' | 'discover' | 'library' | 'history' | 'settings';

export type SearchMode = 'search' | 'deepsearch' | 'research';

export interface HistoryItem {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: string;
  lastUpdated: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: string;
  lastUpdated: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  sources?: Source[];
  thinking?: string[];
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  bio?: string;
  customInstructions?: string;
  language?: string;
  timezone?: string;
  units?: 'metric' | 'imperial';
  plan?: 'free' | 'pro';
  createdAt?: string;
  lastLogin?: string;
}

export interface SearchState {
  conversationId?: string;
  query: string;
  messages: ChatMessage[];
  logs: LogEntry[];
  status: string;
  isGenerating: boolean;
  relatedQuestions: string[];
  mode: SearchMode;
}
