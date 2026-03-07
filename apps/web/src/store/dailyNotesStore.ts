'use client';

import { create } from 'zustand';
import { persistence } from '@/lib/persistence';

export interface NoteImage {
  id: string;
  dataUrl: string; // Base64 data URL for the image
  caption?: string;
  addedAt: string;
}

export interface DailyNote {
  date: string;
  accountId?: string; // Account this note belongs to (undefined = global/journal)
  content: string;   // Rich text content (HTML)
  images: NoteImage[];
  lastUpdated: string;
  tags?: string[];
}

interface DailyNotesState {
  notes: Record<string, DailyNote>;
  _hydrated: boolean; // true once IDB load has completed

  // Actions
  hydrate: () => Promise<void>;
  getNote: (date: string, accountId?: string) => DailyNote | null;
  saveNote: (date: string, content: string, accountId?: string) => void;
  addImage: (date: string, imageDataUrl: string, accountId?: string, caption?: string) => void;
  removeImage: (date: string, imageId: string, accountId?: string) => void;
  updateImageCaption: (date: string, imageId: string, caption: string, accountId?: string) => void;
  deleteNote: (date: string, accountId?: string) => void;
  hasNote: (date: string, accountId?: string) => boolean;
  getAllNotesForDate: (date: string) => DailyNote[];
}

// Helper to create storage key
const makeKey = (date: string, accountId?: string) =>
  accountId ? `${accountId}:${date}` : date;

// Fire-and-forget persist to IDB
function persistNotes(notes: Record<string, DailyNote>): void {
  persistence.saveNotes(notes as Record<string, unknown>).catch(e =>
    console.error('Failed to persist notes to IDB:', e)
  );
}

export const useDailyNotesStore = create<DailyNotesState>((set, get) => ({
  notes: {},
  _hydrated: false,

  // Call this once from a client useEffect to load from IDB
  hydrate: async () => {
    if (get()._hydrated) return;
    try {
      const stored = await persistence.loadNotes();
      set({ notes: stored as Record<string, DailyNote>, _hydrated: true });
    } catch (e) {
      console.error('Failed to hydrate notes from IDB:', e);
      set({ _hydrated: true });
    }
  },

  getNote: (date, accountId) => {
    const key = makeKey(date, accountId);
    return get().notes[key] || null;
  },

  saveNote: (date, content, accountId) => {
    set((state) => {
      const key = makeKey(date, accountId);
      const existingNote = state.notes[key];
      const newNote: DailyNote = {
        date,
        accountId,
        content,
        images: existingNote?.images || [],
        lastUpdated: new Date().toISOString(),
        tags: existingNote?.tags || []
      };
      const newNotes = { ...state.notes, [key]: newNote };
      persistNotes(newNotes);
      return { notes: newNotes };
    });
  },

  addImage: (date, imageDataUrl, accountId, caption) => {
    set((state) => {
      const key = makeKey(date, accountId);
      const existingNote = state.notes[key] || {
        date,
        accountId,
        content: '',
        images: [],
        lastUpdated: new Date().toISOString(),
        tags: []
      };

      const newImage: NoteImage = {
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        dataUrl: imageDataUrl,
        caption,
        addedAt: new Date().toISOString()
      };

      const newNote: DailyNote = {
        ...existingNote,
        images: [...existingNote.images, newImage],
        lastUpdated: new Date().toISOString()
      };

      const newNotes = { ...state.notes, [key]: newNote };
      persistNotes(newNotes);
      return { notes: newNotes };
    });
  },

  removeImage: (date, imageId, accountId) => {
    set((state) => {
      const key = makeKey(date, accountId);
      const existingNote = state.notes[key];
      if (!existingNote) return state;

      const newNote: DailyNote = {
        ...existingNote,
        images: existingNote.images.filter(img => img.id !== imageId),
        lastUpdated: new Date().toISOString()
      };

      const newNotes = { ...state.notes, [key]: newNote };
      persistNotes(newNotes);
      return { notes: newNotes };
    });
  },

  updateImageCaption: (date, imageId, caption, accountId) => {
    set((state) => {
      const key = makeKey(date, accountId);
      const existingNote = state.notes[key];
      if (!existingNote) return state;

      const newNote: DailyNote = {
        ...existingNote,
        images: existingNote.images.map(img =>
          img.id === imageId ? { ...img, caption } : img
        ),
        lastUpdated: new Date().toISOString()
      };

      const newNotes = { ...state.notes, [key]: newNote };
      persistNotes(newNotes);
      return { notes: newNotes };
    });
  },

  deleteNote: (date, accountId) => {
    set((state) => {
      const key = makeKey(date, accountId);
      const { [key]: _, ...rest } = state.notes;
      persistNotes(rest);
      return { notes: rest };
    });
  },

  hasNote: (date, accountId) => {
    const key = makeKey(date, accountId);
    const note = get().notes[key];
    return !!(note && (note.content.trim() || note.images.length > 0));
  },

  getAllNotesForDate: (date) => {
    const notes = get().notes;
    return Object.values(notes).filter(note => note.date === date);
  }
}));
