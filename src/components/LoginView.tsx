import { motion } from 'motion/react';
import { LogIn, ShieldCheck, Zap, Search, Bookmark } from 'lucide-react';
import { signInWithGoogle } from '../firebase';
import { Logo } from './Logo';

export const LoginView = () => {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-md flex flex-col items-center py-6 sm:py-10 md:py-0 md:-mt-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full glass-card p-5 sm:p-8 flex flex-col items-center text-center shadow-2xl"
        >
          <div className="mb-6">
            <Logo size={48} showText={false} />
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mb-2 tracking-tight">
            Welcome to Atlus AI
          </h1>
          <p className="text-sm text-muted mb-6 leading-relaxed px-2">
            The most intelligent way to research, discover, and organize your knowledge.
          </p>

          <div className="grid grid-cols-1 gap-3 mb-6 w-full text-left">
            <div className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/5 transition-colors">
              <div className="mt-1 text-accent shrink-0">
                <Search size={16} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">Deep Research</h3>
                <p className="text-[11px] text-muted leading-tight">Get comprehensive answers with real-time web sources.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/5 transition-colors">
              <div className="mt-1 text-accent shrink-0">
                <Bookmark size={16} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">Personal Library</h3>
                <p className="text-[11px] text-muted leading-tight">Save and organize your research for future reference.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/5 transition-colors">
              <div className="mt-1 text-accent shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">Secure & Private</h3>
                <p className="text-[11px] text-muted leading-tight">Your data is stored locally and protected by Atlus AI.</p>
              </div>
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                console.log('Attempting login...');
                await signInWithGoogle();
                console.log('Login successful');
              } catch (error) {
                console.error('Login failed:', error);
                alert('Login failed: ' + (error instanceof Error ? error.message : String(error)));
              }
            }}
            className="w-full flex items-center justify-center gap-3 bg-foreground text-background py-3 px-6 rounded-xl font-medium hover:opacity-90 transition-opacity cursor-pointer shadow-lg shadow-foreground/10 shrink-0"
          >
            <LogIn size={18} />
            Sign in with Google
          </button>
          
          <p className="mt-6 text-[10px] text-muted leading-tight">
            By signing in, you agree to our <br className="sm:hidden" /> Terms of Service and Privacy Policy.
          </p>
        </motion.div>
        
        <footer className="mt-6 text-center shrink-0">
          <p className="text-xs text-muted font-medium tracking-tight">
            Powered by Atlus AI
          </p>
        </footer>
      </div>
    </div>
  );
};
