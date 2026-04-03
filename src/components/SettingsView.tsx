import { motion } from 'motion/react';
import { Settings, Moon, Sun, Shield, Trash2, User as UserIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';

interface SettingsViewProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  profile: UserProfile | null;
  onEditProfile: () => void;
  onSaveProfile: (profile: Partial<UserProfile>) => Promise<void>;
}

export const SettingsView = ({ theme, setTheme, profile, onEditProfile, onSaveProfile }: SettingsViewProps) => {
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto py-12 px-6"
    >
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-foreground tracking-tight mb-4">Settings</h1>
        <p className="text-muted text-lg">Manage your account and app preferences.</p>
      </header>

      <div className="space-y-8">
        {/* Appearance */}
        <section className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6 text-foreground">
            <Sun size={24} className="text-accent" />
            <h2 className="text-xl font-bold">Appearance</h2>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 bg-accent/5 rounded-xl border border-border">
              <div className="flex flex-col">
                <span className="font-bold text-foreground">Theme Mode</span>
                <span className="text-sm text-muted">Switch between light and dark mode.</span>
              </div>
              <div className="flex items-center gap-2 p-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg">
                <button 
                  onClick={() => setTheme('light')}
                  className={cn(
                    "px-4 py-2 rounded-md shadow-sm font-medium text-sm flex items-center gap-2 transition-all cursor-pointer",
                    theme === 'light' 
                      ? "bg-white text-accent" 
                      : "text-muted hover:text-foreground"
                  )}
                >
                  <Sun size={16} />
                  <span>Light</span>
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={cn(
                    "px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-all cursor-pointer",
                    theme === 'dark' 
                      ? "bg-zinc-700 text-accent shadow-sm" 
                      : "text-muted hover:text-foreground"
                  )}
                >
                  <Moon size={16} />
                  <span>Dark</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & Security */}
        <section className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6 text-foreground">
            <Shield size={24} className="text-accent" />
            <h2 className="text-xl font-bold">Privacy & Security</h2>
          </div>
          <div className="flex flex-col gap-4">
            <button className="flex items-center justify-between p-4 bg-accent/5 rounded-xl border border-border hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-100 transition-all group cursor-pointer">
              <div className="flex flex-col text-left">
                <span className="font-bold text-foreground group-hover:text-red-700 transition-colors">Clear All History</span>
                <span className="text-sm text-muted">Permanently delete all your past research.</span>
              </div>
              <Trash2 size={20} className="text-muted group-hover:text-red-500 transition-colors" />
            </button>
          </div>
        </section>

        {/* Account */}
        <section className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6 text-foreground">
            <UserIcon size={24} className="text-accent" />
            <h2 className="text-xl font-bold">Account</h2>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 p-4 bg-accent/5 rounded-xl border border-border">
              {profile?.photoURL ? (
                <img 
                  src={profile.photoURL} 
                  alt={profile.displayName || 'User'} 
                  className="w-16 h-16 rounded-full object-cover border-2 border-accent/20"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-white text-2xl font-bold">
                  {getInitials(profile?.displayName)}
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-bold text-foreground text-lg">{profile?.displayName || 'Anonymous User'}</span>
                <span className="text-sm text-muted">{profile?.email || 'No email provided'}</span>
                <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent w-fit">
                  {profile?.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
                </div>
              </div>
              <button 
                onClick={onEditProfile}
                className="ml-auto px-4 py-2 border border-border rounded-lg text-sm font-medium text-muted hover:bg-accent/10 transition-colors cursor-pointer"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
};
