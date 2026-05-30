import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  getDocFromServer 
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Note, SyncStatus } from '../types';
import { db, auth, isFirebaseConfigured, handleFirestoreError, OperationType } from '../lib/firebase';

interface NotesContextType {
  notes: Note[];
  folders: string[];
  tags: string[];
  currentFolder: string;
  currentTag: string;
  sortBy: 'updatedAt' | 'title' | 'createdAt';
  searchQuery: string;
  activeNoteId: string | null;
  isSidebarOpen: boolean;
  syncStatus: SyncStatus;
  user: User | null;
  loading: boolean;
  isFirebaseActive: boolean;
  theme: 'light' | 'dark';
  language: 'vi' | 'en';
  toggleTheme: () => void;
  setLanguage: (lang: 'vi' | 'en') => void;
  setCurrentFolder: (folder: string) => void;
  setCurrentTag: (tag: string) => void;
  setSortBy: (sort: 'updatedAt' | 'title' | 'createdAt') => void;
  setSearchQuery: (query: string) => void;
  setActiveNoteId: (id: string | null) => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
  addNote: (title: string, content: string, folder?: string, color?: string) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>('all');
  const [currentTag, setCurrentTag] = useState<string>('');
  const [sortBy, setSortBy] = useState<'updatedAt' | 'title' | 'createdAt'>('updatedAt');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local-only');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('syncnote_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });
  const [language, setLanguageState] = useState<'vi' | 'en'>(() => {
    const saved = localStorage.getItem('syncnote_lang');
    return (saved === 'en' || saved === 'vi') ? saved : 'vi';
  });

  const setLanguage = (lang: 'vi' | 'en') => {
    setLanguageState(lang);
    localStorage.setItem('syncnote_lang', lang);
  };

  // Apply theme class to document element on mount and change
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('syncnote_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Fallback local storage notes for when user is anonymous/guest or Firebase is unprovisioned
  const getLocalNotes = (): Note[] => {
    const raw = localStorage.getItem('local_sync_notes');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  };

  const saveLocalNotes = (updatedNotes: Note[]) => {
    localStorage.setItem('local_sync_notes', JSON.stringify(updatedNotes));
    if (!user) {
      setNotes(updatedNotes);
    }
  };

  // Test Cloud Firestore Connection once initially as required by skill guidelines
  useEffect(() => {
    if (isFirebaseConfigured && db) {
      const testConnection = async () => {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
          console.log('Firebase connection validated successfully.');
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error('Please check your Firebase configuration: Client reported offline.');
          }
        }
      };
      testConnection();
    }
  }, []);

  // Track Firebase Auth Status
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      setSyncStatus('local-only');
      setNotes(getLocalNotes());
      return;
    }

    setSyncStatus('syncing');
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setSyncStatus('synced');
        // If logged in, let's sync local guest notes up to the cloud!
        syncGuestToCloud(firebaseUser.uid);
      } else {
        setSyncStatus('local-only');
        setNotes(getLocalNotes());
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to cloud Firestore notes in real-time when user is authenticated
  useEffect(() => {
    if (!user || !db) return;

    setLoading(true);
    setSyncStatus('syncing');

    const notesCollection = collection(db, 'notes');
    const userNotesQuery = query(
      notesCollection,
      where('userId', '==', user.uid)
    );

    const unsubscribeNotes = onSnapshot(
      userNotesQuery,
      (snapshot) => {
        const cloudNotes: Note[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          cloudNotes.push({
            id: docSnap.id,
            ...data
          } as Note);
        });

        setNotes(cloudNotes);
        setSyncStatus('synced');
        setLoading(false);
      },
      (error) => {
        setSyncStatus('error');
        setLoading(false);
        // Fallback: Nếu fetch Firestore thất bại (có thể do offline), lấy notes từ localStorage
        setNotes(getLocalNotes());
        try {
          handleFirestoreError(error, OperationType.LIST, 'notes');
        } catch (err) {
          console.error(err);
        }
      }
    );

    return () => unsubscribeNotes();
  }, [user]);
  // Lắng nghe trạng thái online/offline để tự động cập nhật notes
  useEffect(() => {
    const handleOnline = () => {
      // Khi online trở lại, nếu đã đăng nhập thì sẽ tự động sync qua onSnapshot
      setSyncStatus(user ? 'syncing' : 'local-only');
      setLoading(true);
    };
    const handleOffline = () => {
      setSyncStatus('offline');
      // Khi offline, luôn hiển thị notes local
      setNotes(getLocalNotes());
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  // Merge local notes into active cloud storage upon signing in
  const syncGuestToCloud = async (userId: string) => {
    if (!db) return;
    const local = getLocalNotes();
    if (local.length === 0) {
      setLoading(false);
      return;
    }

    setSyncStatus('syncing');
    try {
      for (const note of local) {
        const cloudNoteId = note.id;
        const cloudNoteRef = doc(db, 'notes', cloudNoteId);
        
        await setDoc(cloudNoteRef, {
          title: note.title,
          content: note.content,
          folder: note.folder || 'personal',
          tags: note.tags || [],
          isPinned: note.isPinned || false,
          isFavorite: note.isFavorite || false,
          color: note.color || 'slate',
          userId: userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      // Clean local storage after successful cloud ingestion
      localStorage.removeItem('local_sync_notes');
      console.log('Successfully synchronized local guest notes to your secure cloud account!');
    } catch (error) {
      console.error('Failed to sync guest data to Firestore:', error);
    } finally {
      setLoading(false);
    }
  };

  // 1. Create a Note
  const addNote = async (
    title: string, 
    content: string, 
    folder: string = 'personal', 
    color: string = 'slate'
  ): Promise<Note> => {
    const noteId = 'note_' + Math.random().toString(36).substring(2, 11);
    const nowStr = new Date().toISOString();
    
    const newNote: Note = {
      id: noteId,
      title: title || 'Untitled Note',
      content: content || '',
      folder,
      tags: [],
      isPinned: false,
      isFavorite: false,
      color,
      userId: user ? user.uid : 'guest',
      createdAt: nowStr,
      updatedAt: nowStr
    };

    if (user && db) {
      setSyncStatus('syncing');
      try {
        const noteRef = doc(db, 'notes', noteId);
        await setDoc(noteRef, {
          title: newNote.title,
          content: newNote.content,
          folder: newNote.folder,
          tags: newNote.tags,
          isPinned: newNote.isPinned,
          isFavorite: newNote.isFavorite,
          color: newNote.color,
          userId: newNote.userId,
          createdAt: nowStr,
          updatedAt: nowStr
        });
        setSyncStatus('synced');
      } catch (error) {
        setSyncStatus('error');
        handleFirestoreError(error, OperationType.CREATE, `notes/${noteId}`);
      }
    } else {
      // Offline fallback
      const currentLocal = getLocalNotes();
      const updated = [newNote, ...currentLocal];
      saveLocalNotes(updated);
    }

    return newNote;
  };

  // 2. Update Note Fields
  const updateNote = async (id: string, updates: Partial<Note>): Promise<void> => {
    const nowStr = new Date().toISOString();
    
    if (user && db) {
      setSyncStatus('syncing');
      try {
        const noteRef = doc(db, 'notes', id);
        // Include default fields combined with updates
        const fullUpdates = {
          ...updates,
          updatedAt: nowStr
        };
        await setDoc(noteRef, fullUpdates, { merge: true });
        setSyncStatus('synced');
      } catch (error) {
        setSyncStatus('error');
        handleFirestoreError(error, OperationType.UPDATE, `notes/${id}`);
      }
    } else {
      // Local fallback
      const currentLocal = getLocalNotes();
      const updated = currentLocal.map((note) => {
        if (note.id === id) {
          return {
            ...note,
            ...updates,
            updatedAt: nowStr
          };
        }
        return note;
      });
      saveLocalNotes(updated);
    }
  };

  // 3. Delete Note
  const deleteNote = async (id: string): Promise<void> => {
    if (user && db) {
      setSyncStatus('syncing');
      try {
        const noteRef = doc(db, 'notes', id);
        await deleteDoc(noteRef);
        setSyncStatus('synced');
      } catch (error) {
        setSyncStatus('error');
        handleFirestoreError(error, OperationType.DELETE, `notes/${id}`);
      }
    } else {
      // Local Storage delete
      const currentLocal = getLocalNotes();
      const updated = currentLocal.filter((note) => note.id !== id);
      saveLocalNotes(updated);
    }

    if (activeNoteId === id) {
      setActiveNoteId(null);
    }
  };

  // Pin Status Toggle
  const togglePin = async (id: string): Promise<void> => {
    const target = notes.find(n => n.id === id);
    if (!target) return;
    await updateNote(id, { isPinned: !target.isPinned });
  };

  // Star/Favorite Status Toggle
  const toggleFavorite = async (id: string): Promise<void> => {
    const target = notes.find(n => n.id === id);
    if (!target) return;
    await updateNote(id, { isFavorite: !target.isFavorite });
  };

  // Extract all distinct folders/categories
  const folders = ['all', 'personal', 'work', 'ideas', 'trash'];

  // Extract all tags from existing notes
  const tags = Array.from(
    new Set(notes.flatMap((note) => note.tags || []).filter(Boolean))
  );

  return (
    <NotesContext.Provider value={{
      notes,
      folders,
      tags,
      currentFolder,
      currentTag,
      sortBy,
      searchQuery,
      activeNoteId,
      isSidebarOpen,
      syncStatus,
      user,
      loading,
      isFirebaseActive: isFirebaseConfigured,
      theme,
      language,
      toggleTheme,
      setLanguage,
      setCurrentFolder,
      setCurrentTag,
      setSortBy,
      setSearchQuery,
      setActiveNoteId,
      setIsSidebarOpen,
      addNote,
      updateNote,
      deleteNote,
      toggleFavorite,
      togglePin,
    }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (context === undefined) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
}
