import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  User, 
  MessageSquare, 
  Globe, 
  Clock, 
  Zap, 
  Shield, 
  Download, 
  Trash2, 
  Save,
  Camera,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onSave: (updatedProfile: Partial<UserProfile>) => Promise<void>;
  onExportData: () => void;
  onDeleteAccount: () => void;
}

export const ProfileModal = ({ 
  isOpen, 
  onClose, 
  profile, 
  onSave, 
  onExportData, 
  onDeleteAccount 
}: ProfileModalProps) => {
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'identity' | 'ai' | 'preferences' | 'data'>('identity');

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        bio: profile.bio || '',
        customInstructions: profile.customInstructions || '',
        language: profile.language || 'English',
        timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        units: profile.units || 'metric',
      });
    }
  }, [profile, isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'identity', label: 'Identity', icon: User },
    { id: 'ai', label: 'AI Personalization', icon: MessageSquare },
    { id: 'preferences', label: 'Preferences', icon: Globe },
    { id: 'data', label: 'Data & Privacy', icon: Shield },
  ] as const;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
          >
            {/* Sidebar Tabs */}
            <div className="w-full md:w-64 bg-accent/5 border-b md:border-b-0 md:border-r border-border p-6 flex flex-col gap-2 shrink-0">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground tracking-tight">Edit Profile</h2>
                <p className="text-xs text-muted">Customize your AI experience.</p>
              </div>
              
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer",
                    activeTab === tab.id 
                      ? "bg-accent text-white shadow-lg shadow-accent/20" 
                      : "text-muted hover:bg-accent/10 hover:text-accent"
                  )}
                >
                  <tab.icon size={18} />
                  <span>{tab.label}</span>
                </button>
              ))}

              <div className="mt-auto pt-6 border-t border-border hidden md:block">
                <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">
                    {profile?.displayName?.[0] || 'U'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-foreground truncate">{profile?.displayName}</span>
                    <span className="text-[10px] text-muted truncate">{profile?.plan?.toUpperCase()} PLAN</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-card">
              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                {activeTab === 'identity' && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col items-center gap-4 mb-8">
                      <div className="relative group">
                        {profile?.photoURL ? (
                          <img 
                            src={profile.photoURL} 
                            alt="Profile" 
                            className="w-24 h-24 rounded-full object-cover border-4 border-accent/20"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center text-accent text-3xl font-bold border-4 border-accent/20">
                            {profile?.displayName?.[0] || 'U'}
                          </div>
                        )}
                        <button className="absolute bottom-0 right-0 p-2 bg-accent text-white rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer">
                          <Camera size={16} />
                        </button>
                      </div>
                      <div className="text-center">
                        <h3 className="font-bold text-foreground">Profile Picture</h3>
                        <p className="text-xs text-muted">JPG, PNG or GIF. Max 2MB.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">Display Name</label>
                        <input 
                          type="text"
                          value={formData.displayName}
                          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                          className="w-full bg-accent/5 border border-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-accent outline-none transition-all"
                          placeholder="Your name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">Bio</label>
                        <textarea 
                          value={formData.bio}
                          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                          className="w-full bg-accent/5 border border-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-accent outline-none transition-all min-h-[100px] resize-none"
                          placeholder="Tell us a bit about yourself..."
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'ai' && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="p-4 bg-accent/5 rounded-2xl border border-accent/20 flex gap-4">
                      <Zap className="text-accent shrink-0" size={24} />
                      <div className="space-y-1">
                        <h3 className="font-bold text-foreground">Custom Instructions</h3>
                        <p className="text-xs text-muted">Tell the AI how to respond and what to remember about you.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">What should the AI know about you?</label>
                        <textarea 
                          value={formData.customInstructions}
                          onChange={(e) => setFormData({ ...formData, customInstructions: e.target.value })}
                          className="w-full bg-accent/5 border border-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-accent outline-none transition-all min-h-[150px] resize-none"
                          placeholder="e.g., I am a software engineer who prefers concise, technical explanations with code examples."
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'preferences' && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Globe size={16} className="text-accent" />
                          Language
                        </label>
                        <select 
                          value={formData.language}
                          onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                          className="w-full bg-accent/5 border border-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-accent outline-none transition-all"
                        >
                          <option>English</option>
                          <option>Spanish</option>
                          <option>French</option>
                          <option>German</option>
                          <option>Chinese</option>
                          <option>Japanese</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Clock size={16} className="text-accent" />
                          Timezone
                        </label>
                        <select 
                          value={formData.timezone}
                          onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                          className="w-full bg-accent/5 border border-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-accent outline-none transition-all"
                        >
                          <option>{Intl.DateTimeFormat().resolvedOptions().timeZone}</option>
                          <option>UTC</option>
                          <option>America/New_York</option>
                          <option>Europe/London</option>
                          <option>Asia/Tokyo</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground">Measurement Units</label>
                        <div className="flex gap-2 p-1 bg-accent/5 rounded-xl border border-border">
                          <button 
                            onClick={() => setFormData({ ...formData, units: 'metric' })}
                            className={cn(
                              "flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
                              formData.units === 'metric' ? "bg-card text-accent shadow-sm" : "text-muted"
                            )}
                          >
                            Metric (km, °C)
                          </button>
                          <button 
                            onClick={() => setFormData({ ...formData, units: 'imperial' })}
                            className={cn(
                              "flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
                              formData.units === 'imperial' ? "bg-card text-accent shadow-sm" : "text-muted"
                            )}
                          >
                            Imperial (mi, °F)
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'data' && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-8"
                  >
                    <div className="space-y-4">
                      <h3 className="font-bold text-foreground flex items-center gap-2">
                        <Download size={18} className="text-accent" />
                        Data Export
                      </h3>
                      <p className="text-sm text-muted">Download a complete copy of your research data, chat history, and library items in JSON format.</p>
                      <button 
                        onClick={onExportData}
                        className="flex items-center gap-2 px-6 py-3 bg-accent/5 border border-border rounded-xl text-foreground font-bold hover:bg-accent/10 transition-all cursor-pointer"
                      >
                        <Download size={18} />
                        Export My Data
                      </button>
                    </div>

                    <div className="pt-8 border-t border-border space-y-4">
                      <h3 className="font-bold text-red-500 flex items-center gap-2">
                        <AlertTriangle size={18} />
                        Danger Zone
                      </h3>
                      <p className="text-sm text-muted">Permanently delete your account and all associated data. This action cannot be undone.</p>
                      <button 
                        onClick={onDeleteAccount}
                        className="flex items-center gap-2 px-6 py-3 bg-red-500/5 border border-red-500/20 rounded-xl text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                      >
                        <Trash2 size={18} />
                        Delete Account
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-border flex items-center justify-between bg-card">
                <button 
                  onClick={onClose}
                  className="px-6 py-2.5 text-sm font-bold text-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-3">
                  {saveSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 text-green-500 text-sm font-bold"
                    >
                      <CheckCircle2 size={16} />
                      Saved!
                    </motion.div>
                  )}
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className={cn(
                      "flex items-center gap-2 px-8 py-2.5 bg-accent text-white rounded-xl font-bold shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                      isSaving && "animate-pulse"
                    )}
                  >
                    <Save size={18} />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>

            {/* Close Button Mobile */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-card/80 backdrop-blur-sm border border-border rounded-full text-muted hover:text-foreground md:hidden z-10"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
