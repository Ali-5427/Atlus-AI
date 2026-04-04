import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Copy, 
  Download, 
  Share2, 
  MoreHorizontal, 
  BookOpen, 
  ChevronRight,
  Terminal,
  Loader2,
  Check,
  Trash2,
  User,
  ChevronDown
} from 'lucide-react';
import { Source, LogEntry, ChatMessage, FileContent, SearchMode } from '../types';
import { cn } from '../lib/utils';
import { CodeBlock } from './CodeBlock';

interface ResultViewProps {
  query: string;
  messages: ChatMessage[];
  logs: LogEntry[];
  isGenerating: boolean;
  status: string;
  relatedQuestions: string[];
  onSearch: (query: string, focus?: string, files?: FileContent[], mode?: SearchMode) => void;
  onSave: () => void;
  onDeleteLastMessage: () => void;
  isSaved: boolean;
}

export const ResultView = ({ 
  query, 
  messages, 
  logs, 
  isGenerating, 
  status, 
  relatedQuestions,
  onSearch,
  onSave,
  onDeleteLastMessage,
  isSaved
}: ResultViewProps) => {
  const [showLogs, setShowLogs] = useState(false);
  const [showThinking, setShowThinking] = useState<Record<number, boolean>>({});
  const [showInternalMonologue, setShowInternalMonologue] = useState<Record<number, boolean>>({});
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(messages.length);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToLastMessage = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToNewTurn = () => {
    if (lastUserMessageRef.current) {
      lastUserMessageRef.current.scrollIntoView({ behavior: "auto", block: "start" });
    }
  };

  useEffect(() => {
    if (showLogs) {
      scrollToBottom();
    }
  }, [logs, showLogs]);

  useEffect(() => {
    // Jump to the new query immediately when generation starts
    if (isGenerating) {
      scrollToNewTurn();
    }
  }, [isGenerating]);

  useEffect(() => {
    // Also scroll when messages length increases (new user message)
    if (messages.length > prevMessagesLength.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        scrollToNewTurn();
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  useEffect(() => {
    // Scroll to bottom on initial load of a history chat or when messages are loaded
    if (messages.length > 0 && !isGenerating) {
      // Use a small timeout to ensure the DOM has rendered the messages
      const timer = setTimeout(() => {
        scrollToLastMessage();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length, isGenerating]);

  useEffect(() => {
    const mainElement = document.querySelector('main');
    if (!mainElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = mainElement;
      // Show button if we are more than 300px from the bottom
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 300;
      setShowScrollButton(!isNearBottom && scrollTop > 200);
    };

    mainElement.addEventListener('scroll', handleScroll);
    return () => mainElement.removeEventListener('scroll', handleScroll);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const downloadMarkdown = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.slice(0, 20)}.md`;
    a.click();
    setIsDownloaded(true);
    setTimeout(() => setIsDownloaded(false), 2000);
  };

  const parseContent = (content: string) => {
    const hasThoughtBlock = content.includes('<thought>');
    const thoughtMatch = content.match(/<thought>([\s\S]*?)(?:<\/thought>|$)/);
    const thought = thoughtMatch ? thoughtMatch[1].trim() : null;
    
    // Check if the thought block is closed
    const isThoughtClosed = content.includes('</thought>');
    
    // Extract main content
    let mainContent = '';
    if (hasThoughtBlock) {
      if (isThoughtClosed) {
        mainContent = content.split('</thought>')[1].trim();
      }
    } else {
      mainContent = content.trim();
    }
    
    return { thought, mainContent, isThoughtClosed, hasThoughtBlock };
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto py-8 md:py-12 px-4 md:px-6 pb-32"
    >
      <div className="space-y-12">
        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1;
          const isLastAiMessage = isLastMessage && message.role === 'model';
          
          if (message.role === 'user') {
            const isLastUserMessage = index === messages.length - 1 || (index === messages.length - 2 && messages[index + 1].role === 'model');
            return (
              <div 
                key={index} 
                ref={isLastUserMessage ? lastUserMessageRef : null}
                className="flex gap-4 items-start scroll-mt-24"
              >
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
                  <User size={18} />
                </div>
                <h1 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight leading-tight pt-0.5">
                  {message.content}
                </h1>
              </div>
            );
          }

          return (
            <div key={index} className="space-y-8">
              {/* Sources for this message */}
              {message.sources && message.sources.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4 text-muted">
                    <BookOpen size={18} />
                    <h2 className="text-sm font-semibold uppercase tracking-wider">Sources</h2>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                    {message.sources.map((source, i) => (
                      <a 
                        key={i} 
                        href={source.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-shrink-0 w-40 md:w-48 p-3 glass-card hover:bg-accent/5 transition-colors group cursor-pointer"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <img src={source.favicon} alt="" className="w-4 h-4 rounded-sm" referrerPolicy="no-referrer" />
                          <span className="text-xs font-medium text-foreground truncate">{source.title}</span>
                        </div>
                        <p className="text-[10px] text-muted line-clamp-2 leading-relaxed">
                          {source.snippet}
                        </p>
                        <div className="mt-2 text-[9px] text-muted/60 truncate group-hover:text-accent transition-colors">
                          {source.url.replace('https://', '')}
                        </div>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Unified Thinking / Reasoning Section (DeepSeek Style) */}
              {((message.thinking && message.thinking.length > 0) || parseContent(message.content || '').hasThoughtBlock) && (
                <section className="mb-6">
                  {(() => {
                    const { thought, isThoughtClosed, hasThoughtBlock } = parseContent(message.content || '');
                    const isResearching = isGenerating && isLastAiMessage && !isThoughtClosed;
                    const isOpen = showThinking[index] ?? true; // Default to open for active thinking

                    return (
                      <>
                        <button 
                          onClick={() => setShowThinking(prev => ({ ...prev, [index]: !isOpen }))}
                          className={cn(
                            "flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg transition-all cursor-pointer group border",
                            isOpen
                              ? "text-accent bg-accent/5 border-accent/20" 
                              : "text-muted/60 hover:text-accent hover:bg-accent/5 border-transparent hover:border-accent/10"
                          )}
                        >
                          <Terminal size={14} className={cn("transition-transform", isResearching ? "animate-pulse" : "group-hover:scale-110")} />
                          <span className="text-xs font-medium tracking-tight">
                            {isResearching ? 'Thinking...' : 'Thought for a few seconds'}
                          </span>
                          <ChevronRight size={12} className={cn("transition-transform duration-200", isOpen ? "rotate-90" : "")} />
                        </button>
                        
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="pl-6 border-l-2 border-accent/20 mb-8 py-2 relative ml-2">
                                {/* Timeline Dots & Phases */}
                                <div className="space-y-8">
                                  {/* Phase 1: Planning & Intent */}
                                  {(message.thinking?.some(s => s.toLowerCase().includes('analyzing') || s.toLowerCase().includes('planning'))) && (
                                    <div className="relative">
                                      <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-accent border-2 border-background shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)]" />
                                      <div className="text-[10px] font-bold text-accent uppercase tracking-widest mb-2 opacity-70">Phase 1: Strategy</div>
                                      <div className="text-sm text-muted leading-relaxed italic space-y-2">
                                        {message.thinking
                                          .filter(s => s.toLowerCase().includes('analyzing') || s.toLowerCase().includes('planning'))
                                          .map((step, i) => (
                                            <p key={i}>
                                              {step.split(' ').map((word, j) => (
                                                <span key={j} className={cn(
                                                  (word.toLowerCase().includes('analyzing') || word.toLowerCase().includes('planning') || word.toLowerCase().includes('strategy')) ? "font-bold text-foreground/80" : ""
                                                )}>
                                                  {word}{' '}
                                                </span>
                                              ))}
                                            </p>
                                          ))
                                        }
                                      </div>
                                    </div>
                                  )}

                                  {/* Phase 2: Deep Research (Rounds) */}
                                  {((message.thinking?.some(s => s.toLowerCase().includes('round') || s.toLowerCase().includes('research'))) || thought) && (
                                    <div className="relative">
                                      <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-accent/40 border-2 border-background" />
                                      <div className="text-[10px] font-bold text-accent uppercase tracking-widest mb-2 opacity-70">Phase 2: Execution</div>
                                      <div className="text-sm text-muted leading-relaxed italic space-y-4">
                                        {/* Status messages for research */}
                                        {message.thinking
                                          ?.filter(s => s.toLowerCase().includes('round') || s.toLowerCase().includes('research'))
                                          .map((step, i) => (
                                            <p key={i} className="font-medium text-foreground/70">
                                              {step}
                                              {i === message.thinking!.length - 1 && isResearching && !hasThoughtBlock && (
                                                <Loader2 size={12} className="inline-block animate-spin text-accent ml-2 align-middle" />
                                              )}
                                            </p>
                                          ))
                                        }

                                        {/* Thought block split into readable chunks */}
                                        {thought && (
                                          <div className="space-y-4 mt-2">
                                            {thought.split(/(?=Round \d+|Reflecting on findings|I've completed my research|Finally,)/g).map((chunk, i) => (
                                              <motion.div 
                                                key={i}
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.1 }}
                                                className={cn(
                                                  "p-3 rounded-xl bg-accent/5 border border-accent/10",
                                                  chunk.includes('Round') ? "border-l-4 border-l-accent/40" : ""
                                                )}
                                              >
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                  {chunk.trim()}
                                                </ReactMarkdown>
                                                {i === thought.split(/(?=Round \d+|Reflecting on findings|I've completed my research|Finally,)/g).length - 1 && !isThoughtClosed && (
                                                  <span className="inline-block w-1.5 h-4 ml-1 bg-accent/40 animate-pulse align-middle" />
                                                )}
                                              </motion.div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Phase 3: Synthesis */}
                                  {(message.thinking?.some(s => s.toLowerCase().includes('reranking') || s.toLowerCase().includes('synthesizing') || s.toLowerCase().includes('done'))) && (
                                    <div className="relative">
                                      <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-accent/20 border-2 border-background" />
                                      <div className="text-[10px] font-bold text-accent uppercase tracking-widest mb-2 opacity-70">Phase 3: Synthesis</div>
                                      <div className="text-sm text-muted leading-relaxed italic space-y-2">
                                        {message.thinking
                                          .filter(s => s.toLowerCase().includes('reranking') || s.toLowerCase().includes('synthesizing') || s.toLowerCase().includes('done'))
                                          .map((step, i) => (
                                            <p key={i}>
                                              {step.split(' ').map((word, j) => (
                                                <span key={j} className={cn(
                                                  (word.toLowerCase().includes('reranking') || word.toLowerCase().includes('synthesizing') || word.toLowerCase().includes('final')) ? "font-bold text-foreground/80" : ""
                                                )}>
                                                  {word}{' '}
                                                </span>
                                              ))}
                                            </p>
                                          ))
                                        }
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    );
                  })()}
                </section>
              )}

              {/* Answer */}
              <section className="relative">
                {(() => {
                  const { mainContent, isThoughtClosed, hasThoughtBlock } = parseContent(message.content || '');
                  
                  return (
                    <>
                      {(mainContent || isThoughtClosed || !hasThoughtBlock || (isGenerating && isLastAiMessage)) && (
                        <>
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-2 text-muted">
                              <h2 className="text-sm font-semibold uppercase tracking-wider">Answer</h2>
                            </div>
                          </div>

                          <div className="markdown-body">
                            {mainContent ? (
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  code({ node, inline, className, children, ...props }: any) {
                                    return !inline ? (
                                      <CodeBlock className={className}>
                                        {String(children).replace(/\n$/, '')}
                                      </CodeBlock>
                                    ) : (
                                      <code className={className} {...props}>
                                        {children}
                                      </code>
                                    );
                                  }
                                }}
                              >
                                {mainContent}
                              </ReactMarkdown>
                            ) : isGenerating ? (
                              <div className="space-y-4">
                                <div className="h-4 bg-accent/10 rounded w-3/4 animate-pulse" />
                                <div className="h-4 bg-accent/10 rounded w-full animate-pulse" />
                                <div className="h-4 bg-accent/10 rounded w-5/6 animate-pulse" />
                                <div className="h-4 bg-accent/10 rounded w-2/3 animate-pulse" />
                              </div>
                            ) : (
                              <p className="text-muted italic">No response generated.</p>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}

                {/* Action Buttons Below Answer */}
                {message.content && !isGenerating && (
                  <div className="mt-8 pt-6 border-t border-border flex flex-wrap items-center gap-2">
                    {isLastAiMessage && (
                      <button 
                        onClick={onSave} 
                        disabled={isSaved}
                        className={cn(
                          "p-2.5 rounded-full transition-all cursor-pointer shadow-sm border",
                          isSaved 
                            ? "bg-accent text-white border-accent" 
                            : "bg-card border-border text-muted hover:bg-accent/5 hover:text-accent hover:border-accent/30"
                        )} 
                        title={isSaved ? "Saved to Library" : "Save to Library"}
                      >
                        <BookOpen size={20} />
                      </button>
                    )}

                    <button 
                      onClick={() => copyToClipboard(message.content)} 
                      className="p-2.5 bg-card border border-border rounded-full text-muted hover:bg-accent/5 hover:text-accent hover:border-accent/30 transition-all shadow-sm cursor-pointer"
                      title="Copy to Clipboard"
                    >
                      {isCopied ? <Check size={20} className="text-accent" /> : <Copy size={20} />}
                    </button>

                    <button 
                      onClick={() => downloadMarkdown(message.content, query)} 
                      className="p-2.5 bg-card border border-border rounded-full text-muted hover:bg-accent/5 hover:text-accent hover:border-accent/30 transition-all shadow-sm cursor-pointer"
                      title="Download as Markdown"
                    >
                      {isDownloaded ? <Check size={20} className="text-accent" /> : <Download size={20} />}
                    </button>

                    <button 
                      className="p-2.5 bg-card border border-border rounded-full text-muted hover:bg-accent/5 hover:text-accent hover:border-accent/30 transition-all shadow-sm cursor-pointer"
                      title="Share"
                    >
                      <Share2 size={20} />
                    </button>

                    <div className="relative group">
                      <button className="p-2.5 bg-card border border-border rounded-full text-muted hover:bg-accent/5 hover:text-accent hover:border-accent/30 transition-all shadow-sm cursor-pointer">
                        <MoreHorizontal size={20} />
                      </button>
                      
                      {/* More Menu Popover */}
                      <div className="absolute bottom-full left-0 mb-2 w-48 bg-card border border-border rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-2">
                        <button 
                          onClick={() => window.print()}
                          className="w-full text-left px-4 py-2 text-sm text-muted hover:bg-accent/5 hover:text-accent transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <span>Print Result</span>
                        </button>
                        {isLastAiMessage && (
                          <button 
                            onClick={onDeleteLastMessage}
                            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        )}
                        <button 
                          className="w-full text-left px-4 py-2 text-sm text-muted hover:bg-accent/5 hover:text-accent transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <span>Report an Issue</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            onClick={scrollToLastMessage}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 p-3 bg-accent text-white rounded-full shadow-2xl z-50 hover:scale-110 active:scale-95 transition-transform cursor-pointer flex items-center justify-center border-4 border-background"
            title="Scroll to Bottom"
          >
            <ChevronDown size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Related */}
      {relatedQuestions.length > 0 && !isGenerating && (
        <section className="mt-16 mb-20">
          <div className="flex items-center gap-2 mb-6 text-muted">
            <h2 className="text-sm font-semibold uppercase tracking-wider">Related</h2>
          </div>
          <div className="space-y-3">
            {relatedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => onSearch(q)}
                className="w-full text-left p-3 md:p-4 glass-card hover:bg-accent/5 transition-all flex items-center justify-between group cursor-pointer"
              >
                <span className="text-sm md:text-base text-foreground group-hover:text-accent transition-colors">{q}</span>
                <ChevronRight size={18} className="text-muted/40 group-hover:text-accent transition-colors" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Status Pill & Logs Toggle Removed */}
    </motion.div>
  );
};
