import React from 'react';
import { 
  Plus, 
  Search, 
  Library, 
  History, 
  Settings, 
  Hexagon,
  X,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ViewState, UserProfile } from '../types';
import { auth, logOut } from '../firebase';
import { Logo } from './Logo';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  showLabel?: boolean;
}

const NavItem = ({ icon: Icon, label, active, onClick, className, showLabel }: NavItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      "group relative flex items-center gap-3 rounded-lg transition-all duration-200 cursor-pointer",
      showLabel ? "w-full px-4 py-3" : "justify-center w-10 h-10",
      active 
        ? "bg-accent text-white shadow-md shadow-accent/20" 
        : "text-muted hover:bg-accent/10 hover:text-accent",
      className
    )}
    title={label}
  >
    <Icon size={20} />
    {showLabel && <span className="font-medium">{label}</span>}
    {active && !showLabel && (
      <div className="absolute left-[-12px] w-1 h-5 bg-accent rounded-full" />
    )}
  </button>
);

interface SidebarProps {
  onNewSearch: () => void;
  setView: (view: ViewState) => void;
  activeView: ViewState;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  profile: UserProfile | null;
}

export const Sidebar = ({ onNewSearch, setView, activeView, isSidebarOpen, onToggleSidebar, profile }: SidebarProps) => {
  const handleNavClick = (view: ViewState, callback?: () => void) => {
    if (callback) callback();
    setView(view);
    if (window.innerWidth < 768) {
      onToggleSidebar();
    }
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="hidden md:flex flex-col bg-card border-r border-border p-6 h-full shrink-0 overflow-hidden whitespace-nowrap"
          >
            <div className="flex items-center justify-between mb-10">
              <div 
                className="cursor-pointer"
                onClick={() => handleNavClick('home', onNewSearch)}
              >
                <Logo size={32} />
              </div>
              <button 
                onClick={onToggleSidebar}
                className="p-2 text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

        <nav className="flex flex-col gap-2">
          <NavItem 
            icon={Plus} 
            label="New Search" 
            active={activeView === 'home' || activeView === 'result'} 
            showLabel
            onClick={() => handleNavClick('home', onNewSearch)}
          />
          <NavItem 
            icon={Search} 
            label="Discover" 
            active={activeView === 'discover'}
            showLabel 
            onClick={() => handleNavClick('discover')} 
          />
          <NavItem 
            icon={Library} 
            label="Library" 
            active={activeView === 'library'}
            showLabel 
            onClick={() => handleNavClick('library')} 
          />
          <NavItem 
            icon={History} 
            label="History" 
            active={activeView === 'history'}
            showLabel 
            onClick={() => handleNavClick('history')} 
          />
        </nav>

        <div className="mt-auto pt-6 border-t border-border flex flex-col gap-2">
          <NavItem 
            icon={Settings} 
            label="Settings" 
            active={activeView === 'settings'}
            showLabel 
            onClick={() => handleNavClick('settings')} 
          />
          
          {profile && (
            <div className="flex items-center justify-between p-3 bg-accent/5 rounded-xl mt-2 overflow-hidden">
              <div className="flex items-center gap-2 min-w-0">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt={profile.displayName || ''} className="w-8 h-8 rounded-full shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold shrink-0 text-xs">
                    {profile.displayName?.charAt(0) || profile.email?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {profile.displayName || 'User'}
                  </span>
                  <span className="text-[10px] text-muted truncate">
                    {profile.email}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => logOut()}
                className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Log Out"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </motion.aside>
    )}
  </AnimatePresence>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {(isSidebarOpen && typeof window !== 'undefined' && window.innerWidth < 768) && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onToggleSidebar}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
            />
            
            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-[90%] sm:w-80 bg-card z-[70] shadow-2xl flex flex-col p-6 border-r border-border"
            >
              <div className="flex items-center justify-between mb-10">
                <div 
                  className="cursor-pointer"
                  onClick={() => handleNavClick('home', onNewSearch)}
                >
                  <Logo size={32} />
                </div>
                <button 
                  onClick={onToggleSidebar}
                  className="p-2 text-muted hover:text-accent hover:bg-accent/10 rounded-full transition-colors cursor-pointer"
                >
                  <X size={24} />
                </button>
              </div>

              <nav className="flex flex-col gap-2">
                <NavItem 
                  icon={Plus} 
                  label="New Search" 
                  active={activeView === 'home' || activeView === 'result'} 
                  showLabel
                  onClick={() => handleNavClick('home', onNewSearch)}
                />
                <NavItem 
                  icon={Search} 
                  label="Discover" 
                  active={activeView === 'discover'}
                  showLabel 
                  onClick={() => handleNavClick('discover')} 
                />
                <NavItem 
                  icon={Library} 
                  label="Library" 
                  active={activeView === 'library'}
                  showLabel 
                  onClick={() => handleNavClick('library')} 
                />
                <NavItem 
                  icon={History} 
                  label="History" 
                  active={activeView === 'history'}
                  showLabel 
                  onClick={() => handleNavClick('history')} 
                />
              </nav>

              <div className="mt-auto pt-6 border-t border-border flex flex-col gap-2">
                <NavItem 
                  icon={Settings} 
                  label="Settings" 
                  active={activeView === 'settings'}
                  showLabel 
                  onClick={() => handleNavClick('settings')} 
                />
                
                {profile && (
                  <div className="flex items-center justify-between p-4 bg-accent/5 rounded-xl mt-2">
                    <div className="flex items-center gap-3">
                      {profile.photoURL ? (
                        <img src={profile.photoURL} alt={profile.displayName || ''} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-bold">
                          {profile.displayName?.charAt(0) || profile.email?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-semibold text-foreground truncate max-w-[120px]">
                          {profile.displayName || 'User'}
                        </span>
                        <span className="text-xs text-muted truncate max-w-[120px]">
                          {profile.email}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => logOut()}
                      className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Log Out"
                    >
                      <LogOut size={18} />
                    </button>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
