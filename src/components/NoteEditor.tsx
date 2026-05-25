import React, { useState, useEffect, useRef } from 'react';
import { 
  Pin, 
  Star, 
  Trash2, 
  FolderOpen, 
  Eye, 
  Edit3, 
  Tag as TagIcon, 
  X, 
  Check, 
  Undo,
  BookOpen,
  Palette,
  Image as ImageIcon,
  Plus,
  Trash,
  UploadCloud,
  Link as LinkIcon,
  Maximize2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Play,
  Pause,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Code,
  Quote,
  Highlighter,
  ChevronDown
} from 'lucide-react';
import { useNotes } from '../context/NotesContext';
import { Note } from '../types';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { t } from '../lib/i18n';

export default function NoteEditor() {
  const {
    notes,
    activeNoteId,
    setActiveNoteId,
    updateNote,
    deleteNote,
    togglePin,
    toggleFavorite,
    theme,
    language,
  } = useNotes();

  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [tagInput, setTagInput] = useState<string>('');
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState<boolean>(false);
  const thumbnailStripRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [showChecklistSection, setShowChecklistSection] = useState<boolean>(true);
  const [showImagesSection, setShowImagesSection] = useState<boolean>(true);
  const editorTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  // Local buffer for the editor textarea + debounced commit to global state.
  // Binding the textarea to a stable local value (instead of the global note
  // updated on every keystroke) preserves the browser's native undo/redo
  // stack so Ctrl+Z / Ctrl+Shift+Z work as expected for both typing and
  // toolbar formatting actions (which use document.execCommand).
  const [localContent, setLocalContent] = useState<string>('');
  const localNoteIdRef = useRef<string | null>(null);
  const contentCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save selection before blur
  const saveSelection = () => {
    const ta = editorTextareaRef.current;
    if (ta) {
      selectionRef.current = {
        start: ta.selectionStart ?? 0,
        end: ta.selectionEnd ?? 0,
      };
    }
  };

  // Restore saved selection and focus
  const restoreSelection = () => {
    const ta = editorTextareaRef.current;
    if (ta && selectionRef.current) {
      ta.focus();
      ta.setSelectionRange(selectionRef.current.start, selectionRef.current.end);
    }
  };

  // Find active note from current state
  const activeNote = notes.find((note) => note.id === activeNoteId);
  const isTrash = activeNote ? activeNote.folder === 'trash' : false;

  // Auto-switch tabs: open 'edit' for newly created notes, 'preview' for existing ones
  useEffect(() => {
    if (!activeNote) return;
    
    // Check if note was just created (within last 2 seconds)
    const createdTime = new Date(activeNote.createdAt).getTime();
    const now = Date.now();
    const isNewlyCreated = (now - createdTime) < 2000;
    
    setActiveTab(isNewlyCreated ? 'edit' : 'preview');
  }, [activeNoteId, activeNote]);

  // Close lightbox & stop slideshow whenever switching notes
  useEffect(() => {
    setLightboxIndex(null);
    setIsSlideshowPlaying(false);
  }, [activeNoteId]);

  // Sync local editor buffer when switching notes. Flush any pending debounced
  // commit from the previous note first so no edits are lost.
  useEffect(() => {
    if (contentCommitTimerRef.current) {
      clearTimeout(contentCommitTimerRef.current);
      contentCommitTimerRef.current = null;
    }
    const prevId = localNoteIdRef.current;
    if (prevId && prevId !== activeNoteId) {
      const prevNote = notes.find((n) => n.id === prevId);
      if (prevNote && prevNote.content !== localContent) {
        updateNote(prevId, { content: localContent });
      }
    }
    localNoteIdRef.current = activeNoteId;
    setLocalContent(activeNote?.content || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNoteId]);

  // Keep local buffer in sync when the active note's content is updated from
  // elsewhere (e.g. cloud sync) AND the user isn't actively editing.
  useEffect(() => {
    if (!activeNote) return;
    if (contentCommitTimerRef.current) return; // user is typing, don't override
    const remote = activeNote.content || '';
    if (remote !== localContent) {
      setLocalContent(remote);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote?.content]);

  // Flush pending content commit on unmount
  useEffect(() => {
    return () => {
      if (contentCommitTimerRef.current) {
        clearTimeout(contentCommitTimerRef.current);
        const id = localNoteIdRef.current;
        if (id) {
          updateNote(id, { content: localContent });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalImages = activeNote?.images?.length ?? 0;

  const goToImage = (next: number) => {
    if (totalImages === 0) return;
    const wrapped = ((next % totalImages) + totalImages) % totalImages;
    setLightboxIndex(wrapped);
  };
  const goPrevImage = () => {
    if (lightboxIndex === null) return;
    goToImage(lightboxIndex - 1);
  };
  const goNextImage = () => {
    if (lightboxIndex === null) return;
    goToImage(lightboxIndex + 1);
  };
  const closeLightbox = () => {
    setLightboxIndex(null);
    setIsSlideshowPlaying(false);
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLightbox();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNextImage();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrevImage();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToImage(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToImage(totalImages - 1);
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        setIsSlideshowPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex, totalImages]);

  // Auto-play slideshow ticker (3s per image)
  useEffect(() => {
    if (lightboxIndex === null || !isSlideshowPlaying || totalImages < 2) return;
    const id = window.setInterval(() => {
      setLightboxIndex((prev) => {
        if (prev === null) return prev;
        return ((prev + 1) % totalImages + totalImages) % totalImages;
      });
    }, 3000);
    return () => window.clearInterval(id);
  }, [lightboxIndex, isSlideshowPlaying, totalImages]);

  // Auto-scroll thumbnail strip to keep current thumb in view
  useEffect(() => {
    if (lightboxIndex === null) return;
    const strip = thumbnailStripRef.current;
    if (!strip) return;
    const el = strip.querySelector<HTMLElement>(`[data-thumb-idx="${lightboxIndex}"]`);
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [lightboxIndex]);

  const handleDownloadCurrentImage = async () => {
    if (lightboxIndex === null || !activeNote?.images) return;
    const src = activeNote.images[lightboxIndex];
    try {
      const a = document.createElement('a');
      a.href = src;
      a.download = `image-${lightboxIndex + 1}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(src, '_blank', 'noopener,noreferrer');
    }
  };

  const handleAddSubNote = async (title: string) => {
    if (!activeNote || !title.trim()) return;

    const newSub = {
      id: 'sub_' + Math.random().toString(36).substring(2, 9),
      title: title.trim(),
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };

    const existingSubs = activeNote.subNotes || [];
    await updateNote(activeNote.id, {
      subNotes: [...existingSubs, newSub],
    });
  };

  const handleToggleSubNote = async (subId: string) => {
    if (!activeNote || !activeNote.subNotes) return;

    const updatedSubs = activeNote.subNotes.map((sub) => {
      if (sub.id === subId) {
        return { ...sub, isCompleted: !sub.isCompleted };
      }
      return sub;
    });

    await updateNote(activeNote.id, {
      subNotes: updatedSubs,
    });
  };

  const handleDeleteSubNote = async (subId: string) => {
    if (!activeNote || !activeNote.subNotes) return;

    const updatedSubs = activeNote.subNotes.filter((sub) => sub.id !== subId);
    await updateNote(activeNote.id, {
      subNotes: updatedSubs,
    });
  };

  // Image upload and automatic compression to keep synced notes extremely light & high performance
  const handleImageUpload = (file: File) => {
    if (!activeNote || isTrash) return;
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Limit max resolution to 850px width/height for database space limits & high performance
        const MAX_DIM = 850;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.72);
          
          const existingImages = activeNote.images || [];
          updateNote(activeNote.id, {
            images: [...existingImages, compressedBase64]
          });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle screenshot clipboard paste event
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isTrash || !activeNote) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageUpload(file);
            e.preventDefault();
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeNoteId, activeNote, isTrash]);

  if (!activeNote) {
    return (
      <div 
        id="editor-placeholder"
        className={`flex-1 h-full hidden md:flex flex-col items-center justify-center p-8 select-none transition-colors duration-300 ${
          theme === 'dark' ? 'bg-[var(--color-leather-dark)]' : 'bg-[var(--color-paper)]'
        }`}
      >
        <div className="max-w-md text-center">
          <div className={`w-16 h-16 border-2 flex items-center justify-center mx-auto mb-6 transition-colors shadow-[4px_4px_0px_#2C2A29] dark:shadow-[4px_4px_0px_#EBE5D0] ${
            theme === 'dark' ? 'bg-[var(--color-leather)] border-[var(--color-ink-light)] text-zinc-400' : 'bg-[var(--color-paper-dark)] border-[var(--color-ink)] text-[var(--color-ink)]'
          }`}>
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className={`text-xl font-display font-black tracking-tight ${theme === 'dark' ? 'text-[var(--color-paper)]' : 'text-[var(--color-ink)]'}`}>
            SyncNote
          </h3>
          <p className={`text-xs font-mono font-bold mt-3 leading-relaxed ${theme === 'dark' ? 'text-[var(--color-paper-dark)]' : 'text-[var(--color-ink-light)]'}`}>
            {'Classic Edition'}
          </p>
        </div>
      </div>
    );
  }

  // Handle note body change.
  // We update a local buffer immediately (so the textarea reflects input and
  // the browser's native undo stack is preserved), and commit to the global
  // store on a short debounce. This is what makes Ctrl+Z work reliably.
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setLocalContent(v);
    if (contentCommitTimerRef.current) {
      clearTimeout(contentCommitTimerRef.current);
    }
    const noteId = activeNote.id;
    contentCommitTimerRef.current = setTimeout(() => {
      contentCommitTimerRef.current = null;
      updateNote(noteId, { content: v });
    }, 500);
  };

  /**
   * Apply formatting around the currently selected text in the textarea.
   * - 'wrap' mode wraps the selection with prefix/suffix (bold, italic, code...)
   * - 'line' mode prepends prefix at the beginning of each selected line (headings, lists, quotes)
   *
   * Uses document.execCommand('insertText', ...) so the browser's native undo
   * stack (Ctrl+Z / Ctrl+Shift+Z) keeps each formatting action as a step.
   * Falls back to direct updateNote() if execCommand is unavailable.
   */
  const applyFormat = (
    prefix: string,
    suffix: string = '',
    options: { mode?: 'wrap' | 'line'; placeholder?: string } = {}
  ) => {
    if (!activeNote || isTrash) return;
    const ta = editorTextareaRef.current;
    if (!ta) return;

    const mode = options.mode || 'wrap';
    const placeholder = options.placeholder || 'văn bản';
    const value = ta.value;
    // Use saved selection if available (from onMouseDown), otherwise use current
    const start = selectionRef.current?.start ?? ta.selectionStart ?? 0;
    const end = selectionRef.current?.end ?? ta.selectionEnd ?? 0;
    selectionRef.current = null; // Clear after use
    const selected = value.slice(start, end);

    let replaceFrom: number;
    let replaceTo: number;
    let insertText: string;
    let newStart: number;
    let newEnd: number;

    if (mode === 'line') {
      // Expand selection to whole lines
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = value.indexOf('\n', end);
      const blockEnd = lineEnd === -1 ? value.length : lineEnd;
      const block = value.slice(lineStart, blockEnd);
      const transformed = block
        .split('\n')
        .map((line) => (line.length === 0 ? prefix : prefix + line))
        .join('\n');
      replaceFrom = lineStart;
      replaceTo = blockEnd;
      insertText = transformed;
      newStart = lineStart;
      newEnd = lineStart + transformed.length;
    } else {
      const middle = selected.length > 0 ? selected : placeholder;
      insertText = prefix + middle + suffix;
      replaceFrom = start;
      replaceTo = end;
      newStart = start + prefix.length;
      newEnd = newStart + middle.length;
    }

    // Preferred path: use execCommand so the browser's native undo stack
    // (Ctrl+Z / Ctrl+Shift+Z) records each formatting action as one step.
    ta.focus();
    ta.setSelectionRange(replaceFrom, replaceTo);
    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, insertText);
    } catch {
      inserted = false;
    }

    if (inserted) {
      // After insertText, place selection on the meaningful middle part
      requestAnimationFrame(() => {
        const el = editorTextareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(newStart, newEnd);
      });
      return;
    }

    // Fallback (older browsers): rewrite content via React state. This breaks
    // native undo but at least keeps the formatting feature working.
    const newText = value.slice(0, replaceFrom) + insertText + value.slice(replaceTo);
    updateNote(activeNote.id, { content: newText });
    requestAnimationFrame(() => {
      const el = editorTextareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(newStart, newEnd);
    });
  };

  // Wrap selection with an HTML color span so the preview renders the color
  const applyColor = (color: string) => {
    applyFormat(`<span style="color:${color}">`, '</span>', { placeholder: 'văn bản màu' });
    setShowColorPicker(false);
  };

  const applyHighlight = (color: string) => {
    applyFormat(`<mark style="background:${color}">`, '</mark>', { placeholder: 'tô sáng' });
    setShowColorPicker(false);
  };

  // Handle note title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNote(activeNote.id, { title: e.target.value });
  };

  // Move note to a folder
  const handleFolderChange = (folderName: string) => {
    updateNote(activeNote.id, { folder: folderName });
  };

  // Add individual tag pill
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = tagInput.trim().toLowerCase().replace(/#/g, '');
    if (!cleanTag) return;

    const currentTags = activeNote.tags || [];
    if (!currentTags.includes(cleanTag)) {
      updateNote(activeNote.id, {
        tags: [...currentTags, cleanTag]
      });
    }
    setTagInput('');
  };

  // Remove individual tag pill
  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = activeNote.tags || [];
    updateNote(activeNote.id, {
      tags: currentTags.filter((t) => t !== tagToRemove)
    });
  };

  // Change primary color category
  const handleColorChange = (color: string) => {
    updateNote(activeNote.id, { color });
  };

  const handleDeleteImage = async (imgIndex: number) => {
    if (!activeNote || !activeNote.images) return;
    const updatedImages = activeNote.images.filter((_, idx) => idx !== imgIndex);
    await updateNote(activeNote.id, {
      images: updatedImages
    });
  };

  const handleAddImageUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNote || !imageUrlInput.trim()) return;
    
    const existingImages = activeNote.images || [];
    await updateNote(activeNote.id, {
      images: [...existingImages, imageUrlInput.trim()]
    });
    setImageUrlInput('');
    setShowUrlInput(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isTrash) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isTrash || !activeNote) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file.type.startsWith('image/')) {
          handleImageUpload(file);
        }
      }
    }
  };

  // List of active colors supported
  const colorList = ['slate', 'blue', 'amber', 'emerald', 'rose', 'purple', 'orange', 'teal'];

  const colorsMap: { [key: string]: string } = {
    slate: '#64748b',
    blue: '#3b82f6',
    amber: '#f59e0b',
    emerald: '#10b981',
    rose: '#f43f5e',
    purple: '#a855f7',
    orange: '#f97316',
    teal: '#14b8a6',
  };

  // Color background styling matches
  const getBackgroundColor = (color: string | undefined) => {
    if (!color) return theme === 'dark' ? 'rgba(15, 23, 42, 1)' : 'rgba(100, 116, 139, 0.02)';
    let hex = '#64748b';
    if (color.startsWith('#')) {
      hex = color.replace('#', '');
    } else {
      hex = (colorsMap[color] || '#64748b').replace('#', '');
    }
    
    let r = 100, g = 116, b = 139;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16) || 0;
      g = parseInt(hex[1] + hex[1], 16) || 0;
      b = parseInt(hex[2] + hex[2], 16) || 0;
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16) || 0;
      g = parseInt(hex.substring(2, 4), 16) || 0;
      b = parseInt(hex.substring(4, 6), 16) || 0;
    }
    
    // Ambient canvas coloring
    return theme === 'dark' ? `rgba(${r}, ${g}, ${b}, 0.08)` : `rgba(${r}, ${g}, ${b}, 0.025)`;
  };

  return (
    <div 
      id="note-editor"
      className={`flex-1 flex-col h-full min-w-0 transition-all duration-300 bg-slate-50 dark:bg-slate-900 relative ${
        activeNoteId ? 'flex' : 'hidden md:flex'
      } ${isDragging ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
      style={{ backgroundColor: getBackgroundColor(activeNote.color || 'slate') }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Absolute overlay for dragging file */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-blue-600/10 backdrop-blur-xs flex flex-col items-center justify-center border-4 border-dashed border-blue-500 pointer-events-none select-none">
          <UploadCloud className="w-12 h-12 text-blue-500 animate-bounce mb-2" />
          <p className="text-sm font-sans font-bold text-blue-500">Thả tập tin ảnh để đính kèm ghi chú này</p>
          <p className="text-xs font-sans text-slate-400 mt-1">Hỗ trợ PNG, JPG, WEBP, GIF...</p>
        </div>
      )}
      {/* Editor Control Tool Bar */}
      <div className={`px-3 sm:px-4 md:px-6 py-3 md:py-4 border-b-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-5 shrink-0 transition-colors duration-300 ${
        theme === 'dark' ? 'bg-[var(--color-leather-dark)]/90 border-[var(--color-ink-light)]' : 'bg-[var(--color-paper)]/90 border-[var(--color-ink)]'
      } backdrop-blur-md`}>
        <div className="flex items-center gap-2 sm:gap-3 md:gap-3.5 flex-wrap">
          {/* Mobile Back Button */}
          <button
            onClick={() => setActiveNoteId(null)}
            className={`md:hidden p-2 -ml-2 border-2 transition-colors duration-300 shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
              theme === 'dark' ? 'border-[var(--color-ink-light)] text-[var(--color-paper)] hover:bg-[var(--color-leather)]' : 'border-[var(--color-ink)] text-[var(--color-ink)] hover:bg-[var(--color-paper-dark)]'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Editor/Preview Mode toggle (Hidden if in trash) */}
          {!isTrash && (
            <div className={`flex items-center p-1 border-2 shrink-0 transition-colors shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] ${
              theme === 'dark' ? 'bg-[var(--color-leather)] border-[var(--color-ink-light)]' : 'bg-[var(--color-paper)] border-[var(--color-ink)]'
            }`}>
              <button
                id="btn-tab-edit"
                onClick={() => setActiveTab('edit')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-bold transition-all duration-300 cursor-pointer ${
                  activeTab === 'edit'
                    ? (theme === 'dark' ? 'bg-[var(--color-paper-dark)] text-[var(--color-ink)]' : 'bg-[var(--color-ink)] text-[var(--color-paper)]')
                    : (theme === 'dark' ? 'text-[var(--color-ink-light)] hover:text-[var(--color-paper)]' : 'text-[var(--color-ink-light)] hover:text-[var(--color-ink)]')
                }`}
              >
                <Edit3 className={`w-3.5 h-3.5 stroke-[2.5]`} />
                <span className="hidden sm:inline">{t(language, 'edit_mode')}</span>
              </button>
              <button
                id="btn-tab-preview"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-bold transition-all duration-300 cursor-pointer ${
                  activeTab === 'preview'
                    ? (theme === 'dark' ? 'bg-[var(--color-paper-dark)] text-[var(--color-ink)]' : 'bg-[var(--color-ink)] text-[var(--color-paper)]')
                    : (theme === 'dark' ? 'text-[var(--color-ink-light)] hover:text-[var(--color-paper)]' : 'text-[var(--color-ink-light)] hover:text-[var(--color-ink)]')
                }`}
              >
                <Eye className={`w-3.5 h-3.5 stroke-[2.5]`} />
                <span className="hidden sm:inline">{t(language, 'preview_markdown')}</span>
              </button>
            </div>
          )}

          {/* Color Category Choice Palette */}
          {!isTrash && (
            <div className={`flex items-center gap-3 border-l-0 pl-0 sm:border-l-2 sm:pl-4 flex-wrap ${
              theme === 'dark' ? 'border-[var(--color-ink-light)]' : 'border-[var(--color-ink)]'
            }`}>
              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest select-none mr-1 ${theme === 'dark' ? 'text-[var(--color-paper-dark)]' : 'text-[var(--color-ink-light)]'}`}>
                {t(language, 'color_label')}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {colorList.map((colorName) => {
                  const presetHex = colorsMap[colorName];
                  const isActive = activeNote.color === colorName || (!activeNote.color && colorName === 'slate') || activeNote.color === presetHex;
                  return (
                    <button
                      id={`btn-color-palette-${colorName}`}
                      key={colorName}
                      onClick={() => handleColorChange(colorName)}
                      className={`w-5.5 h-5.5 rounded-full border transition-all duration-300 cursor-pointer relative hover:scale-120 flex items-center justify-center ${
                        isActive 
                          ? (theme === 'dark' ? 'ring-2 ring-slate-350 ring-offset-2 ring-offset-slate-950 scale-110 shadow-xs' : 'ring-2 ring-slate-800 ring-offset-2 scale-110 shadow-sm') 
                          : (theme === 'dark' ? 'border-slate-800/80 hover:border-slate-700 shadow-3xs' : 'border-slate-200 hover:border-slate-300 shadow-3xs')
                      }`}
                      style={{ backgroundColor: presetHex }}
                      title={`Bộ màu: ${colorName}`}
                    >
                      {isActive && <Check className="w-2.5 h-2.5 text-white stroke-[4.5px]" />}
                    </button>
                  );
                })}

                {/* Custom dynamic indicator if note uses custom picked color */}
                {activeNote.color && !colorList.includes(activeNote.color) && activeNote.color.startsWith('#') && (
                  <div 
                    className={`w-5.5 h-5.5 rounded-full border transition-transform flex items-center justify-center shadow-xs ${
                      theme === 'dark' ? 'border-slate-700 ring-2 ring-slate-350 ring-offset-2 ring-offset-slate-950' : 'border-slate-800 ring-2 ring-slate-800 ring-offset-2'
                    }`}
                    style={{ backgroundColor: activeNote.color }}
                    title="Màu tùy chỉnh hiện tại"
                  >
                    <Check className="w-2.5 h-2.5 text-white stroke-[4.5px]" />
                  </div>
                )}

                {/* Dynamic color picker button */}
                <div 
                  className={`relative w-6 h-6 rounded-full border bg-gradient-to-tr from-rose-400 via-amber-400 to-emerald-400 flex items-center justify-center cursor-pointer shadow-3xs hover:scale-120 transition-all ml-1 shrink-0 ${
                    theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
                  }`}
                  title="Bảng màu tự chọn (Custom Color)"
                >
                  <input
                    id="input-custom-color-picker"
                    type="color"
                    value={activeNote.color && activeNote.color.startsWith('#') ? activeNote.color : '#3b82f6'}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer rounded-full"
                  />
                  <Palette className="w-3.5 h-3.5 text-white pointer-events-none drop-shadow-sm stroke-[2]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Note State Controls */}
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto mt-1 sm:mt-0">
          {isTrash ? (
            <>
              {/* Restore Note Trigger */}
              <button
                id="btn-restore-note"
                onClick={() => handleFolderChange('personal')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-bold border-2 cursor-pointer transition-all duration-300 shadow-[2px_2px_0px_1px_rgba(4,120,87,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                  theme === 'dark'
                    ? 'bg-emerald-900 border-[var(--color-ink-light)] text-emerald-400'
                    : 'bg-transparent border-emerald-700 text-emerald-700'
                }`}
                title="Restore note"
              >
                <Undo className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">{t(language, 'restore')}</span>
              </button>

              {/* Permanent Delete Note Trigger */}
              <button
                id="btn-delete-permanent"
                onClick={() => deleteNote(activeNote.id)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-bold border-2 cursor-pointer transition-all duration-300 shadow-[2px_2px_0px_1px_rgba(190,18,60,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                  theme === 'dark'
                    ? 'bg-rose-900 border-[var(--color-ink-light)] text-rose-400'
                    : 'bg-transparent border-rose-700 text-rose-700'
                }`}
                title="Delete note permanently"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">{t(language, 'delete_forever')}</span>
              </button>
            </>
          ) : (
            <>
              {/* Pin Note Control */}
              <button
                id="btn-toggle-pin"
                onClick={() => togglePin(activeNote.id)}
                className={`p-2 border-2 transition-all duration-300 cursor-pointer shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                  activeNote.isPinned
                    ? (theme === 'dark' ? 'bg-[var(--color-ink-light)] border-[var(--color-ink-light)] text-[var(--color-paper)]' : 'bg-orange-100 border-[var(--color-ink)] text-orange-600')
                    : (theme === 'dark' ? 'bg-transparent border-[var(--color-ink-light)] text-[var(--color-paper)] hover:text-orange-400 hover:bg-orange-900' : 'bg-transparent border-[var(--color-ink)] text-[var(--color-ink)] hover:text-orange-500 hover:bg-[var(--color-paper-dark)]')
                }`}
                title={activeNote.isPinned ? "Bỏ ghim ghi chú" : "Ghim ghi chú lên đầu"}
              >
                <Pin className={`w-4 h-4 transition-transform duration-300 ${activeNote.isPinned ? 'fill-orange-400 rotate-45 text-orange-500' : 'hover:text-orange-500'}`} />
              </button>

              {/* Star/Favorite Note Control */}
              <button
                id="btn-toggle-favorite"
                onClick={() => toggleFavorite(activeNote.id)}
                className={`p-2 border-2 transition-all duration-300 cursor-pointer shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                  activeNote.isFavorite
                    ? (theme === 'dark' ? 'bg-[var(--color-ink-light)] border-[var(--color-ink-light)] text-[var(--color-paper)]' : 'bg-amber-100 border-[var(--color-ink)] text-amber-600')
                    : (theme === 'dark' ? 'bg-transparent border-[var(--color-ink-light)] text-[var(--color-paper)] hover:text-amber-400 hover:bg-amber-900' : 'bg-transparent border-[var(--color-ink)] text-[var(--color-ink)] hover:text-amber-500 hover:bg-[var(--color-paper-dark)]')
                }`}
                title={activeNote.isFavorite ? "Bỏ yêu thích" : "Đánh dấu yêu thích"}
              >
                <Star className={`w-4 h-4 transition-transform duration-300 ${activeNote.isFavorite ? 'fill-amber-400 text-amber-500 scale-110' : 'hover:text-amber-500'}`} />
              </button>

              {/* Attachment Image Toolbar trigger */}
              <button
                id="btn-upload-image-toolbar"
                onClick={() => document.getElementById('file-attachment-input')?.click()}
                className={`p-2 border-2 transition-all duration-300 cursor-pointer shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                  theme === 'dark' 
                    ? 'bg-transparent border-[var(--color-ink-light)] text-[var(--color-paper)] hover:text-sky-400 hover:bg-sky-900' 
                    : 'bg-transparent border-[var(--color-ink)] text-[var(--color-ink)] hover:text-sky-500 hover:bg-[var(--color-paper-dark)]'
                }`}
                title="Đính kèm thông tin hình ảnh (Attach image)"
              >
                <ImageIcon className="w-4 h-4 text-sky-500 hover:text-sky-400 stroke-[2.2]" />
              </button>
              <input
                id="file-attachment-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    for (let i = 0; i < e.target.files.length; i++) {
                      handleImageUpload(e.target.files[i]);
                    }
                  }
                  e.target.value = ''; // Reset input selection
                }}
              />

              {/* Folder Transfer Selector */}
              <div className="relative">
                <select
                  id="select-folder"
                  value={activeNote.folder}
                  onChange={(e) => handleFolderChange(e.target.value)}
                  className={`text-xs h-[36px] pl-9 pr-6 focus:outline-none cursor-pointer appearance-none font-mono font-bold transition-all border-2 shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] bg-transparent ${
                    theme === 'dark'
                      ? 'text-[var(--color-paper)] border-[var(--color-ink-light)]'
                      : 'text-[var(--color-ink)] border-[var(--color-ink)]'
                  }`}
                >
                  <option value="personal" className={theme === 'dark' ? 'bg-[var(--color-leather)]' : 'bg-[var(--color-paper)]'}>Cá nhân</option>
                  <option value="work" className={theme === 'dark' ? 'bg-[var(--color-leather)]' : 'bg-[var(--color-paper)]'}>Công việc</option>
                  <option value="ideas" className={theme === 'dark' ? 'bg-[var(--color-leather)]' : 'bg-[var(--color-paper)]'}>Ý tưởng</option>
                </select>
                <FolderOpen className={`absolute left-3 top-[10px] w-4 h-4 transition-colors duration-300 pointer-events-none ${
                  activeNote.folder === 'work' 
                    ? 'text-emerald-500' 
                    : activeNote.folder === 'ideas' 
                      ? 'text-amber-500' 
                      : 'text-indigo-500'
                }`} />
              </div>

              {/* Trash Note Trigger */}
              <button
                id="btn-move-to-trash"
                onClick={() => handleFolderChange('trash')}
                className={`p-2 border-2 cursor-pointer transition-all duration-300 shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                  theme === 'dark'
                    ? 'bg-transparent border-[var(--color-ink-light)] text-rose-400 hover:bg-rose-900'
                    : 'bg-transparent border-[var(--color-ink)] text-rose-500 hover:bg-rose-100'
                }`}
                title="Bỏ ghi chú này vào Thùng rác (Move to trash)"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Warning header for trash files */}
      {isTrash && (
        <div className={`px-6 py-2.5 flex items-center justify-center text-[11px] font-sans font-medium gap-1.5 select-none border-b transition-colors ${
          theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-700'
        }`}>
          <span>⚠️ Ghi chú này đang nằm trong Thùng rác. Bạn cần phục hồi để tiếp tục thay đổi nội dung.</span>
        </div>
      )}

      {/* Editor Content Fields */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8 lg:py-8 scrollbar-thin">
        <div className={`max-w-3xl xl:max-w-4xl mx-auto border-2 p-4 sm:p-6 md:p-8 lg:p-10 shadow-[4px_4px_0px_#2C2A29] dark:shadow-[4px_4px_0px_#EBE5D0] flex flex-col min-h-full transition-all duration-350 ${
          theme === 'dark' ? 'bg-[var(--color-leather)] border-[var(--color-ink-light)]' : 'bg-[var(--color-paper)] border-[var(--color-ink)]'
        }`}>
          
          {/* Title fields */}
          <input
            id="editor-title-input"
            type="text"
            placeholder="Tiêu đề ghi chú..."
            value={activeNote.title || ''}
            onChange={handleTitleChange}
            disabled={isTrash}
            className={`w-full text-2xl sm:text-3xl md:text-4xl font-display font-black bg-transparent border-none p-0 focus:ring-0 focus:outline-none mb-4 md:mb-5 tracking-tight leading-tight transition-colors ${
              theme === 'dark' ? 'text-[var(--color-paper)] placeholder-zinc-700' : 'text-[var(--color-ink)] placeholder-zinc-300'
            }`}
          />

          {/* Tags Block right below Title */}
          <div className="flex flex-wrap items-center gap-2 mb-7 select-none">
            {activeNote.tags && activeNote.tags.length > 0 ? (
              activeNote.tags.map((tag) => (
                <span
                  key={tag}
                  className={`flex items-center gap-1.5 px-3 py-1 uppercase tracking-wider border-2 text-[10px] md:text-[11px] font-mono font-bold transition-all duration-150 shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] ${
                    theme === 'dark' 
                      ? 'bg-transparent text-[var(--color-paper)] border-[var(--color-ink-light)]' 
                      : 'bg-[var(--color-paper-dark)] text-[var(--color-ink)] border-[var(--color-ink)]'
                  }`}
                >
                  <span className="opacity-70">#</span>
                  <span>{tag}</span>
                  {!isTrash && (
                    <button
                      id={`btn-remove-tag-${tag}`}
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className={`p-0.5 ml-1 transition-all cursor-pointer ${
                        theme === 'dark' ? 'hover:bg-rose-950 hover:text-rose-400' : 'hover:bg-rose-100 hover:text-rose-600'
                      }`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))
            ) : (
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 border-2 flex items-center gap-1.5 shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] ${
                theme === 'dark' 
                  ? 'text-[var(--color-paper-dark)] bg-transparent border-[var(--color-ink-light)]' 
                  : 'text-[var(--color-ink-light)] bg-transparent border-[var(--color-ink)]'
              }`}>
                <span>🏷️</span> CHƯA PHÂN LOẠI
              </span>
            )}

            {/* Quick Tag addition inline */}
            {!isTrash && (
              <form onSubmit={handleAddTag} className="flex items-center gap-1.5 ml-1">
                <input
                  id="input-add-tag"
                  type="text"
                  placeholder="+ Thêm thẻ..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className={`text-[10px] md:text-[11px] font-mono font-bold px-3 py-1 border-2 transition-all focus:outline-none focus:ring-0 shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] min-w-[80px] md:min-w-[120px] ${
                    theme === 'dark'
                      ? 'bg-transparent border-[var(--color-ink-light)] text-[var(--color-paper)] placeholder-zinc-700'
                      : 'bg-transparent border-[var(--color-ink)] text-[var(--color-ink)] placeholder-zinc-400'
                  }`}
                />
              </form>
            )}
          </div>

          {/* Sub-notes list inside the editor workspace */}
          <div className={`mb-8 p-4 md:p-5 border-2 flex flex-col gap-3.5 shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] transition-colors ${
            theme === 'dark' ? 'bg-[var(--color-leather)] border-[var(--color-ink-light)]' : 'bg-[var(--color-paper-dark)] border-[var(--color-ink)]'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <button
                type="button"
                onClick={() => setShowChecklistSection(!showChecklistSection)}
                className="flex items-center gap-2.5 hover:opacity-70 transition-opacity select-none"
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showChecklistSection ? '' : '-rotate-90'}`} />
                <h4 className={`text-xs md:text-sm font-mono font-bold uppercase tracking-wider flex items-center gap-2 ${theme === 'dark' ? 'text-[var(--color-paper)]' : 'text-[var(--color-ink)]'}`}>
                  <span className="flex h-3 w-3 relative border-2 border-current"></span>
                  <span className="font-black">
                    MỤC TIÊU CHECKLIST ({activeNote.subNotes?.length || 0})
                  </span>
                </h4>
              </button>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border-2 ${
                theme === 'dark' 
                  ? 'text-[var(--color-ink-light)] border-[var(--color-ink-light)]' 
                  : 'text-[var(--color-ink)] border-[var(--color-ink)]'
              }`}>
                Tiến trình: {activeNote.subNotes?.filter(s => s.isCompleted).length || 0}/{activeNote.subNotes?.length || 0}
              </span>
            </div>

            {showChecklistSection && (
            <>
              {activeNote.subNotes && activeNote.subNotes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {activeNote.subNotes.map((sub) => (
                  <div 
                    key={sub.id} 
                    className={`flex items-center justify-between gap-2 px-3 py-2 border-2 text-[11px] md:text-xs font-mono transition-all duration-200 group/sub-editor shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] ${
                      sub.isCompleted 
                        ? (theme === 'dark' ? 'bg-[var(--color-ink-light)]/20 border-[var(--color-ink-light)] text-[var(--color-paper-dark)] line-through' : 'bg-black/5 border-[var(--color-ink)] text-slate-500 line-through') 
                        : (theme === 'dark' ? 'bg-transparent border-[var(--color-ink-light)] text-[var(--color-paper)] hover:bg-[var(--color-leather-dark)]' : 'bg-[var(--color-paper)] border-[var(--color-ink)] text-[var(--color-ink)] hover:bg-[var(--color-paper-dark)]')
                    }`}
                  >
                    <button
                      type="button"
                      disabled={isTrash}
                      onClick={() => handleToggleSubNote(sub.id)}
                      className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer disabled:cursor-not-allowed select-none"
                    >
                      <span className={`w-4 h-4 border-2 flex items-center justify-center transition-all shrink-0 ${
                        sub.isCompleted 
                          ? (theme === 'dark' ? 'bg-[var(--color-ink-light)] border-[var(--color-ink-light)] text-[var(--color-paper)]' : 'bg-[var(--color-ink)] border-[var(--color-ink)] text-white') 
                          : (theme === 'dark' ? 'bg-transparent border-[var(--color-ink-light)]' : 'bg-transparent border-[var(--color-ink)]')
                      }`}>
                        {sub.isCompleted && (
                          <svg className="w-2.5 h-2.5 stroke-current stroke-[3] fill-none" viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{sub.title}</span>
                    </button>

                    {!isTrash && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSubNote(sub.id)}
                        className={`opacity-0 group-hover/sub-editor:opacity-100 p-1 border-2 transition-all cursor-pointer shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                          theme === 'dark' ? 'border-[var(--color-ink-light)] text-rose-400 hover:bg-rose-950' : 'border-[var(--color-ink)] text-rose-600 hover:bg-rose-100'
                        }`}
                        title="Xóa mục checklist"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={`text-center py-5 px-4 border-2 border-dashed transition-all ${
                theme === 'dark' ? 'border-[var(--color-ink-light)]' : 'border-[var(--color-ink)]'
              }`}>
                <span className={`text-[11px] font-mono ${theme === 'dark' ? 'text-[var(--color-paper-dark)]' : 'text-[var(--color-ink-light)]'}`}>Chưa có công việc nào. Viết thêm ở dưới.</span>
              </div>
            )}
            </>
            )}

            {!isTrash && (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const input = form.elements.namedItem('editor-add-subnote') as HTMLInputElement;
                  if (input && input.value.trim()) {
                    handleAddSubNote(input.value);
                    input.value = '';
                  }
                }}
                className="flex items-center gap-2 mt-2"
              >
                <input
                  id="editor-add-subnote"
                  name="editor-add-subnote"
                  type="text"
                  placeholder="+ Soạn hạng mục mới..."
                  className={`flex-1 text-[11px] font-mono font-bold px-3 py-2 border-2 transition-all shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] focus:outline-none focus:ring-0 ${
                    theme === 'dark'
                      ? 'bg-transparent border-[var(--color-ink-light)] text-[var(--color-paper)] placeholder-zinc-700'
                      : 'bg-transparent border-[var(--color-ink)] text-[var(--color-ink)] placeholder-zinc-400'
                  }`}
                />
                <button
                  type="submit"
                  className={`px-4 py-2 border-2 text-[11px] font-mono font-bold cursor-pointer shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all shrink-0 ${
                    theme === 'dark' ? 'bg-[var(--color-ink-light)] border-[var(--color-ink-light)] text-zinc-900' : 'bg-[var(--color-ink)] border-[var(--color-ink)] text-white'
                  }`}
                >
                  Thêm mục
                </button>
              </form>
            )}
          </div>

          {/* Linked Attached Images Gallery Section */}
          <div className="mb-8 empty:hidden flex flex-col gap-4">
            {activeNote.images && activeNote.images.length > 0 && (
              <div className={`p-4 md:p-5 border-2 flex flex-col gap-4 transition-colors shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] ${
                theme === 'dark' ? 'bg-[var(--color-leather)] border-[var(--color-ink-light)]' : 'bg-[var(--color-paper-dark)] border-[var(--color-ink)]'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                  <button
                    type="button"
                    onClick={() => setShowImagesSection(!showImagesSection)}
                    className="flex items-center gap-2.5 hover:opacity-70 transition-opacity select-none"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showImagesSection ? '' : '-rotate-90'}`} />
                    <h4 className={`text-xs md:text-sm font-mono font-bold uppercase tracking-wider flex items-center gap-2.5 ${
                    theme === 'dark' ? 'text-[var(--color-paper)]' : 'text-[var(--color-ink)]'
                  }`}>
                    <ImageIcon className="w-4 h-4" />
                    ẢNH ĐÍNH KÈM ({activeNote.images.length})
                  </h4>
                  </button>
                  
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {activeNote.images.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(0)}
                        className={`text-[10px] font-mono font-bold flex items-center gap-1.5 px-2.5 py-1.5 border-2 transition-all shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-transparent border-[var(--color-ink-light)] text-[var(--color-paper)] hover:bg-[var(--color-ink-light)] hover:text-zinc-900'
                            : 'bg-transparent border-[var(--color-ink)] text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white'
                        }`}
                        title="Xem tất cả ảnh (Trình chiếu)"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Xem tất cả</span>
                      </button>
                    )}
                  {!isTrash && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowUrlInput(!showUrlInput)}
                        className={`text-[10px] font-mono font-bold flex items-center gap-1.5 px-2.5 py-1.5 border-2 transition-all shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-transparent border-[var(--color-ink-light)] text-[var(--color-paper)] hover:bg-[var(--color-ink-light)] hover:text-zinc-900'
                            : 'bg-transparent border-[var(--color-ink)] text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white'
                        }`}
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span>Nhúng URL</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => document.getElementById('file-attachments-gallery-input')?.click()}
                        className={`text-[10px] font-mono font-bold flex items-center gap-1.5 px-2.5 py-1.5 border-2 transition-all shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-[var(--color-ink-light)] border-[var(--color-ink-light)] text-zinc-900'
                            : 'bg-[var(--color-ink)] border-[var(--color-ink)] text-white'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>Thêm ảnh</span>
                      </button>
                      <input
                        id="file-attachments-gallery-input"
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) {
                            for (let i = 0; i < e.target.files.length; i++) {
                              handleImageUpload(e.target.files[i]);
                            }
                          }
                          e.target.value = '';
                        }}
                      />
                    </>
                  )}
                  </div>
                </div>

                {showImagesSection && (
                <>
                {/* Inline image URL insert form */}
                {!isTrash && showUrlInput && (
                  <form onSubmit={handleAddImageUrl} className="flex gap-2 items-center animate-fade-in mt-1">
                    <input
                      type="url"
                      placeholder="Dán URL hình ảnh..."
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      className={`flex-1 text-[11px] md:text-xs font-mono font-bold px-3.5 py-2 border-2 transition-all focus:outline-none focus:ring-0 shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] ${
                        theme === 'dark'
                          ? 'bg-transparent border-[var(--color-ink-light)] text-[var(--color-paper)] placeholder-zinc-700'
                          : 'bg-transparent border-[var(--color-ink)] text-[var(--color-ink)] placeholder-zinc-400'
                      }`}
                    />
                    <button
                      type="submit"
                      className={`px-4 py-2 border-2 text-[11px] font-mono font-bold transition-all shrink-0 cursor-pointer shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                        theme === 'dark' ? 'bg-[var(--color-ink-light)] border-[var(--color-ink-light)] text-zinc-900' : 'bg-[var(--color-ink)] border-[var(--color-ink)] text-white'
                      }`}
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUrlInput(false);
                        setImageUrlInput('');
                      }}
                      className={`p-2 border-2 transition-all cursor-pointer shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                        theme === 'dark' ? 'bg-transparent border-[var(--color-ink-light)] text-[var(--color-paper)] hover:bg-rose-950 hover:text-rose-400' : 'bg-transparent border-[var(--color-ink)] text-[var(--color-ink)] hover:bg-rose-100 hover:text-rose-600'
                      }`}
                    >
                      Hủy
                    </button>
                  </form>
                )}

                {/* Image Grid Layout */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2">
                  {activeNote.images.map((imgSrc, idx) => (
                    <div 
                      key={idx}
                      onClick={() => setLightboxIndex(idx)}
                      className={`group relative aspect-square overflow-hidden border-2 flex items-center justify-center cursor-pointer transition-all duration-300 shadow-[4px_4px_0px_#2C2A29] dark:shadow-[4px_4px_0px_#EBE5D0] ${
                        theme === 'dark' ? 'border-[var(--color-ink-light)] bg-transparent' : 'border-[var(--color-ink)] bg-transparent'
                      }`}
                    >
                      <img 
                        src={imgSrc} 
                        alt={`Attachment ${idx + 1}`} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 select-none pointer-events-none grayscale-[0.2] contrast-[1.1] border-[var(--color-ink)] dark:border-[var(--color-ink-light)] mix-blend-multiply dark:mix-blend-normal" 
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Controls Overlay */}
                      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm ${theme === 'dark' ? 'bg-black/50' : 'bg-[var(--color-paper-dark)]/70'}`}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setLightboxIndex(idx); }}
                          className={`p-1.5 border-2 transition-all cursor-pointer shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                            theme === 'dark' ? 'bg-[var(--color-ink-light)] border-[var(--color-ink-light)] text-zinc-900' : 'bg-[var(--color-paper)] border-[var(--color-ink)] text-[var(--color-ink)]'
                          }`}
                          title="Xem ảnh phóng to"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        
                        {!isTrash && activeTab === 'edit' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteImage(idx); }}
                            className={`p-1.5 border-2 transition-all cursor-pointer shadow-[2px_2px_0px_#2C2A29] dark:shadow-[2px_2px_0px_#EBE5D0] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                              theme === 'dark' ? 'bg-rose-900 border-[var(--color-ink-light)] text-rose-400' : 'bg-rose-200 border-[var(--color-ink)] text-rose-700'
                            }`}
                            title="Xóa hình ảnh này"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                </>
                )}
              </div>
            )}

            {/* If NO images uploaded yet, and we want to show a clean upload prompt */}
            {(!activeNote.images || activeNote.images.length === 0) && !isTrash && (
              <div 
                onClick={() => document.getElementById('file-gallery-empty-input')?.click()}
                className={`py-8 px-5 border-2 border-dashed flex flex-col items-center justify-center select-none cursor-pointer transition-all duration-300 group ${
                  theme === 'dark' 
                    ? 'border-[var(--color-ink-light)] hover:bg-[var(--color-leather)]' 
                    : 'border-[var(--color-ink)] hover:bg-[var(--color-paper-dark)]'
                }`}
              >
                <div className={`p-3 mb-3 border-2 transition-all duration-300 shadow-[4px_4px_0px_#2C2A29] dark:shadow-[4px_4px_0px_#EBE5D0] ${
                  theme === 'dark' ? 'bg-transparent border-[var(--color-ink-light)] text-[var(--color-paper-dark)]' : 'bg-transparent border-[var(--color-ink)] text-[var(--color-ink)] group-hover:bg-[var(--color-paper)]'
                }`}>
                  <ImageIcon className="w-6 h-6 transition-all duration-300" />
                </div>
                <p className={`text-[12px] font-mono font-bold tracking-tight uppercase ${theme === 'dark' ? 'text-[var(--color-paper)]' : 'text-[var(--color-ink)]'}`}>
                  Đính kèm hình ảnh
                </p>
                <p className={`text-[10px] font-mono mt-1.5 text-center leading-normal max-w-sm ${theme === 'dark' ? 'text-[var(--color-paper-dark)]' : 'text-[var(--color-ink-light)]'}`}>
                  Nhấp hoặc kéo thả để tải lên. Hoặc bạn có thể dán link URL.
                </p>
                <input
                  id="file-gallery-empty-input"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      for (let i = 0; i < e.target.files.length; i++) {
                        handleImageUpload(e.target.files[i]);
                      }
                    }
                    e.target.value = '';
                  }}
                />
              </div>
            )}
          </div>

          {/* Edit Space vs Preview Space */}
          <div className="flex-1 flex flex-col min-h-0">
            {!isTrash && activeTab === 'preview' ? (
              // Preview Mode Renderer
              <div 
                id="editor-preview-container"
                className={`flex-1 overflow-y-auto p-2 border-0 scrollbar-thin whitespace-pre-wrap transition-colors ${
                  theme === 'dark' ? 'bg-transparent text-[var(--color-paper-dark)]' : 'bg-transparent text-[var(--color-ink)]'
                }`}
              >
                <div className={`markdown-body prose max-w-none leading-relaxed font-mono md:text-md text-sm ${
                  theme === 'dark' ? 'text-[var(--color-paper)] prose-invert' : 'text-[var(--color-ink)]'
                }`}>
                  {activeNote.content ? (
                    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{activeNote.content}</Markdown>
                  ) : (
                    <p className={`italic font-sans text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Không có nội dung. Chuyển sang thẻ &quot;Viết&quot; để thêm thông tin bằng cú pháp Markdown...</p>
                  )}
                </div>
              </div>
            ) : (
              // Written/Editor with formatting toolbar
              <div className="flex flex-col flex-1 min-h-[70vh] md:min-h-[75vh] gap-2">
                {/* Formatting Toolbar - static position to avoid overlapping textarea */}
                <div
                  id="editor-format-toolbar"
                  className={`flex flex-wrap items-center gap-1 p-2 border-2 rounded-sm backdrop-blur-md ${
                    theme === 'dark'
                      ? 'bg-[var(--color-leather-dark)]/95 border-[var(--color-ink-light)]'
                      : 'bg-[var(--color-paper-dark)]/95 border-[var(--color-ink)]'
                  }`}
                >
                  {[
                    { id: 'bold', title: 'In đậm (Ctrl+B)', icon: <Bold className="w-4 h-4" />, onClick: () => applyFormat('**', '**', { placeholder: 'đậm' }) },
                    { id: 'italic', title: 'In nghiêng (Ctrl+I)', icon: <Italic className="w-4 h-4" />, onClick: () => applyFormat('*', '*', { placeholder: 'nghiêng' }) },
                    { id: 'underline', title: 'Gạch chân', icon: <Underline className="w-4 h-4" />, onClick: () => applyFormat('<u>', '</u>', { placeholder: 'gạch chân' }) },
                    { id: 'strike', title: 'Gạch ngang', icon: <Strikethrough className="w-4 h-4" />, onClick: () => applyFormat('~~', '~~', { placeholder: 'gạch ngang' }) },
                    { id: 'sep1', sep: true },
                    { id: 'h1', title: 'Tiêu đề lớn (H1)', icon: <Heading1 className="w-4 h-4" />, onClick: () => applyFormat('# ', '', { mode: 'line' }) },
                    { id: 'h2', title: 'Tiêu đề (H2)', icon: <Heading2 className="w-4 h-4" />, onClick: () => applyFormat('## ', '', { mode: 'line' }) },
                    { id: 'sep2', sep: true },
                    { id: 'ul', title: 'Danh sách', icon: <List className="w-4 h-4" />, onClick: () => applyFormat('- ', '', { mode: 'line' }) },
                    { id: 'ol', title: 'Danh sách đánh số', icon: <ListOrdered className="w-4 h-4" />, onClick: () => applyFormat('1. ', '', { mode: 'line' }) },
                    { id: 'quote', title: 'Trích dẫn', icon: <Quote className="w-4 h-4" />, onClick: () => applyFormat('> ', '', { mode: 'line' }) },
                    { id: 'code', title: 'Mã code', icon: <Code className="w-4 h-4" />, onClick: () => applyFormat('`', '`', { placeholder: 'code' }) },
                    { id: 'link', title: 'Chèn liên kết', icon: <LinkIcon className="w-4 h-4" />, onClick: () => applyFormat('[', '](https://)', { placeholder: 'tiêu đề' }) },
                  ].map((btn: any) =>
                    btn.sep ? (
                      <div
                        key={btn.id}
                        className={`w-px h-5 mx-1 ${theme === 'dark' ? 'bg-[var(--color-ink-light)]' : 'bg-[var(--color-ink)]'}`}
                      />
                    ) : (
                      <button
                        key={btn.id}
                        type="button"
                        title={btn.title}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          saveSelection();
                        }}
                        onClick={btn.onClick}
                        disabled={isTrash}
                        className={`p-1.5 border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          theme === 'dark'
                            ? 'border-transparent text-[var(--color-paper)] hover:bg-[var(--color-leather)] hover:border-[var(--color-ink-light)]'
                            : 'border-transparent text-[var(--color-ink)] hover:bg-[var(--color-paper)] hover:border-[var(--color-ink)]'
                        }`}
                      >
                        {btn.icon}
                      </button>
                    )
                  )}

                  {/* Color picker */}
                  <div className="relative">
                    <button
                      type="button"
                      title="Màu chữ / Tô sáng"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        saveSelection();
                      }}
                      onClick={() => setShowColorPicker((v) => !v)}
                      disabled={isTrash}
                      className={`p-1.5 border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        theme === 'dark'
                          ? 'border-transparent text-[var(--color-paper)] hover:bg-[var(--color-leather)] hover:border-[var(--color-ink-light)]'
                          : 'border-transparent text-[var(--color-ink)] hover:bg-[var(--color-paper)] hover:border-[var(--color-ink)]'
                      }`}
                    >
                      <Palette className="w-4 h-4" />
                    </button>
                    {showColorPicker && (
                      <div
                        className={`absolute z-20 mt-2 left-0 p-3 border-2 shadow-lg w-56 ${
                          theme === 'dark'
                            ? 'bg-[var(--color-leather)] border-[var(--color-ink-light)] text-[var(--color-paper)]'
                            : 'bg-[var(--color-paper)] border-[var(--color-ink)] text-[var(--color-ink)]'
                        }`}
                      >
                        <div className="text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5">Màu chữ</div>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {['#000000', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#ffffff'].map((c) => (
                            <button
                              key={'fg-' + c}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                saveSelection();
                              }}
                              onClick={() => {
                                restoreSelection();
                                applyColor(c);
                              }}
                              className="w-6 h-6 border-2 border-[var(--color-ink)] hover:scale-110 transition-transform"
                              style={{ background: c }}
                              title={c}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5">
                          <Highlighter className="w-3 h-3" /> Tô sáng
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {['#fef08a', '#fed7aa', '#fecaca', '#bbf7d0', '#bae6fd', '#ddd6fe', '#fbcfe8'].map((c) => (
                            <button
                              key={'bg-' + c}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                saveSelection();
                              }}
                              onClick={() => {
                                restoreSelection();
                                applyHighlight(c);
                              }}
                              className="w-6 h-6 border-2 border-[var(--color-ink)] hover:scale-110 transition-transform"
                              style={{ background: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <textarea
                  id="editor-body-textarea"
                  ref={editorTextareaRef}
                  placeholder="Bắt đầu viết nội dung (Hỗ trợ Markdown: # H1, **đậm**, *nghiêng*, - list)..."
                  value={localContent}
                  onChange={handleContentChange}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
                      const k = e.key.toLowerCase();
                      if (k === 'b') { e.preventDefault(); applyFormat('**', '**', { placeholder: 'đậm' }); }
                      else if (k === 'i') { e.preventDefault(); applyFormat('*', '*', { placeholder: 'nghiêng' }); }
                      else if (k === 'u') { e.preventDefault(); applyFormat('<u>', '</u>', { placeholder: 'gạch chân' }); }
                    }
                  }}
                  disabled={isTrash}
                  className={`flex-1 w-full text-sm md:text-md font-mono bg-transparent resize-none border-none p-0 focus:ring-0 focus:outline-none leading-relaxed min-h-[65vh] md:min-h-[70vh] ${
                    theme === 'dark' ? 'text-[var(--color-paper)] placeholder-zinc-700' : 'text-[var(--color-ink)] placeholder-zinc-400'
                  }`}
                  spellCheck={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sleek Design Footer */}
      <footer className={`p-4 border-t-2 flex justify-center gap-8 text-center select-none shrink-0 transition-colors duration-300 ${
        theme === 'dark' ? 'bg-[var(--color-leather)] border-[var(--color-ink-light)]' : 'bg-[var(--color-paper-dark)] border-[var(--color-ink)]'
      }`}>
        <div className={`flex items-center gap-2 font-mono ${theme === 'dark' ? 'text-[var(--color-paper-dark)]' : 'text-[var(--color-ink-light)]'}`}>
          <BookOpen className="w-3.5 h-3.5" />
          <span className="text-[10px] uppercase tracking-wider font-bold">Lưu tự động</span>
        </div>
        <div className={`flex items-center gap-2 font-mono ${theme === 'dark' ? 'text-emerald-500' : 'text-emerald-700'}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] uppercase tracking-wider font-bold">Kết nối Cloud OK</span>
        </div>
        <div className={`flex items-center gap-2 font-mono hidden sm:flex ${theme === 'dark' ? 'text-[var(--color-paper-dark)]' : 'text-[var(--color-ink-light)]'}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-[10px] uppercase tracking-wider font-bold">Bảo mật mã hóa</span>
        </div>
      </footer>

      {/* Immersive Gallery Viewer Modal — browse all attached images */}
      {lightboxIndex !== null && activeNote?.images && activeNote.images.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Trình chiếu ảnh đính kèm"
        >
          {/* Top toolbar */}
          <div
            className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b-2 border-slate-700/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-white/90 px-2.5 py-1 border-2 border-white/40 shadow-[2px_2px_0px_rgba(255,255,255,0.25)] shrink-0">
                {lightboxIndex + 1} / {activeNote.images.length}
              </span>
              {activeNote.title && (
                <span className="hidden sm:block text-xs font-mono text-white/70 truncate max-w-[40vw]">
                  {activeNote.title}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeNote.images.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsSlideshowPlaying((p) => !p)}
                  className="p-2 border-2 border-white/40 text-white/90 hover:bg-white/10 transition-all cursor-pointer shadow-[2px_2px_0px_rgba(255,255,255,0.25)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                  title={isSlideshowPlaying ? 'Tạm dừng trình chiếu (Space)' : 'Phát trình chiếu tự động (Space)'}
                >
                  {isSlideshowPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadCurrentImage}
                className="p-2 border-2 border-white/40 text-white/90 hover:bg-white/10 transition-all cursor-pointer shadow-[2px_2px_0px_rgba(255,255,255,0.25)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                title="Tải ảnh / Mở trong tab mới"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={closeLightbox}
                className="p-2 border-2 border-white/40 text-white/90 hover:bg-rose-500/30 hover:text-rose-200 transition-all cursor-pointer shadow-[2px_2px_0px_rgba(255,255,255,0.25)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                title="Đóng (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main viewer area */}
          <div className="relative flex-1 flex items-center justify-center px-2 sm:px-4 py-4 min-h-0">
            {activeNote.images.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goPrevImage(); }}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 border-2 border-white/50 text-white bg-slate-900/60 hover:bg-slate-800/80 transition-all cursor-pointer shadow-[2px_2px_0px_rgba(255,255,255,0.25)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                title="Ảnh trước (←)"
                aria-label="Ảnh trước"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}

            <img
              key={lightboxIndex}
              src={activeNote.images[lightboxIndex]}
              alt={`Ảnh ${lightboxIndex + 1} / ${activeNote.images.length}`}
              className="max-w-full max-h-full object-contain select-none border-2 border-white/30 shadow-[4px_4px_0px_rgba(255,255,255,0.2)] animate-fade-in"
              referrerPolicy="no-referrer"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => { touchStartXRef.current = e.touches[0]?.clientX ?? null; }}
              onTouchEnd={(e) => {
                const start = touchStartXRef.current;
                touchStartXRef.current = null;
                if (start === null) return;
                const end = e.changedTouches[0]?.clientX ?? start;
                const dx = end - start;
                if (Math.abs(dx) < 50) return;
                if (dx < 0) goNextImage();
                else goPrevImage();
              }}
            />

            {activeNote.images.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goNextImage(); }}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 border-2 border-white/50 text-white bg-slate-900/60 hover:bg-slate-800/80 transition-all cursor-pointer shadow-[2px_2px_0px_rgba(255,255,255,0.25)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                title="Ảnh tiếp theo (→)"
                aria-label="Ảnh tiếp theo"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
          </div>

          {/* Thumbnail strip */}
          {activeNote.images.length > 1 && (
            <div
              ref={thumbnailStripRef}
              className="border-t-2 border-slate-700/60 px-3 sm:px-6 py-3 overflow-x-auto overflow-y-hidden flex items-center gap-2.5 scrollbar-thin scrollbar-thumb-slate-600"
              onClick={(e) => e.stopPropagation()}
            >
              {activeNote.images.map((src, idx) => (
                <button
                  type="button"
                  key={idx}
                  data-thumb-idx={idx}
                  onClick={() => setLightboxIndex(idx)}
                  className={`relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 overflow-hidden border-2 transition-all cursor-pointer ${
                    idx === lightboxIndex
                      ? 'border-amber-300 shadow-[3px_3px_0px_rgba(252,211,77,0.5)] scale-105'
                      : 'border-white/30 opacity-60 hover:opacity-100 hover:border-white/70'
                  }`}
                  title={`Ảnh ${idx + 1}`}
                  aria-label={`Xem ảnh ${idx + 1}`}
                  aria-current={idx === lightboxIndex}
                >
                  <img
                    src={src}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover pointer-events-none"
                    referrerPolicy="no-referrer"
                    draggable={false}
                  />
                  <span className="absolute bottom-0 right-0 text-[9px] font-mono font-bold bg-slate-900/80 text-white px-1 leading-tight">
                    {idx + 1}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
