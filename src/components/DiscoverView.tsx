import { motion } from 'motion/react';
import { Search, TrendingUp, Sparkles, Globe, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';
import { FileContent, SearchMode } from '../types';

const TRENDING = [
  {
    id: '1',
    title: 'The Future of Generative AI',
    description: 'How Atlus AI and Llama 3 are changing the way we work and create.',
    icon: Sparkles,
    color: 'text-purple-500',
    bg: 'bg-purple-50',
    query: 'What is the future of generative AI in 2024?'
  },
  {
    id: '2',
    title: 'Quantum Computing Breakthroughs',
    description: 'Recent advancements in error correction and qubit stability.',
    icon: Cpu,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    query: 'Latest breakthroughs in quantum computing 2024'
  },
  {
    id: '3',
    title: 'Sustainable Energy Trends',
    description: 'The shift towards green hydrogen and next-gen solar panels.',
    icon: Globe,
    color: 'text-green-500',
    bg: 'bg-green-50',
    query: 'Global sustainable energy trends for the next decade'
  },
  {
    id: '4',
    title: 'Space Exploration 2.0',
    description: 'Mars missions and the commercialization of low Earth orbit.',
    icon: TrendingUp,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    query: 'Future of space exploration and Mars colonization'
  }
];

interface DiscoverViewProps {
  onSearch: (query: string, focus?: string, files?: FileContent[], mode?: SearchMode) => void;
}

export const DiscoverView = ({ onSearch }: DiscoverViewProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto py-12 px-6"
    >
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-foreground tracking-tight mb-4">Discover</h1>
        <p className="text-muted text-lg">Explore trending topics and stay ahead of the curve.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {TRENDING.map((item) => (
          <button
            key={item.id}
            onClick={() => onSearch(item.query)}
            className="group p-6 glass-card hover:bg-accent/5 transition-all text-left flex flex-col gap-4 cursor-pointer"
          >
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", item.bg, item.color)}>
              <item.icon size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-accent transition-colors">
                {item.title}
              </h3>
              <p className="text-muted text-sm leading-relaxed">
                {item.description}
              </p>
            </div>
            <div className="mt-auto pt-4 flex items-center gap-2 text-accent font-medium text-sm">
              <span>Research now</span>
              <Search size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
};
