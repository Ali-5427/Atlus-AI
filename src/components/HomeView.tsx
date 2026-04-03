import { motion } from 'motion/react';
import { SearchBox } from './SearchBox';
import { FileContent, SearchMode } from '../types';

const SUGGESTIONS = [
  "Impact of AI on software engineering",
  "History of space exploration",
  "Quantum computing for beginners",
  "Sustainable energy trends 2024"
];

export const HomeView = ({ 
  onSearch, 
  isGenerating,
  suggestions = SUGGESTIONS 
}: { 
  onSearch: (query: string, focus?: string, files?: FileContent[], mode?: SearchMode) => void,
  isGenerating?: boolean,
  suggestions?: string[]
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col items-center justify-center min-h-full px-4 py-12"
    >
      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground mb-10 tracking-tight text-center max-w-4xl leading-tight">
        What do you want to know?
      </h1>
      
      <SearchBox onSearch={onSearch} isGenerating={isGenerating} className="mb-8" />
      
      <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSearch(suggestion)}
            className="btn-pill hover:border-green-400 cursor-pointer"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </motion.div>
  );
};
