import { useState, useEffect } from 'react';
import { Download, Check } from 'lucide-react';
import { useNotes } from '../context/NotesContext';

// BeforeInstallPromptEvent type (not in standard lib.dom.d.ts yet)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export default function InstallPWAButton() {
  const { theme, language } = useNotes();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  useEffect(() => {
    // Check if app is already installed (display-mode: standalone)
    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as any).standalone === true) {
        setIsInstalled(true);
      }
    };
    checkInstalled();

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent automatic browser prompt
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsInstalling(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
      } else {
        console.log('[PWA] User dismissed the install prompt');
      }
      setDeferredPrompt(null);
    } catch (error) {
      console.error('[PWA] Install failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  // Don't render if already installed
  if (isInstalled) {
    return (
      <div
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 border-2 text-[11px] font-mono font-bold uppercase tracking-wider ${
          theme === 'dark'
            ? 'bg-transparent border-emerald-500/40 text-emerald-400'
            : 'bg-transparent border-emerald-600/40 text-emerald-700'
        }`}
        title={language === 'vi' ? 'Ứng dụng đã được cài đặt' : 'App is installed'}
      >
        <Check className="w-3.5 h-3.5" />
        <span>{language === 'vi' ? 'Đã cài đặt' : 'Installed'}</span>
      </div>
    );
  }

  // Don't render if browser doesn't support install (no prompt available)
  if (!deferredPrompt) return null;

  return (
    <button
      type="button"
      onClick={handleInstall}
      disabled={isInstalling}
      title={language === 'vi' ? 'Cài đặt ứng dụng vào thiết bị' : 'Install app to device'}
      className={`w-full flex items-center justify-center gap-2 px-3 py-2 border-2 text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-wait ${
        theme === 'dark'
          ? 'bg-[var(--color-ink-light)] border-[var(--color-ink-light)] text-zinc-900 hover:bg-[var(--color-paper)]'
          : 'bg-[var(--color-ink)] border-[var(--color-ink)] text-white hover:bg-[var(--color-leather)]'
      }`}
    >
      <Download className={`w-3.5 h-3.5 ${isInstalling ? 'animate-bounce' : ''}`} />
      <span>
        {isInstalling
          ? language === 'vi' ? 'Đang cài...' : 'Installing...'
          : language === 'vi' ? 'Cài đặt App' : 'Install App'}
      </span>
    </button>
  );
}
