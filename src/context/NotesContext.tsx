import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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

  // Cache helpers for logged-in users (Network-first strategy: online → cache → offline)
  const getNotesCache = (): Note[] => {
    const raw = localStorage.getItem('syncnote_notes_cache');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  };

  const saveNotesCache = (notesData: Note[]) => {
    localStorage.setItem('syncnote_notes_cache', JSON.stringify(notesData));
  };

  // Pending sync queue: stores offline mutations waiting to be flushed to Firebase
  type PendingOp =
    | { type: 'upsert'; id: string; data: Partial<Note> & { userId: string } }
    | { type: 'delete'; id: string };

  const getPendingQueue = (): PendingOp[] => {
    const raw = localStorage.getItem('syncnote_pending_queue');
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  };

  const savePendingQueue = (queue: PendingOp[]) => {
    localStorage.setItem('syncnote_pending_queue', JSON.stringify(queue));
  };

  const enqueuePending = (op: PendingOp) => {
    const queue = getPendingQueue();
    // Collapse duplicate upserts/deletes for the same note id (last-write-wins per id)
    if (op.type === 'upsert') {
      const idx = queue.findIndex(q => q.id === op.id);
      if (idx >= 0 && queue[idx].type === 'upsert') {
        queue[idx] = { type: 'upsert', id: op.id, data: { ...(queue[idx] as any).data, ...op.data } };
      } else if (idx >= 0) {
        queue[idx] = op; // delete -> upsert override
      } else {
        queue.push(op);
      }
    } else {
      // delete supersedes prior upserts of same id
      const filtered = queue.filter(q => q.id !== op.id);
      filtered.push(op);
      savePendingQueue(filtered);
      return;
    }
    savePendingQueue(queue);
  };

  // Track online/offline status
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  // Ref mirrors latest notes for use inside event listeners without re-binding
  const notesRef = useRef<Note[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keep notesRef in sync
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

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

    // 🚀 Preload cache IMMEDIATELY so UI works offline / before first network response
    const cached = getNotesCache();
    if (cached.length > 0) {
      setNotes(cached);
      setLoading(false);
      setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
    } else {
      setLoading(true);
      setSyncStatus('syncing');
    }

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

        // 🔀 Merge cloud snapshot with pending offline changes to prevent data loss
        const pending = getPendingQueue();
        let merged = cloudNotes;
        if (pending.length > 0) {
          const map = new Map(cloudNotes.map(n => [n.id, n]));
          for (const op of pending) {
            if (op.type === 'delete') {
              map.delete(op.id);
            } else {
              const existing = map.get(op.id);
              map.set(op.id, { ...(existing || {} as Note), ...op.data, id: op.id } as Note);
            }
          }
          merged = Array.from(map.values());
        }

        setNotes(merged);
        // 💾 Cache merged view (cloud + pending overrides) for offline access
        saveNotesCache(merged);
        setSyncStatus(pending.length > 0 ? 'syncing' : 'synced');
        setLoading(false);
      },
      (error) => {
        // 🔄 Network-first strategy: Fall back to cache if error
        const cached = getNotesCache();
        if (cached.length > 0 && !navigator.onLine) {
          setNotes(cached);
          setSyncStatus('offline');
          console.log('[Offline] Loaded notes from cache');
        } else if (cached.length > 0) {
          setNotes(cached);
          setSyncStatus('error');
          console.log('[Error] Using cached notes as fallback');
        } else {
          setSyncStatus('error');
        }
        setLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'notes');
        } catch (err) {
          console.error(err);
        }
      }
    );

    return () => unsubscribeNotes();
  }, [user]);

  // 🔁 Flush pending queue to Firebase
  const flushPendingQueue = async () => {
    if (!user || !db) return;
    const queue = getPendingQueue();
    if (queue.length === 0) return;

    setSyncStatus('syncing');
    const remaining: PendingOp[] = [];
    for (const op of queue) {
      try {
        if (op.type === 'delete') {
          await deleteDoc(doc(db, 'notes', op.id));
        } else {
          await setDoc(doc(db, 'notes', op.id), op.data, { merge: true });
        }
      } catch (err) {
        console.warn('[Sync] Failed to flush op, keeping in queue', op, err);
        remaining.push(op);
      }
    }
    savePendingQueue(remaining);
    if (remaining.length === 0) {
      setSyncStatus('synced');
    } else {
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    }
  };

  // Auto-flush when connection restored
  useEffect(() => {
    if (isOnline && user && db) {
      flushPendingQueue();
    }
  }, [isOnline, user]);

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
      // 🚀 Optimistic UI: update state + cache BEFORE network call
      const optimistic = [newNote, ...notesRef.current];
      setNotes(optimistic);
      saveNotesCache(optimistic);

      const payload = {
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
      };

      if (!navigator.onLine) {
        // Offline: queue for later sync (Firebase SDK without persistence would silently buffer)
        enqueuePending({ type: 'upsert', id: noteId, data: { ...payload, userId: user.uid } });
        setSyncStatus('offline');
      } else {
        setSyncStatus('syncing');
        try {
          await setDoc(doc(db, 'notes', noteId), payload);
          setSyncStatus('synced');
        } catch (error) {
          enqueuePending({ type: 'upsert', id: noteId, data: { ...payload, userId: user.uid } });
          setSyncStatus(navigator.onLine ? 'error' : 'offline');
          handleFirestoreError(error, OperationType.CREATE, `notes/${noteId}`);
        }
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
      // 🚀 Optimistic UI: update state + cache BEFORE network call
      const optimistic = notesRef.current.map(n =>
        n.id === id ? { ...n, ...updates, updatedAt: nowStr } : n
      );
      setNotes(optimistic);
      saveNotesCache(optimistic);

      const fullUpdates = { ...updates, updatedAt: nowStr };

      if (!navigator.onLine) {
        enqueuePending({ type: 'upsert', id, data: { ...fullUpdates, userId: user.uid } });
        setSyncStatus('offline');
      } else {
        setSyncStatus('syncing');
        try {
          await setDoc(doc(db, 'notes', id), fullUpdates, { merge: true });
          setSyncStatus('synced');
        } catch (error) {
          enqueuePending({ type: 'upsert', id, data: { ...fullUpdates, userId: user.uid } });
          setSyncStatus(navigator.onLine ? 'error' : 'offline');
          handleFirestoreError(error, OperationType.UPDATE, `notes/${id}`);
        }
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
      // 🚀 Optimistic UI: remove from state + cache BEFORE network call
      const optimistic = notesRef.current.filter(n => n.id !== id);
      setNotes(optimistic);
      saveNotesCache(optimistic);

      if (!navigator.onLine) {
        enqueuePending({ type: 'delete', id });
        setSyncStatus('offline');
      } else {
        setSyncStatus('syncing');
        try {
          await deleteDoc(doc(db, 'notes', id));
          setSyncStatus('synced');
        } catch (error) {
          enqueuePending({ type: 'delete', id });
          setSyncStatus(navigator.onLine ? 'error' : 'offline');
          handleFirestoreError(error, OperationType.DELETE, `notes/${id}`);
        }
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
