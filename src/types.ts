export interface SubNote {
  id: string;
  title: string;
  isCompleted?: boolean;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  isPinned: boolean;
  isFavorite: boolean;
  color: string; // e.g. "slate" | "blue" | "amber" | "emerald" | "rose"
  userId: string;
  createdAt: any; // firebase timestamp, ISO string, etc.
  updatedAt: any;
  subNotes?: SubNote[];
  images?: string[];
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'local-only';

export interface Folder {
  id: string;
  name: string;
  icon: string;
}
