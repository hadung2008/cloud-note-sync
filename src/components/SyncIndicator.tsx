import React from 'react';
import { Cloud, CloudLightning, RefreshCw, Smartphone, WifiOff } from 'lucide-react';
import { useNotes } from '../context/NotesContext';
import { t } from '../lib/i18n';

export default function SyncIndicator() {
  const { syncStatus, isFirebaseActive, theme, language } = useNotes();

  if (!isFirebaseActive) {
    return (
      <div 
        id="sync-indicator-local"
        className={`flex items-center gap-1.5 px-3 py-1.5 border-2 text-xs font-mono font-bold transition-all ${
          theme === 'dark' 
            ? 'bg-transparent text-[var(--color-paper)] border-[var(--color-ink-light)]' 
            : 'bg-transparent text-[var(--color-ink)] border-[var(--color-ink)] shadow-[2px_2px_0px_#2C2A29]'
        }`}
        title="Firebase connection not configured. Notes are securely saved in your local browser storage."
      >
        <Smartphone className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-[var(--color-paper)]' : 'text-[var(--color-ink)]'}`} />
        <span>{t(language, 'sync_local')}</span>
      </div>
    );
  }

  switch (syncStatus) {
    case 'synced':
      return (
        <div 
          id="sync-indicator-synced"
          className={`flex items-center gap-1.5 px-3 py-1.5 border-2 text-xs font-mono font-bold transition-all ${
            theme === 'dark' 
              ? 'bg-[var(--color-leather-dark)] text-emerald-400 border-[var(--color-ink-light)]' 
              : 'bg-transparent text-emerald-700 border-emerald-700 shadow-[2px_2px_0px_1px_rgba(4,120,87,1)]'
          }`}
          title="All notes are successfully backed up to your secure cloud database."
        >
          <Cloud className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-emerald-500' : 'text-emerald-700'} animate-pulse`} />
          <span>{t(language, 'sync_synced')}</span>
        </div>
      );
    case 'syncing':
      return (
        <div 
          id="sync-indicator-syncing"
          className={`flex items-center gap-1.5 px-3 py-1.5 border-2 text-xs font-mono font-bold transition-all ${
            theme === 'dark' 
              ? 'bg-[var(--color-leather-dark)] text-sky-400 border-[var(--color-ink-light)]' 
              : 'bg-transparent text-sky-700 border-sky-700 shadow-[2px_2px_0px_1px_rgba(3,105,161,1)]'
          }`}
          title="Uploading latest changes..."
        >
          <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin" />
          <span>{t(language, 'sync_syncing')}</span>
        </div>
      );
    case 'offline':
      return (
        <div 
          id="sync-indicator-offline"
          className={`flex items-center gap-1.5 px-3 py-1.5 border-2 text-xs font-mono font-bold transition-all ${
            theme === 'dark' 
              ? 'bg-[var(--color-leather-dark)] text-amber-500 border-[var(--color-ink-light)]' 
              : 'bg-transparent text-amber-700 border-amber-700 shadow-[2px_2px_0px_1px_rgba(180,83,9,1)]'
          }`}
          title="Device is currently offline. Changes will auto-sync when connection is restored."
        >
          <WifiOff className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-amber-500' : 'text-amber-700'}`} />
          <span>{t(language, 'sync_offline')}</span>
        </div>
      );
    case 'error':
      return (
        <div 
          id="sync-indicator-error"
          className={`flex items-center gap-1.5 px-3 py-1.5 border-2 text-xs font-mono font-bold transition-all ${
            theme === 'dark' 
              ? 'bg-[var(--color-leather-dark)] text-rose-400 border-[var(--color-ink-light)]' 
              : 'bg-transparent text-rose-700 border-rose-700 shadow-[2px_2px_0px_1px_rgba(190,18,60,1)]'
          }`}
          title="Sync error occurred. Ensure your permissions or network are stable."
        >
          <CloudLightning className="w-3.5 h-3.5 text-rose-600" />
          <span>{t(language, 'sync_error_msg')}</span>
        </div>
      );
    default:
      return (
        <div 
          id="sync-indicator-info"
          className={`flex items-center gap-1.5 px-3 py-1.5 border-2 text-xs font-mono font-bold transition-all ${
            theme === 'dark' 
              ? 'bg-transparent text-[var(--color-paper)] border-[var(--color-ink-light)]' 
              : 'bg-transparent text-[var(--color-ink)] border-[var(--color-ink)] shadow-[2px_2px_0px_#2C2A29]'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>{t(language, 'sync_local')}</span>
        </div>
      );
  }
}
