import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '../lib/utils';

interface CodeBlockProps {
  children: string;
  className?: string;
}

export const CodeBlock = ({ children, className }: CodeBlockProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(children);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Extract language from className (e.g., "language-sql")
  const language = className?.replace('language-', '') || '';

  return (
    <div className="relative group my-6 rounded-xl overflow-hidden border border-accent/20 bg-accent/[0.02] dark:bg-[#1e1e1e] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-accent/5 border-b border-accent/10 dark:border-white/5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-accent/60 font-mono">
          {language || 'code'}
        </span>
        <button
          onClick={copyToClipboard}
          className="p-1.5 rounded-md text-accent/40 hover:text-accent hover:bg-accent/10 transition-all cursor-pointer"
          title="Copy code"
        >
          {isCopied ? (
            <Check size={14} className="text-accent" />
          ) : (
            <Copy size={14} />
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="custom-scrollbar overflow-x-auto">
        <SyntaxHighlighter
          language={language}
          style={oneLight}
          customStyle={{
            margin: 0,
            padding: '1.25rem',
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: '1.5',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'inherit',
            }
          }}
        >
          {children}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};
