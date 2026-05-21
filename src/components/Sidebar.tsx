import React from 'react';
import { 
  BookOpen, 
  Briefcase, 
  Lightbulb, 
  User as UserIcon, 
  Trash2, 
  Tag, 
  LogIn, 
  LogOut, 
  CloudRain, 
  Plus, 
  StickyNote,
  Sun,
  Moon,
  X,
  Globe,
  CheckCircle2
} from 'lucide-react';
import { useNotes } from '../context/NotesContext';
import { loginWithGoogle, logoutUser } from '../lib/firebase';
import { motion } from 'motion/react';
import { t } from '../lib/i18n';

export default function Sidebar() {
  const {
    notes,
    folders,
    tags,
    currentFolder,
    currentTag,
    setCurrentFolder,
    setCurrentTag,
    user,
    isFirebaseActive,
    theme,
    language,
    toggleTheme,
    setLanguage,
    isSidebarOpen,
    setIsSidebarOpen,
  } = useNotes();

  // Map folder keys to distinctive premium color accents and icons
  const getFolderConfig = (folder: string) => {
    switch (folder) {
      case 'all': 
        return {
          icon: <BookOpen className="w-3.5 h-3.5" />,
          colorClass: 'text-sky-400 bg-sky-500/10 border-sky-500/15',
          activeBg: 'bg-slate-900 border-slate-800 text-white',
          badgeClass: 'bg-sky-500/10 text-sky-450 border border-sky-500/10'
        };
      case 'personal': 
        return {
          icon: <UserIcon className="w-3.5 h-3.5" />,
          colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15',
          activeBg: 'bg-slate-900 border-slate-800 text-white',
          badgeClass: 'bg-emerald-500/10 text-emerald-455 border border-emerald-500/10'
        };
      case 'work': 
        return {
          icon: <Briefcase className="w-3.5 h-3.5" />,
          colorClass: 'text-violet-400 bg-violet-500/10 border-violet-500/15',
          activeBg: 'bg-slate-900 border-slate-800 text-white',
          badgeClass: 'bg-violet-500/10 text-violet-450 border border-violet-500/10'
        };
      case 'ideas': 
        return {
          icon: <Lightbulb className="w-3.5 h-3.5" />,
          colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/15',
          activeBg: 'bg-slate-900 border-slate-800 text-white',
          badgeClass: 'bg-amber-500/10 text-amber-450 border border-amber-500/10'
        };
      case 'trash': 
        return {
          icon: <Trash2 className="w-3.5 h-3.5" />,
          colorClass: 'text-rose-400 bg-rose-500/10 border-rose-500/15',
          activeBg: 'bg-slate-900 border-slate-800 text-white',
          badgeClass: 'bg-rose-500/10 text-rose-450 border border-rose-500/10'
        };
      default: 
        return {
          icon: <StickyNote className="w-3.5 h-3.5" />,
          colorClass: 'text-slate-400 bg-slate-500/10 border-slate-500/15',
          activeBg: 'bg-slate-900 border-slate-800 text-white',
          badgeClass: 'bg-slate-500/10 text-slate-400'
        };
    }
  };

  // Human friendly labels with Vietnamese translation
  const getFolderLabel = (folder: string) => {
    switch (folder) {
      case 'all': return t(language, 'all_notes');
      case 'personal': return t(language, 'personal');
      case 'work': return t(language, 'work');
      case 'ideas': return t(language, 'ideas');
      case 'trash': return t(language, 'trash');
      default: return folder.charAt(0).toUpperCase() + folder.slice(1);
    }
  };

  // Count notes for each folder category (excluding trash for 'all' count)
  const getNoteCount = (folder: string) => {
    if (folder === 'all') {
      return notes.filter(n => n.folder !== 'trash').length;
    }
    return notes.filter((n) => n.folder === folder).length;
  };

  // Footnote and theme toggler
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-[var(--color-ink)]/20 dark:bg-[var(--color-leather-dark)]/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside 
        id="app-sidebar"
        className={`fixed md:relative z-50 md:z-auto w-[85vw] max-w-[300px] md:w-[240px] lg:w-[260px] xl:w-[280px] bg-[var(--color-paper-dark)] dark:bg-[var(--color-leather-dark)] text-[var(--color-ink)] dark:text-[var(--color-paper)] flex flex-col h-full border-r-2 border-[var(--color-ink)] dark:border-[var(--color-ink-light)] shrink-0 font-sans transition-transform duration-300 md:translate-x-0 shadow-2xl md:shadow-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 md:p-4 lg:p-5 border-b-2 border-[var(--color-ink)] dark:border-[var(--color-ink-light)] flex items-center justify-between bg-transparent relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-[var(--color-ink)] dark:border-[var(--color-paper)] bg-[var(--color-paper)] dark:bg-[var(--color-leather)] flex items-center justify-center text-[var(--color-ink)] dark:text-[var(--color-paper)] shadow-[3px_3px_0px_#2C2A29] dark:shadow-[3px_3px_0px_#F8F5E6]">
              <StickyNote className="w-5 h-5 drop-shadow-none" />
            </div>
            <div>
              <span className="font-display font-black text-[var(--color-ink)] dark:text-[var(--color-paper)] text-xl tracking-tight leading-none block">SyncNote</span>
              <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--color-ink-light)] dark:text-[var(--color-paper-dark)] uppercase mt-1 block">{t(language, 'classic_edition')}</span>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1.5 text-[var(--color-ink)] dark:text-[var(--color-paper)] hover:bg-[var(--color-paper)] dark:hover:bg-[var(--color-leather)] transition-colors border-2 border-[var(--color-ink)] dark:border-[var(--color-paper)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      {/* Auth Account Profile Sector */}
      <div className="p-4 border-b-2 border-[var(--color-ink)] dark:border-[var(--color-ink-light)] bg-transparent">
        {user ? (
          <div className="p-3 bg-[var(--color-paper)] dark:bg-[var(--color-leather)] border-2 border-[var(--color-ink)] dark:border-[var(--color-ink-light)] flex flex-col gap-3 shadow-[3px_3px_0px_#2C2A29] dark:shadow-[3px_3px_0px_#5A5652]">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="w-10 h-10 border-2 border-[var(--color-ink)] dark:border-[var(--color-paper)]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 border-2 border-[var(--color-ink)] dark:border-[var(--color-paper)] bg-[var(--color-paper)] dark:bg-[var(--color-leather)] text-[var(--color-ink)] dark:text-[var(--color-paper)] flex items-center justify-center font-display font-black text-sm">
                  {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                </div>
              )}
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-sm font-display font-black text-[var(--color-ink)] dark:text-[var(--color-paper)] truncate">
                  {user.displayName || 'User'}
                </p>
                <p className="text-[10px] font-mono text-[var(--color-ink-light)] dark:text-[var(--color-paper-dark)] truncate mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>
            
            <button
              id="btn-logout"
              onClick={logoutUser}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-mono font-bold bg-transparent hover:bg-[var(--color-ink)] dark:hover:bg-[var(--color-paper)] text-[var(--color-ink)] dark:text-[var(--color-paper)] hover:text-[var(--color-paper)] dark:hover:text-[var(--color-leather)] border-2 border-[var(--color-ink)] dark:border-[var(--color-paper)] transition-all cursor-pointer shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#F8F5E6] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        ) : (
          <div className="p-3.5 bg-[var(--color-paper)] dark:bg-[var(--color-leather)] border-2 border-dashed border-[var(--color-ink)] dark:border-[var(--color-ink-light)] flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 border-2 border-[var(--color-ink)] dark:border-[var(--color-paper)] flex items-center justify-center shrink-0 mt-0.5 text-[var(--color-ink)] dark:text-[var(--color-paper)]">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--color-ink-light)] dark:text-[var(--color-paper-dark)] font-sans">
                {isFirebaseActive 
                  ? "Đăng nhập Google để tự động hóa sao lưu và đồng bộ đa thiết bị thời gian thực."
                  : "Cơ sở dữ liệu đang đợi kích hoạt Firestore. Đồng ý điều khoản setup phía trên để mở khóa."}
              </p>
            </div>
            {isFirebaseActive ? (
              <button
                id="btn-login-google"
                onClick={async () => {
                  try {
                    console.log('[Login] Bắt đầu đăng nhập Google...');
                    const user = await loginWithGoogle();
                    console.log('[Login] Đăng nhập thành công:', user?.email);
                  } catch (error: any) {
                    const code = error?.code || 'unknown';
                    const msg = error?.message || String(error);
                    console.error('[Login] Lỗi đăng nhập:', code, msg, error);

                    let userMessage = `Đăng nhập thất bại.\n\nMã lỗi: ${code}\n${msg}`;

                    if (code === 'auth/unauthorized-domain') {
                      userMessage = `❌ Domain hiện tại CHƯA được ủy quyền trong Firebase.\n\n` +
                        `Cách sửa:\n` +
                        `1. Vào Firebase Console → Authentication → Settings → Authorized domains\n` +
                        `2. Thêm domain: ${window.location.hostname}\n` +
                        `3. Lưu và thử lại\n\n` +
                        `Link: https://console.firebase.google.com/project/modular-coast-0mvz5/authentication/settings`;
                    } else if (code === 'auth/popup-blocked') {
                      userMessage = `❌ Popup đăng nhập bị trình duyệt chặn.\n\n` +
                        `Cách sửa: Cho phép popup từ ${window.location.origin} trong cài đặt trình duyệt, sau đó thử lại.`;
                    } else if (code === 'auth/popup-closed-by-user') {
                      userMessage = `⚠️ Bạn đã đóng cửa sổ đăng nhập trước khi hoàn tất.`;
                    } else if (code === 'auth/operation-not-allowed') {
                      userMessage = `❌ Google Sign-In CHƯA được bật trong Firebase Console.\n\n` +
                        `Cách sửa:\n` +
                        `1. Vào Firebase Console → Authentication → Sign-in method\n` +
                        `2. Bật provider "Google"\n` +
                        `3. Lưu và thử lại\n\n` +
                        `Link: https://console.firebase.google.com/project/modular-coast-0mvz5/authentication/providers`;
                    } else if (code === 'auth/network-request-failed') {
                      userMessage = `❌ Lỗi mạng. Có thể do ad-blocker hoặc firewall chặn Firebase.\n\n` +
                        `Cách sửa: Tắt ad-blocker (uBlock, AdBlock...) cho trang này và thử lại.`;
                    }

                    alert(userMessage);
                  }
                }}
                className="mt-1 flex items-center justify-center gap-2 w-full pt-[9px] pb-[8px] border-2 border-[var(--color-ink)] dark:border-[var(--color-paper)] bg-[var(--color-paper-dark)] dark:bg-[var(--color-leather-dark)] text-[var(--color-ink)] dark:text-[var(--color-paper)] hover:bg-[var(--color-ink)] dark:hover:bg-[var(--color-paper)] hover:text-[var(--color-paper)] dark:hover:text-[var(--color-leather)] text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#F8F5E6] hover:-translate-y-[1px] hover:-translate-x-[1px] active:translate-y-0 active:translate-x-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập qua Google</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 p-2 border-2 border-[var(--color-ink)] dark:border-[var(--color-paper)] text-[var(--color-ink)] dark:text-[var(--color-paper)] bg-transparent text-[10px] font-mono font-bold">
                <CloudRain className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                <span>{t(language, 'syncing')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Folder Categories Selection */}
      <div className="p-3 flex-1 overflow-y-auto space-y-6 scrollbar-thin">
        <div>
          <h3 className="px-3 mb-2.5 text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase select-none">
            {t(language, 'all_notes')}
          </h3>
          <ul className="space-y-1">
            {folders.map((folder) => {
              const active = currentFolder === folder && currentTag === '';
              const config = getFolderConfig(folder);
              return (
                <li key={folder}>
                  <button
                    id={`sidebar-folder-${folder}`}
                    onClick={() => {
                      setCurrentFolder(folder);
                      setCurrentTag('');
                    }}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-sans font-medium cursor-pointer transition-all ${
                      active 
                        ? `${config.activeBg} font-semibold ring-1 ring-slate-800 shadows-sm` 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/55'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center border shrink-0 transition-colors ${
                        active ? 'bg-slate-800 border-slate-700/60' : `${config.colorClass}`
                      }`}>
                        {config.icon}
                      </div>
                      <span className="truncate">{getFolderLabel(folder)}</span>
                    </div>
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      active ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'bg-slate-900 text-slate-500 border border-transparent'
                    }`}>
                      {getNoteCount(folder)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Dynamic Tags Filter Sector */}
        {tags.length > 0 && (
          <div>
            <h3 className="px-3 mb-2.5 text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase select-none">
              {t(language, 'tags')}
            </h3>
            <div className="space-y-1">
              <button
                id="sidebar-tag-clear"
                onClick={() => setCurrentTag('')}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-sans font-medium cursor-pointer transition-all ${
                  currentTag === '' 
                    ? 'text-slate-400 bg-slate-900/25 italic border border-dashed border-slate-9 w-full' 
                    : 'text-blue-400 hover:bg-slate-900/50 hover:text-slate-200'
                }`}
              >
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">{t(language, 'tags')} ({tags.length})</span>
              </button>
              
              <ul className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {tags.map((tag) => {
                  const isActive = currentTag === tag;
                  return (
                    <li key={tag}>
                      <button
                        id={`sidebar-tag-${tag}`}
                        onClick={() => {
                          setCurrentTag(tag);
                          // Default folder to 'all' so they see all visual instances
                          setCurrentFolder('all');
                        }}
                        className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-xs font-sans transition-all cursor-pointer ${
                          isActive
                            ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold'
                            : 'text-slate-455 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Tag className={`w-3 h-3 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                          <span className="truncate">#{tag}</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-600 bg-slate-900 px-1 py-0.5 rounded">
                          {notes.filter(n => n.folder !== 'trash' && n.tags?.includes(tag)).length}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Compact Settings & Status Footer */}
      <div className="p-3 border-t-2 border-[var(--color-ink)] dark:border-[var(--color-ink-light)] flex items-center justify-between gap-2 bg-[var(--color-paper-dark)]/50 dark:bg-[var(--color-leather-dark)]/50">
        {/* Theme Toggle */}
        <button
          id="theme-toggle"
          onClick={toggleTheme}
          title={`Chuyển sang ${theme === 'light' ? 'Tối' : 'Sáng'}`}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 border-2 rounded transition-all duration-200 cursor-pointer text-[11px] font-mono font-bold ${
            theme === 'dark'
              ? 'bg-[var(--color-leather)] border-[var(--color-ink-light)] text-[var(--color-paper)] hover:bg-[var(--color-leather-dark)]'
              : 'bg-[var(--color-paper)] border-[var(--color-ink)] text-[var(--color-ink)] hover:bg-[var(--color-paper-dark)]'
          }`}
        >
          {theme === 'light' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{theme === 'light' ? 'Light' : 'Dark'}</span>
        </button>

        {/* Language Toggle */}
        <button
          id="lang-toggle"
          onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
          title={`Chuyển sang ${language === 'vi' ? 'Tiếng Anh' : 'Tiếng Việt'}`}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 border-2 rounded transition-all duration-200 cursor-pointer text-[11px] font-mono font-bold ${
            theme === 'dark'
              ? 'bg-[var(--color-leather)] border-[var(--color-ink-light)] text-[var(--color-paper)] hover:bg-[var(--color-leather-dark)]'
              : 'bg-[var(--color-paper)] border-[var(--color-ink)] text-[var(--color-ink)] hover:bg-[var(--color-paper-dark)]'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{language === 'vi' ? 'VI' : 'EN'}</span>
        </button>

        {/* Status Indicator with Tooltip */}
        <div className="relative group">
          <button
            title="Auto Back-up Ready - Tất cả dữ liệu sẽ tự động sao lưu lên cloud"
            className={`flex items-center justify-center py-2 px-2 border-2 rounded transition-all duration-200 cursor-help ${
              theme === 'dark'
                ? 'bg-[var(--color-leather)] border-[var(--color-ink-light)] hover:bg-[var(--color-leather-dark)]'
                : 'bg-[var(--color-paper)] border-[var(--color-ink)] hover:bg-[var(--color-paper-dark)]'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 animate-pulse ${
              theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
            }`} />
          </button>
          {/* Tooltip */}
          <div className={`absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] font-mono whitespace-nowrap rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${
            theme === 'dark'
              ? 'bg-[var(--color-leather-dark)] text-[var(--color-paper)] border border-[var(--color-ink-light)]'
              : 'bg-[var(--color-ink)] text-[var(--color-paper)] border border-[var(--color-ink)]'
          }`}>
            Auto Back-up Ready
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
