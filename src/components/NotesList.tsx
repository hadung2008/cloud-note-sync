import React from 'react';
import { Search, Pin, Star, Plus, SortAsc, HelpCircle, X, Menu } from 'lucide-react';
import { useNotes } from '../context/NotesContext';
import { Note, SubNote } from '../types';
import SyncIndicator from './SyncIndicator';
import { motion, AnimatePresence } from 'motion/react';
import { t } from '../lib/i18n';

export default function NotesList() {
  const {
    notes,
    currentFolder,
    currentTag,
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
    activeNoteId,
    setActiveNoteId,
    addNote,
    updateNote,
    togglePin,
    toggleFavorite,
    theme,
    language,
    setIsSidebarOpen
  } = useNotes();

  const handleAddSubNote = async (noteId: string, title: string) => {
    if (!title.trim()) return;
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    const newSub: SubNote = {
      id: 'sub_' + Math.random().toString(36).substring(2, 9),
      title: title.trim(),
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };

    const existingSubs = note.subNotes || [];
    await updateNote(noteId, {
      subNotes: [...existingSubs, newSub],
    });
  };

  const handleToggleSubNote = async (noteId: string, subId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note || !note.subNotes) return;

    const updatedSubs = note.subNotes.map((sub) => {
      if (sub.id === subId) {
        return { ...sub, isCompleted: !sub.isCompleted };
      }
      return sub;
    });

    await updateNote(noteId, {
      subNotes: updatedSubs,
    });
  };

  const handleDeleteSubNote = async (noteId: string, subId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note || !note.subNotes) return;

    const updatedSubs = note.subNotes.filter((sub) => sub.id !== subId);
    await updateNote(noteId, {
      subNotes: updatedSubs,
    });
  };

  // Helper to format timestamps gracefully
  const formatTime = (isoString: any) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return String(isoString);
      return date.toLocaleDateString('vi-VN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  // Human descriptive folder titles
  const getBannerTitle = () => {
    if (currentTag) return `#${currentTag}`;
    switch (currentFolder) {
      case 'all': return t(language, 'all_notes');
      case 'personal': return t(language, 'personal');
      case 'work': return t(language, 'work');
      case 'ideas': return t(language, 'ideas');
      case 'trash': return t(language, 'trash');
      default: return currentFolder;
    }
  };

  // Filter Notes logically
  const filteredNotes = notes.filter((note) => {
    // 1. Folder Check
    if (currentFolder === 'all') {
      // Exclude trash from general search/all screen
      if (note.folder === 'trash') return false;
    } else {
      if (note.folder !== currentFolder) return false;
    }

    // 2. Tag Check
    if (currentTag && (!note.tags || !note.tags.includes(currentTag))) {
      return false;
    }

    // 3. Search text match
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const titleMatch = note.title?.toLowerCase().includes(query);
      const contentMatch = note.content?.toLowerCase().includes(query);
      if (!titleMatch && !contentMatch) return false;
    }

    return true;
  });

  // Sort notes: pinned go on top, then sort based on selected preference
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    // 1. Pinned status takes absolute priority
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    // 2. Standard attributes sorting
    if (sortBy === 'title') {
      return (a.title || '').localeCompare(b.title || '');
    } else if (sortBy === 'createdAt') {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    } else {
      // Default / Last Updated (updatedAt)
      const dateA = new Date(a.updatedAt || 0).getTime();
      const dateB = new Date(b.updatedAt || 0).getTime();
      return dateB - dateA;
    }
  });

  // Handle active note trigger upon creation
  const handleAddNewNote = async () => {
    const defaultFolder = currentFolder !== 'all' && currentFolder !== 'trash' ? currentFolder : 'personal';
    const newNote = await addNote(t(language, 'untitled_note'), '', defaultFolder, 'slate');
    setActiveNoteId(newNote.id);
  };

  // Get color styling matches
  const getNoteColorStyles = (color: string | undefined, isActive: boolean) => {
    // Determine the primary hex color
    let hex = '#64748b'; // default slate xám
    if (color) {
      if (color.startsWith('#')) {
        hex = color;
      } else {
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
        hex = colorsMap[color] || '#64748b';
      }
    }

    let r = 100, g = 116, b = 139;
    const rawHex = hex.replace('#', '');
    if (rawHex.length === 3) {
      r = parseInt(rawHex[0] + rawHex[0], 16) || 0;
      g = parseInt(rawHex[1] + rawHex[1], 16) || 0;
      b = parseInt(rawHex[2] + rawHex[2], 16) || 0;
    } else if (rawHex.length === 6) {
      r = parseInt(rawHex.substring(0, 2), 16) || 0;
      g = parseInt(rawHex.substring(2, 4), 16) || 0;
      b = parseInt(rawHex.substring(4, 6), 16) || 0;
    }

    if (isActive) {
      return {
        style: {
          borderLeftColor: hex,
          borderLeftWidth: '5px',
          background: theme === 'dark' 
            ? `linear-gradient(90deg, rgba(${r}, ${g}, ${b}, 0.16) 0%, rgba(${r}, ${g}, ${b}, 0.03) 100%)`
            : `linear-gradient(90deg, rgba(${r}, ${g}, ${b}, 0.06) 0%, rgba(${r}, ${g}, ${b}, 0.01) 100%)`,
        },
        className: `p-5 text-left cursor-pointer transition-all duration-300 relative rounded-2xl border ring-4 ring-offset-0 shadow-md scale-[1.015] ${
          theme === 'dark'
            ? 'border-slate-700/80 bg-slate-900 shadow-slate-900/50 ring-blue-500/10'
            : 'border-slate-200/90 bg-white shadow-slate-200/50 ring-blue-500/10'
        }`
      };
    } else {
      return {
        style: {
          borderLeftColor: hex,
          borderLeftWidth: '5px'
        },
        className: `p-5 text-left cursor-pointer transition-all duration-350 relative rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
          theme === 'dark' 
            ? 'border-slate-800/80 bg-slate-950/40 text-slate-300 hover:border-slate-700/80 hover:bg-slate-900' 
            : 'border-slate-200/60 bg-white/70 text-slate-700 hover:border-slate-300 hover:bg-white'
        }`
      };
    }
  };

  return (
    <section 
      id="notes-list-panel"
      className={`w-full md:w-[280px] lg:w-[320px] xl:w-[380px] border-r h-full flex flex-col shrink-0 font-sans transition-colors duration-300 ${
        activeNoteId ? 'hidden md:flex' : 'flex'
      } ${
        theme === 'dark' ? 'bg-[var(--color-leather)] border-r-2 border-[var(--color-ink-light)] text-[var(--color-paper)]' : 'bg-[var(--color-paper)] border-r-2 border-[var(--color-ink)] text-[var(--color-ink)]'
      }`}
    >
      {/* Search and sync banner header */}
      <div className={`px-4 py-3 md:px-4 md:py-4 lg:px-5 lg:py-5 border-b-2 flex flex-col gap-3 md:gap-4 lg:gap-5 transition-colors duration-300 relative z-10 ${
        theme === 'dark' ? 'border-[var(--color-ink-light)]' : 'border-[var(--color-ink)]'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              className={`md:hidden p-1.5 -ml-1.5 border-2 transition-colors ${
                theme === 'dark' ? 'border-[var(--color-ink-light)] text-[var(--color-paper)] hover:bg-[var(--color-leather-dark)]' : 'border-[var(--color-ink)] text-[var(--color-ink)] hover:bg-[var(--color-paper-dark)]'
              }`} 
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className={`text-sm font-display font-bold uppercase tracking-widest flex items-center gap-2 ${
              theme === 'dark' ? 'text-[var(--color-paper)]' : 'text-[var(--color-ink)]'
            }`}>
              {getBannerTitle()}
            </h2>
          </div>
          <SyncIndicator />
        </div>

        {/* Action controls */}
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <div className="relative flex-1 group">
            <Search className={`absolute left-3 top-2.5 w-4 h-4 transition-colors ${
              theme === 'dark' ? 'text-[var(--color-paper-dark)]' : 'text-[var(--color-ink-light)]'
            }`} />
            <input
              id="notes-search-input"
              type="text"
              placeholder={t(language, 'search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full text-xs font-mono pl-9 pr-3 py-2.5 transition-all duration-300 outline-none border-2 bg-transparent ${
                theme === 'dark'
                  ? 'border-[var(--color-ink-light)] text-[var(--color-paper)] placeholder-[var(--color-ink-light)] focus:border-[var(--color-paper)]'
                  : 'border-[var(--color-ink)] text-[var(--color-ink)] placeholder-[var(--color-ink-light)] focus:bg-[var(--color-paper-dark)]'
              }`}
            />
          </div>

          <div className="relative shrink-0 group">
            <select
              id="notes-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={`text-xs h-full py-2.5 pl-3 pr-8 outline-none border-2 cursor-pointer appearance-none font-mono transition-all bg-transparent ${
                theme === 'dark'
                  ? 'border-[var(--color-ink-light)] text-[var(--color-paper)] focus:border-[var(--color-paper)]'
                  : 'border-[var(--color-ink)] text-[var(--color-ink)] focus:bg-[var(--color-paper-dark)]'
              }`}
            >
              <option value="updatedAt" className={theme === 'dark' ? 'bg-[var(--color-leather)]' : 'bg-[var(--color-paper)]'}>{t(language, 'sort_updated')}</option>
              <option value="createdAt" className={theme === 'dark' ? 'bg-[var(--color-leather)]' : 'bg-[var(--color-paper)]'}>{t(language, 'sort_created')}</option>
              <option value="title" className={theme === 'dark' ? 'bg-[var(--color-leather)]' : 'bg-[var(--color-paper)]'}>{t(language, 'sort_title')}</option>
            </select>
            <span className={`pointer-events-none absolute right-2.5 top-3.5 transition-colors ${theme === 'dark' ? 'text-[var(--color-paper)]' : 'text-[var(--color-ink)]'}`}>
              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 4 5"><path d="M2 5L4 1H0Z"/></svg>
            </span>
          </div>
        </div>
      </div>

      {/* Primary list space */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent">
        {/* New Note triggers */}
        {currentFolder !== 'trash' && (
          <div className="px-4.5 pt-4.5 pb-2">
            <button
              id="btn-create-note-quick"
              onClick={handleAddNewNote}
              className={`flex items-center justify-center gap-2.5 w-full py-3 px-4 border-2 transition-all duration-300 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer group shadow-[4px_4px_0px_#2C2A29] dark:shadow-[4px_4px_0px_#EBE5D0] ${
                theme === 'dark'
                  ? 'border-[var(--color-ink-light)] bg-transparent hover:bg-[var(--color-leather-dark)] text-[var(--color-paper)]'
                  : 'border-[var(--color-ink)] bg-[var(--color-paper)] hover:bg-[var(--color-paper-dark)] text-[var(--color-ink)]'
              } text-xs md:text-sm font-mono font-bold`}
            >
              <div className={`w-5 h-5 flex items-center justify-center transition-all duration-300 group-hover:rotate-90`}>
                <Plus className="w-4 h-4" />
              </div>
              <span className="tracking-widest uppercase mt-0.5">{t(language, 'create_new_note')}</span>
            </button>
          </div>
        )}

        {sortedNotes.length === 0 ? (
          <div className="py-20 px-6 text-center select-none">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 border transition-all duration-300 ${
              theme === 'dark' ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-400 border-slate-200/50'
            }`}>
              <Search className="w-5.5 h-5.5 text-slate-400" />
            </div>
            <p className={`text-xs font-display font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
              {t(language, 'no_notes_found')}
            </p>
            <p className="text-[11px] font-sans text-slate-400 mt-2.5 leading-relaxed max-w-[200px] mx-auto">
              {searchQuery ? "Hãy thử từ khóa khác hoặc xóa bộ lọc để tìm lại." : "Bắt đầu lưu giữ những ý tưởng tuyệt vời nhất ngay bây giờ."}
            </p>
          </div>
        ) : (
          <div className="p-4.5 pt-2 space-y-4">
            <AnimatePresence initial={false}>
              {sortedNotes.map((note) => {
                const isActive = activeNoteId === note.id;
                return (
                  <motion.div
                    id={`note-card-wrapper-${note.id}`}
                    key={note.id}
                    layoutId={note.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div
                      id={`note-card-${note.id}`}
                      onClick={() => setActiveNoteId(note.id)}
                      className={`${getNoteColorStyles(note.color, isActive).className}`}
                      style={getNoteColorStyles(note.color, isActive).style}
                    >
                      <div className="flex items-start justify-between gap-2.5 mb-2">
                        <h4 className={`font-display text-xs line-clamp-1 flex-1 tracking-tight ${
                          isActive 
                            ? (theme === 'dark' ? 'font-bold text-white' : 'font-bold text-slate-900 group-active:text-blue-900') 
                            : (theme === 'dark' ? 'font-semibold text-slate-350' : 'font-semibold text-slate-800')
                        }`}>
                          {note.title || t(language, 'untitled_note')}
                        </h4>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          {note.isPinned && (
                            <div className={`p-0.5 rounded border ${
                              theme === 'dark' ? 'bg-orange-950/40 border-orange-500/20' : 'bg-orange-50 border-orange-200/40'
                            }`} title="Ghi chú ghim">
                              <Pin className="w-3 h-3 text-orange-500 fill-orange-400 shrink-0" />
                            </div>
                          )}
                          {note.isFavorite && (
                            <div className={`p-0.5 rounded border ${
                              theme === 'dark' ? 'bg-amber-950/40 border-amber-500/20' : 'bg-amber-50 border-amber-200/40'
                            }`} title="Yêu thích">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                            </div>
                          )}
                        </div>
                      </div>

                      <p className={`text-[11px] line-clamp-2 leading-relaxed font-sans mb-3 select-none ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-550'
                      }`}>
                        {note.content ? note.content.replace(/[#*`_~-]/g, '') : t(language, 'no_description')}
                      </p>

                      {/* Note Attached Images Preview Row */}
                      {note.images && note.images.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-3 select-none">
                          {note.images.slice(0, 4).map((imgSrc, i) => (
                            <div key={i} className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-205/45 dark:border-slate-800/80 shrink-0">
                              <img src={imgSrc} alt="" className="w-full h-full object-cover pointer-events-none" />
                            </div>
                          ))}
                          {note.images.length > 4 && (
                            <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 font-bold pl-0.5">
                              +{note.images.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Sub-Notes / Nested Checklist Section -- ONLY if there are checklist items */}
                      {note.subNotes && note.subNotes.length > 0 && (
                        <div 
                          className={`my-2.5 p-2.5 rounded-xl border flex flex-col gap-2 transition-all duration-300 ${
                            theme === 'dark' 
                              ? 'bg-slate-950/35 border-slate-800/40' 
                              : 'bg-slate-100/30 border-slate-200/40'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Sub-notes list header with clean progress bar */}
                          <div className="flex items-center justify-between text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider select-none">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                              <span>Checklist({note.subNotes.filter(s => s.isCompleted).length}/{note.subNotes.length})</span>
                            </span>
                            <span className="text-[10px] text-blue-500 font-mono">
                              {Math.round((note.subNotes.filter(s => s.isCompleted).length / note.subNotes.length) * 100)}%
                            </span>
                          </div>

                          {/* Beautiful mini progress track */}
                          <div className="w-full h-1 bg-slate-200/50 dark:bg-slate-800/60 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all duration-300"
                              style={{ width: `${(note.subNotes.filter(s => s.isCompleted).length / note.subNotes.length) * 100}%` }}
                            />
                          </div>

                          {/* List items - Compact & borderless */}
                          <div className="gap-1 flex flex-col max-h-24 overflow-y-auto pr-0.5 scrollbar-none">
                            {note.subNotes.slice(0, 3).map((sub) => (
                              <div 
                                key={sub.id}
                                className="flex items-center gap-2 py-0.5 text-[11px] font-sans transition-all"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubNote(note.id, sub.id)}
                                  className="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer select-none"
                                >
                                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                                    sub.isCompleted 
                                      ? 'bg-blue-500 border-blue-500 text-white shadow-3xs' 
                                      : (theme === 'dark' ? 'border-slate-750 bg-slate-900 hover:border-blue-500' : 'border-slate-350 bg-white hover:border-blue-405')
                                  }`}>
                                    {sub.isCompleted && (
                                      <svg className="w-2 h-2 stroke-current stroke-[3.5] fill-none" viewBox="0 0 24 24">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    )}
                                  </span>
                                  <span className={`truncate text-[11px] ${
                                    sub.isCompleted 
                                      ? 'text-slate-400 dark:text-slate-550 line-through' 
                                      : (theme === 'dark' ? 'text-slate-300 font-medium' : 'text-slate-700 font-medium')
                                  }`}>
                                    {sub.title}
                                  </span>
                                </button>
                              </div>
                            ))}
                            {note.subNotes.length > 3 && (
                              <div className="text-[10px] font-sans font-semibold text-slate-400 dark:text-slate-550 pl-5.5 pt-0.5">
                                + {note.subNotes.length - 3} mục khác...
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 select-none">
                        <span className="text-[10px] font-mono text-slate-400">
                          {formatTime(note.updatedAt)}
                        </span>
                        
                        {note.tags && note.tags.length > 0 && (
                          <div className="flex gap-1 overflow-hidden max-w-[125px]">
                            {note.tags.slice(0, 2).map((t) => {
                              const tagColorMap: { [key: string]: string } = {
                                work: theme === 'dark' 
                                  ? 'bg-indigo-950/45 text-indigo-400 border border-indigo-500/20' 
                                  : 'bg-indigo-50/70 text-indigo-600 border border-indigo-100/40',
                                personal: theme === 'dark' 
                                  ? 'bg-emerald-950/45 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-emerald-50/70 text-emerald-600 border border-emerald-100/40',
                                ideas: theme === 'dark' 
                                  ? 'bg-amber-950/45 text-amber-400 border border-amber-500/20' 
                                  : 'bg-amber-50/70 text-amber-600 border border-amber-100/40',
                              };
                              const folderColorClass = tagColorMap[note.folder] || (
                                theme === 'dark' 
                                  ? 'bg-slate-800 text-slate-400 border border-slate-700/60' 
                                  : 'bg-slate-100 text-slate-600 border border-slate-200/30'
                              );
                              return (
                                <span 
                                  key={t} 
                                  className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md ${folderColorClass} truncate`}
                                >
                                  #{t}
                                </span>
                              );
                            })}
                            {note.tags.length > 2 && (
                              <span className={`text-[9px] font-mono font-bold self-center ml-0.5 px-1 py-0.2 rounded-md ${
                                theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'
                              }`}>+{note.tags.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}
