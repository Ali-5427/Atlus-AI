import { motion } from 'motion/react';
import { History, Search, Trash2, ChevronRight } from 'lucide-react';
import { HistoryItem, FileContent, SearchMode } from '../types';

interface HistoryViewProps {
  items: HistoryItem[];
  onSearch: (query: string, focus?: string, files?: FileContent[], mode?: SearchMode) => void;
  onLoadChat: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

export const HistoryView = ({ items, onSearch, onLoadChat, onRemove, onClearAll }: HistoryViewProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto py-12 px-6"
    >
      <header className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight mb-4">History</h1>
          <p className="text-muted text-lg">Your past research and conversations.</p>
          {items.length > 0 && (
            <p className="text-xs text-muted mt-2">Showing {items.length} conversations</p>
          )}
        </div>
        {items.length > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-2 px-4 py-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all font-medium text-sm cursor-pointer"
          >
            <Trash2 size={18} />
            <span>Clear All</span>
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center glass-card bg-card/50">
          <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center text-muted mb-6 shadow-sm border border-border">
            <History size={32} />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">No history yet</h3>
          <p className="text-muted max-w-xs">Start a research session to see your history here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group p-4 glass-card hover:bg-accent/5 transition-all flex items-center justify-between gap-4"
            >
              <div 
                className="flex-1 flex items-center gap-4 cursor-pointer"
                onClick={() => onLoadChat(item)}
              >
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all">
                  <Search size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-bold text-foreground group-hover:text-accent transition-colors line-clamp-1">
                    {item.title}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted mt-1">
                    <span>{item.lastUpdated}</span>
                    <span>•</span>
                    <span>{Math.floor((item.messages?.length || 0) / 2)} turns</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onRemove(item.id)}
                  className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                  title="Remove from history"
                >
                  <Trash2 size={18} />
                </button>
                <button 
                  onClick={() => onLoadChat(item)}
                  className="p-2 text-muted hover:text-accent rounded-lg transition-all cursor-pointer"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
