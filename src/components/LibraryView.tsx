import { motion } from 'motion/react';
import { BookOpen, Search, Trash2, ExternalLink } from 'lucide-react';
import { LibraryItem, FileContent, SearchMode } from '../types';

interface LibraryViewProps {
  items: LibraryItem[];
  onSearch: (query: string, focus?: string, files?: FileContent[], mode?: SearchMode) => void;
  onLoadChat: (item: LibraryItem) => void;
  onRemove: (id: string) => void;
}

export const LibraryView = ({ items, onSearch, onLoadChat, onRemove }: LibraryViewProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto py-12 px-6"
    >
      <header className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight mb-4">Library</h1>
          <p className="text-muted text-lg">Your curated collection of research and insights.</p>
        </div>
        <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center text-accent">
          <BookOpen size={32} />
        </div>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center glass-card bg-card/50">
          <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center text-muted mb-6 shadow-sm border border-border">
            <BookOpen size={32} />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Your library is empty</h3>
          <p className="text-muted max-w-xs">Save your research results to find them here later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="group p-6 glass-card hover:bg-accent/5 transition-all flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-xl font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2">
                  {item.title}
                </h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => onRemove(item.id)}
                    className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                    title="Remove from library"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <p className="text-muted text-sm leading-relaxed line-clamp-3">
                {item.messages && item.messages.length > 0 
                  ? item.messages[item.messages.length - 1].content.replace(/[#*]/g, '')
                  : 'No content available'}
              </p>

              <div className="mt-auto pt-6 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted">{item.lastUpdated}</span>
                <button
                  onClick={() => onLoadChat(item)}
                  className="flex items-center gap-2 text-accent font-medium text-sm hover:text-accent/80 transition-colors cursor-pointer"
                >
                  <span>View Result</span>
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
