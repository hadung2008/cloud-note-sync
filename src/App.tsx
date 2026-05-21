import React from 'react';
import Sidebar from './components/Sidebar';
import NotesList from './components/NotesList';
import NoteEditor from './components/NoteEditor';
import { NotesProvider, useNotes } from './context/NotesContext';
import { t } from './lib/i18n';

function AppContent() {
  const { loading, language } = useNotes();

  if (loading) {
    return (
      <div 
        id="app-loader"
        className="h-screen w-screen flex flex-col items-center justify-center bg-slate-55 text-slate-600"
      >
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-sans font-semibold tracking-tight text-slate-500 animate-pulse">
          {t(language, 'loading_data')}
        </p>
      </div>
    );
  }

  return (
    <div 
      id="app-viewport"
      className="flex h-[100dvh] w-screen overflow-hidden bg-[var(--color-paper)] dark:bg-[var(--color-leather-dark)] selection:bg-[var(--color-sepia)]/40 selection:text-[var(--color-ink)] overscroll-none"
    >
      <Sidebar />
      <NotesList />
      <NoteEditor />
    </div>
  );
}

export default function App() {
  return (
    <NotesProvider>
      <AppContent />
    </NotesProvider>
  );
}
