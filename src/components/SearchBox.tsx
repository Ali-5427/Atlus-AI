import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowUp, 
  Paperclip, 
  Globe, 
  ChevronDown, 
  GraduationCap, 
  PenTool, 
  Users, 
  Youtube,
  FileText,
  Image as ImageIcon,
  BarChart,
  Code,
  Check,
  X,
  Loader2,
  Zap,
  Search as SearchIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { extractTextFromFile } from '../services/fileService';
import { FileContent, SearchMode } from '../types';

interface SearchBoxProps {
  onSearch: (query: string, focus?: string, files?: FileContent[], mode?: SearchMode) => void;
  initialValue?: string;
  className?: string;
  isResultView?: boolean;
  isGenerating?: boolean;
  initialMode?: SearchMode;
}

const FOCUS_OPTIONS = [
  { id: 'all', label: 'All', icon: Globe, description: 'Search the entire web' },
  { id: 'academic', label: 'Academic', icon: GraduationCap, description: 'Search peer-reviewed papers' },
  { id: 'writing', label: 'Writing', icon: PenTool, description: 'Generate text without search' },
  { id: 'social', label: 'Social', icon: Users, description: 'Search discussions & opinions' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, description: 'Search video transcripts' },
];

const ATTACH_OPTIONS = [
  { id: 'file', label: 'File', icon: FileText, description: 'PDF, Word, or Text' },
  { id: 'image', label: 'Image', icon: ImageIcon, description: 'Analyze or extract text' },
  { id: 'data', label: 'Data', icon: BarChart, description: 'Analyze CSV or Excel' },
  { id: 'code', label: 'Code', icon: Code, description: 'Debug or explain scripts' },
];

const MODE_OPTIONS: { id: SearchMode; label: string; icon: any; description: string }[] = [
  { id: 'search', label: 'Search', icon: Zap, description: 'Fast, direct answers' },
  { id: 'deepsearch', label: 'DeepSearch', icon: SearchIcon, description: 'Exhaustive multi-source research' },
  { id: 'research', label: 'Research', icon: GraduationCap, description: 'Academic-grade reports with citations' },
];

export const SearchBox = ({ onSearch, initialValue = '', className, isResultView, isGenerating, initialMode = 'search' }: SearchBoxProps) => {
  const [query, setQuery] = useState(initialValue);
  const [activeFocus, setActiveFocus] = useState(FOCUS_OPTIONS[0]);
  const [activeMode, setActiveMode] = useState<SearchMode>(initialMode);
  const [isFocusMenuOpen, setIsFocusMenuOpen] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [fileContents, setFileContents] = useState<FileContent[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusMenuRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value);
    autoResize();
  };

  const autoResize = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    autoResize();
  }, [query]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (focusMenuRef.current && !focusMenuRef.current.contains(event.target as Node)) {
        setIsFocusMenuOpen(false);
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setIsAttachMenuOpen(false);
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsProcessingFiles(true);
      const newFiles = Array.from(files);
      setAttachedFiles(prev => [...prev, ...newFiles]);
      
      try {
        const newContents: FileContent[] = await Promise.all(
          newFiles.map(async (file) => {
            try {
              const result = await extractTextFromFile(file);
              const isImageFallback = Array.isArray(result);
              
              return {
                name: file.name,
                type: file.type,
                content: isImageFallback ? JSON.stringify(result) : result as string,
                isImageFallback
              };
            } catch (err) {
              console.error(`Error processing ${file.name}:`, err);
              return {
                name: file.name,
                type: file.type,
                content: `[Error processing file: ${file.name}]`
              };
            }
          })
        );
        setFileContents(prev => [...prev, ...newContents]);
      } catch (error) {
        console.error('Error reading files:', error);
      } finally {
        setIsProcessingFiles(false);
        e.target.value = '';
      }
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    setFileContents(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim() && !isProcessingFiles && !isGenerating) {
      // Ensure we only send files that have been successfully processed
      const validFiles = fileContents.filter(f => f.content !== undefined);
      onSearch(query, activeFocus.id, validFiles, activeMode);
      setQuery('');
      setAttachedFiles([]);
      setFileContents([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const FocusIcon = activeFocus.icon;
  const activeModeOption = MODE_OPTIONS.find(m => m.id === activeMode) || MODE_OPTIONS[0];
  const ModeIcon = activeModeOption.icon;

  return (
    <div className={cn("w-full max-w-3xl mx-auto", className)}>
      <div className={cn(
        "relative flex flex-col bg-card border border-border rounded-2xl transition-all duration-200 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10 shadow-sm",
        isResultView ? "p-2" : "p-4"
      )}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          multiple
        />
        {/* Attached Files Preview */}
        <AnimatePresence>
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 px-2">
              {attachedFiles.map((file, index) => (
                <motion.div
                  key={`${file.name}-${index}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 bg-accent/5 border border-border rounded-lg px-2 py-1 group"
                >
                  <FileText size={14} className="text-muted" />
                  <span className="text-xs font-medium text-foreground max-w-[120px] truncate">
                    {file.name}
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-muted hover:text-red-500 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        <textarea
          ref={textareaRef}
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          className="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none text-foreground placeholder:text-muted text-lg py-1 px-2 min-h-[44px] max-h-[200px]"
          rows={1}
        />
        
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {/* Focus Button & Dropdown */}
            <div className="relative" ref={focusMenuRef}>
              <button 
                onClick={() => setIsFocusMenuOpen(!isFocusMenuOpen)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-sm font-medium cursor-pointer border border-transparent",
                  isFocusMenuOpen 
                    ? "text-accent bg-accent/10 border-accent ring-4 ring-accent/10" 
                    : "text-muted hover:text-accent hover:bg-accent/10"
                )}
              >
                <FocusIcon size={16} />
                <span>{activeFocus.label}</span>
                <ChevronDown size={14} className={cn("transition-transform duration-200", isFocusMenuOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isFocusMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: isResultView ? 10 : -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: isResultView ? 10 : -10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className={cn(
                      "absolute left-0 w-64 bg-card border border-accent ring-4 ring-accent/10 rounded-xl shadow-xl z-50 overflow-hidden",
                      isResultView ? "bottom-full mb-2" : "top-full mt-2"
                    )}
                  >
                    <div className="p-1.5">
                      {FOCUS_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            setActiveFocus(option);
                            setIsFocusMenuOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-start gap-3 p-2.5 rounded-lg transition-colors text-left group cursor-pointer",
                            activeFocus.id === option.id 
                              ? "bg-accent/10" 
                              : "hover:bg-accent/5"
                          )}
                        >
                          <div className={cn(
                            "mt-0.5 p-1.5 rounded-md transition-colors",
                            activeFocus.id === option.id 
                              ? "bg-accent/20 text-accent" 
                              : "bg-accent/5 text-muted group-hover:bg-accent/10"
                          )}>
                            <option.icon size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-sm font-semibold",
                                activeFocus.id === option.id ? "text-accent" : "text-foreground"
                              )}>
                                {option.label}
                              </span>
                              {activeFocus.id === option.id && <Check size={14} className="text-accent" />}
                            </div>
                            <p className="text-xs text-muted line-clamp-1">{option.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mode Button & Dropdown */}
            <div className="relative" ref={modeMenuRef}>
              <button 
                onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-sm font-medium cursor-pointer border border-transparent",
                  isModeMenuOpen 
                    ? "text-accent bg-accent/10 border-accent ring-4 ring-accent/10" 
                    : "text-muted hover:text-accent hover:bg-accent/10"
                )}
              >
                <ModeIcon size={16} />
                <span>{activeModeOption.label}</span>
                <ChevronDown size={14} className={cn("transition-transform duration-200", isModeMenuOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isModeMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: isResultView ? 10 : -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: isResultView ? 10 : -10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className={cn(
                      "absolute left-0 w-64 bg-card border border-accent ring-4 ring-accent/10 rounded-xl shadow-xl z-50 overflow-hidden",
                      isResultView ? "bottom-full mb-2" : "top-full mt-2"
                    )}
                  >
                    <div className="p-1.5">
                      {MODE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            setActiveMode(option.id);
                            setIsModeMenuOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-start gap-3 p-2.5 rounded-lg transition-colors text-left group cursor-pointer",
                            activeMode === option.id 
                              ? "bg-accent/10" 
                              : "hover:bg-accent/5"
                          )}
                        >
                          <div className={cn(
                            "mt-0.5 p-1.5 rounded-md transition-colors",
                            activeMode === option.id 
                              ? "bg-accent/20 text-accent" 
                              : "bg-accent/5 text-muted group-hover:bg-accent/10"
                          )}>
                            <option.icon size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-sm font-semibold",
                                activeMode === option.id ? "text-accent" : "text-foreground"
                              )}>
                                {option.label}
                              </span>
                              {activeMode === option.id && <Check size={14} className="text-accent" />}
                            </div>
                            <p className="text-xs text-muted line-clamp-1">{option.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Attach Button & Dropdown */}
            <div className="relative" ref={attachMenuRef}>
              <button 
                onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-sm font-medium cursor-pointer border border-transparent",
                  isAttachMenuOpen 
                    ? "text-accent bg-accent/10 border-accent ring-4 ring-accent/10" 
                    : "text-muted hover:text-accent hover:bg-accent/10"
                )}
              >
                <Paperclip size={16} />
                <span>Attach</span>
              </button>

              <AnimatePresence>
                {isAttachMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: isResultView ? 10 : -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: isResultView ? 10 : -10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className={cn(
                      "absolute left-1/2 -translate-x-1/2 w-64 bg-card border border-accent ring-4 ring-accent/10 rounded-xl shadow-xl z-50 overflow-hidden",
                      isResultView ? "bottom-full mb-2" : "top-full mt-2"
                    )}
                  >
                    <div className="p-1.5">
                      {ATTACH_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            fileInputRef.current?.click();
                            setIsAttachMenuOpen(false);
                          }}
                          className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/5 transition-colors text-left group cursor-pointer"
                        >
                          <div className="mt-0.5 p-1.5 rounded-md bg-accent/5 text-muted group-hover:bg-accent/10 transition-colors">
                            <option.icon size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-foreground block">
                              {option.label}
                            </span>
                            <p className="text-xs text-muted line-clamp-1">{option.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <button
            onClick={() => handleSubmit()}
            disabled={!query.trim() || isProcessingFiles || isGenerating}
            className={cn(
              "flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200",
              query.trim() && !isProcessingFiles && !isGenerating
                ? "bg-accent text-white hover:bg-accent/80 shadow-md shadow-accent/20 cursor-pointer" 
                : "bg-accent/5 text-muted cursor-not-allowed"
            )}
          >
            {isProcessingFiles ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <ArrowUp size={20} strokeWidth={3} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
