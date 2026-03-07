'use client';

import Image from 'next/image';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Calendar,
  Edit,
  Trash2,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  Save,
  MessageSquare,
  User
} from 'lucide-react';
import clsx from 'clsx';
import { useDailyNotesStore } from '../../store/dailyNotesStore';
import { useAccountStore } from '../../store/accountStore';
import { persistence } from '@/lib/persistence';

interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  mood: 'great' | 'good' | 'neutral' | 'bad' | 'terrible';
  marketConditions: string;
  lessonsLearned: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

const MOODS = [
  { value: 'great', label: 'Great', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/20' },
  { value: 'good', label: 'Good', icon: TrendingUp, color: 'text-emerald-500/70', bg: 'bg-emerald-500/10' },
  { value: 'neutral', label: 'Neutral', icon: Minus, color: 'text-zinc-400', bg: 'bg-[#8B94A7]/20' },
  { value: 'bad', label: 'Bad', icon: TrendingDown, color: 'text-rose-500/70', bg: 'bg-rose-500/10' },
  { value: 'terrible', label: 'Terrible', icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-500/20' },
] as const;

const loadEntriesFromStorage = (): JournalEntry[] => {
  return persistence.loadJournalEntries<JournalEntry>() || [];
};

const saveEntriesToStorage = (entries: JournalEntry[]) => {
  persistence.saveJournalEntries(entries);
};

// Combined entry type for display
interface CombinedEntry {
  id: string;
  type: 'journal' | 'daily-note';
  date: string;
  title: string;
  content: string;
  mood?: JournalEntry['mood'];
  marketConditions?: string;
  lessonsLearned?: string;
  tags: string[];
  accountId?: string;
  accountName?: string;
  images?: { id: string; dataUrl: string; caption?: string }[];
  createdAt: number;
  updatedAt: number;
}

export const Journal: React.FC = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<'all' | 'journal' | 'daily-notes'>('all');

  // Get daily notes from calendar
  const { notes: dailyNotes, deleteNote } = useDailyNotesStore();
  const { accounts } = useAccountStore();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    mood: 'neutral' as JournalEntry['mood'],
    marketConditions: '',
    lessonsLearned: '',
    tags: ''
  });

  useEffect(() => {
    setEntries(loadEntriesFromStorage());
  }, []);

  // Combine journal entries and daily notes into a single list
  const combinedEntries = useMemo((): CombinedEntry[] => {
    // Helper to get account name by ID
    const getAccountName = (accountId?: string) => {
      if (!accountId) return 'General';
      const account = accounts.find(a => a.id === accountId);
      return account?.name || 'Unknown Account';
    };

    const combined: CombinedEntry[] = [];

    // Add journal entries
    entries.forEach(entry => {
      combined.push({
        id: entry.id,
        type: 'journal',
        date: entry.date,
        title: entry.title,
        content: entry.content,
        mood: entry.mood,
        marketConditions: entry.marketConditions,
        lessonsLearned: entry.lessonsLearned,
        tags: entry.tags,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      });
    });

    // Add daily notes from calendar
    Object.values(dailyNotes).forEach(note => {
      // Skip empty notes
      if (!note.content.trim() && note.images.length === 0) return;
      
      // Strip HTML tags for preview
      const plainContent = note.content.replace(/<[^>]*>/g, '').trim();
      
      combined.push({
        id: `daily-${note.accountId || 'global'}-${note.date}`,
        type: 'daily-note',
        date: note.date,
        title: `Trading Notes - ${new Date(note.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        content: plainContent,
        tags: note.tags || [],
        accountId: note.accountId,
        accountName: getAccountName(note.accountId),
        images: note.images,
        createdAt: new Date(note.lastUpdated).getTime(),
        updatedAt: new Date(note.lastUpdated).getTime()
      });
    });

    // Sort by date (newest first)
    return combined.sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return b.updatedAt - a.updatedAt;
    });
  }, [entries, dailyNotes, accounts]);

  const handleSaveEntry = () => {
    const now = Date.now();
    const tagsArray = formData.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (editingEntry) {
      const updatedEntries = entries.map(e =>
        e.id === editingEntry.id
          ? {
              ...e,
              title: formData.title,
              content: formData.content,
              mood: formData.mood,
              marketConditions: formData.marketConditions,
              lessonsLearned: formData.lessonsLearned,
              tags: tagsArray,
              updatedAt: now
            }
          : e
      );
      setEntries(updatedEntries);
      saveEntriesToStorage(updatedEntries);
    } else {
      const newEntry: JournalEntry = {
        id: `journal-${now}-${Math.random().toString(36).substr(2, 9)}`,
        date: new Date().toISOString().split('T')[0],
        title: formData.title || 'Untitled Entry',
        content: formData.content,
        mood: formData.mood,
        marketConditions: formData.marketConditions,
        lessonsLearned: formData.lessonsLearned,
        tags: tagsArray,
        createdAt: now,
        updatedAt: now
      };
      const updatedEntries = [newEntry, ...entries];
      setEntries(updatedEntries);
      saveEntriesToStorage(updatedEntries);
    }

    handleCloseEditor();
  };

  const handleEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setFormData({
      title: entry.title,
      content: entry.content,
      mood: entry.mood,
      marketConditions: entry.marketConditions,
      lessonsLearned: entry.lessonsLearned,
      tags: entry.tags.join(', ')
    });
    setShowEditor(true);
  };

  const handleDeleteEntry = (id: string) => {
    const updatedEntries = entries.filter(e => e.id !== id);
    setEntries(updatedEntries);
    saveEntriesToStorage(updatedEntries);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingEntry(null);
    setFormData({
      title: '',
      content: '',
      mood: 'neutral',
      marketConditions: '',
      lessonsLearned: '',
      tags: ''
    });
  };

  const handleNewEntry = () => {
    setEditingEntry(null);
    setFormData({
      title: '',
      content: '',
      mood: 'neutral',
      marketConditions: '',
      lessonsLearned: '',
      tags: ''
    });
    setShowEditor(true);
  };

  const filteredEntries = combinedEntries.filter(entry => {
    const matchesSearch =
      entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.accountName && entry.accountName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesMood = !selectedMoodFilter || entry.mood === selectedMoodFilter;
    const matchesType = viewFilter === 'all' || 
      (viewFilter === 'journal' && entry.type === 'journal') ||
      (viewFilter === 'daily-notes' && entry.type === 'daily-note');
    return matchesSearch && matchesMood && matchesType;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getMoodInfo = (mood: JournalEntry['mood']) => {
    return MOODS.find(m => m.value === mood) || MOODS[2];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-xl border border-white/5 p-6"
        
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100">Trading Journal</h2>
            <p className="text-zinc-400 mt-1">
              Record your thoughts, emotions, and lessons from each trading session
            </p>
          </div>
          <button
            onClick={handleNewEntry}
            className="flex items-center space-x-2 px-4 py-2 bg-white text-zinc-950 hover:bg-zinc-200 font-medium rounded-lg hover:opacity-90 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>New Entry</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search entries..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#181B24] border border-white/5 text-zinc-100 placeholder-[#8B94A7] focus:outline-none focus:border-emerald-500/30"
            />
          </div>

          <div className="flex items-center space-x-2">
            {MOODS.map(mood => (
              <button
                key={mood.value}
                onClick={() => setSelectedMoodFilter(
                  selectedMoodFilter === mood.value ? null : mood.value
                )}
                className={clsx(
                  'p-2 rounded-lg border transition-all',
                  selectedMoodFilter === mood.value
                    ? `${mood.bg} border-transparent`
                    : 'border-white/5 hover:border-emerald-500/50'
                )}
                title={mood.label}
              >
                <mood.icon className={clsx('h-4 w-4', mood.color)} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* View Filter Tabs */}
      <div className="flex items-center space-x-2">
        {[
          { value: 'all', label: 'All Entries' },
          { value: 'daily-notes', label: 'Calendar Notes' },
          { value: 'journal', label: 'Journal Entries' }
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setViewFilter(tab.value as typeof viewFilter)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              viewFilter === tab.value
                ? 'bg-white/10 text-zinc-100 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-100 border border-transparent hover:border-white/5'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <div
          className="rounded-xl border border-white/5 p-12 text-center"
          
        >
          <Calendar className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-100 mb-2">
            {combinedEntries.length === 0 ? 'No journal entries yet' : 'No matching entries'}
          </h3>
          <p className="text-zinc-400 mb-6">
            {combinedEntries.length === 0
              ? 'Start documenting your trading journey by creating your first entry or adding notes from the Calendar.'
              : 'Try adjusting your search or filters.'}
          </p>
          {combinedEntries.length === 0 && (
            <button
              onClick={handleNewEntry}
              className="px-6 py-2 bg-white text-zinc-950 hover:bg-zinc-200 font-medium rounded-lg hover:opacity-90 transition-all"
            >
              Create First Entry
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map(entry => {
            const moodInfo = entry.mood ? getMoodInfo(entry.mood) : null;
            const isDailyNote = entry.type === 'daily-note';
            
            return (
              <div
                key={entry.id}
                className="rounded-xl border border-white/5 p-6 hover:border-transparent hover:shadow-lg transition-all group relative overflow-hidden"
                
              >
                {/* Gradient border on hover */}
                <div className="absolute inset-0 rounded-xl border border-white/0 group-hover:border-white/10 pointer-events-none transition-colors duration-300 pointer-events-none">
                  <div
                    className="w-full h-full rounded-xl"
                    
                  />
                </div>

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {/* Icon based on entry type */}
                      {isDailyNote ? (
                        <div className="p-2 rounded-lg bg-[#242838]/80">
                          <MessageSquare className="h-5 w-5 text-zinc-400" />
                        </div>
                      ) : moodInfo ? (
                        <div className={clsx('p-2 rounded-lg', moodInfo.bg)}>
                          <moodInfo.icon className={clsx('h-5 w-5', moodInfo.color)} />
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-[#8B94A7]/20">
                          <Calendar className="h-5 w-5 text-zinc-400" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold text-zinc-100">{entry.title}</h3>
                          {/* Entry type badge */}
                          <span className={clsx(
                            'px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full',
                            isDailyNote 
                              ? 'bg-[#242838]/80 text-zinc-400' 
                              : 'bg-emerald-500/20 text-emerald-500'
                          )}>
                            {isDailyNote ? 'Calendar' : 'Journal'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <p className="text-sm text-zinc-400">{formatDate(entry.date)}</p>
                          {/* Account badge for daily notes */}
                          {isDailyNote && entry.accountName && (
                            <>
                              <span className="text-[#2C3148]">•</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[#242838] text-zinc-400 flex items-center space-x-1">
                                <User className="h-3 w-3" />
                                <span>{entry.accountName}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Only show edit for journal entries */}
                      {!isDailyNote && (
                        <button
                          onClick={() => {
                            const journalEntry = entries.find(e => e.id === entry.id);
                            if (journalEntry) handleEditEntry(journalEntry);
                          }}
                          className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (isDailyNote && entry.accountId) {
                            deleteNote(entry.date, entry.accountId);
                          } else if (isDailyNote) {
                            deleteNote(entry.date);
                          } else {
                            handleDeleteEntry(entry.id);
                          }
                        }}
                        className="p-2 text-zinc-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-zinc-100 mb-4 line-clamp-3">{entry.content}</p>

                  {/* Images for daily notes */}
                  {isDailyNote && entry.images && entry.images.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {entry.images.slice(0, 4).map((img, idx) => (
                        <div key={img.id} className="relative group/img">
                          <Image
                            src={img.dataUrl} 
                            alt={img.caption || `Screenshot ${idx + 1}`}
                            className="h-20 w-auto rounded-lg border border-white/5 object-cover"
                            width={160}
                            height={80}
                            unoptimized
                          />
                          {entry.images && entry.images.length > 4 && idx === 3 && (
                            <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold">+{entry.images.length - 4}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {entry.lessonsLearned && (
                    <div className="mb-4 p-3 rounded-lg bg-[#181B24] border border-white/5">
                      <p className="text-xs text-zinc-400 mb-1">Lessons Learned</p>
                      <p className="text-sm text-zinc-100">{entry.lessonsLearned}</p>
                    </div>
                  )}

                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {entry.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs rounded-full bg-[#242838] text-zinc-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleCloseEditor}
          />
          <div
            className="relative w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-2xl border border-white/5"
            
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-white/5" >
              <h2 className="text-xl font-bold text-zinc-100">
                {editingEntry ? 'Edit Entry' : 'New Journal Entry'}
              </h2>
              <button
                onClick={handleCloseEditor}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-[#242838] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-[#181B24] border border-white/5 text-zinc-100 placeholder-[#8B94A7] focus:outline-none focus:border-emerald-500/30"
                  placeholder="How was your trading day?"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Mood</label>
                <div className="flex space-x-2">
                  {MOODS.map(mood => (
                    <button
                      key={mood.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, mood: mood.value })}
                      className={clsx(
                        'flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg border transition-all',
                        formData.mood === mood.value
                          ? `${mood.bg} border-transparent`
                          : 'border-white/5 hover:border-emerald-500/50'
                      )}
                    >
                      <mood.icon className={clsx('h-4 w-4', mood.color)} />
                      <span className={clsx('text-sm', formData.mood === mood.value ? mood.color : 'text-zinc-400')}>
                        {mood.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Journal Entry</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2 rounded-lg bg-[#181B24] border border-white/5 text-zinc-100 placeholder-[#8B94A7] focus:outline-none focus:border-emerald-500/30 resize-none"
                  placeholder="Write about your trading session, thoughts, emotions..."
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Market Conditions</label>
                <input
                  type="text"
                  value={formData.marketConditions}
                  onChange={(e) => setFormData({ ...formData, marketConditions: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-[#181B24] border border-white/5 text-zinc-100 placeholder-[#8B94A7] focus:outline-none focus:border-emerald-500/30"
                  placeholder="Trending, ranging, volatile..."
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Lessons Learned</label>
                <textarea
                  value={formData.lessonsLearned}
                  onChange={(e) => setFormData({ ...formData, lessonsLearned: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-[#181B24] border border-white/5 text-zinc-100 placeholder-[#8B94A7] focus:outline-none focus:border-emerald-500/30 resize-none"
                  placeholder="What did you learn today?"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Tags (comma separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-[#181B24] border border-white/5 text-zinc-100 placeholder-[#8B94A7] focus:outline-none focus:border-emerald-500/30"
                  placeholder="scalping, momentum, breakout..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleCloseEditor}
                  className="flex-1 py-3 rounded-lg border border-white/5 text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/30 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEntry}
                  className="flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 font-medium hover:opacity-90 transition-all"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingEntry ? 'Save Changes' : 'Create Entry'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Journal;
