import { create } from 'zustand';

const DAILY_NOTES_STORAGE_KEY = 'tradepilot-daily-notes';

export interface NoteImage {
  id: string;
  dataUrl: string; // Base64 data URL for the image
  caption?: string;
  addedAt: string;
}

export interface DailyNote {
  date: string;
  content: string; // Rich text content (HTML)
  images: NoteImage[];
  lastUpdated: string;
  tags?: string[];
}

interface DailyNotesState {
  notes: Record<string, DailyNote>; // Keyed by date string (YYYY-MM-DD)
  
  // Actions
  getNote: (date: string) => DailyNote | null;
  saveNote: (date: string, content: string) => void;
  addImage: (date: string, imageDataUrl: string, caption?: string) => void;
  removeImage: (date: string, imageId: string) => void;
  updateImageCaption: (date: string, imageId: string, caption: string) => void;
  deleteNote: (date: string) => void;
  hasNote: (date: string) => boolean;
}

// Load notes from localStorage
const loadNotesFromStorage = (): Record<string, DailyNote> => {
  try {
    const stored = localStorage.getItem(DAILY_NOTES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load daily notes from storage:', error);
  }
  return {};
};

// Save notes to localStorage
const saveNotesToStorage = (notes: Record<string, DailyNote>) => {
  try {
    localStorage.setItem(DAILY_NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.error('Failed to save daily notes to storage:', error);
  }
};

export const useDailyNotesStore = create<DailyNotesState>((set, get) => ({
  notes: loadNotesFromStorage(),

  getNote: (date: string) => {
    return get().notes[date] || null;
  },

  saveNote: (date: string, content: string) => {
    set((state) => {
      const existingNote = state.notes[date];
      const newNote: DailyNote = {
        date,
        content,
        images: existingNote?.images || [],
        lastUpdated: new Date().toISOString(),
        tags: existingNote?.tags || []
      };
      
      const newNotes = {
        ...state.notes,
        [date]: newNote
      };
      
      saveNotesToStorage(newNotes);
      return { notes: newNotes };
    });
  },

  addImage: (date: string, imageDataUrl: string, caption?: string) => {
    set((state) => {
      const existingNote = state.notes[date] || {
        date,
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

      const newNotes = {
        ...state.notes,
        [date]: newNote
      };

      saveNotesToStorage(newNotes);
      return { notes: newNotes };
    });
  },

  removeImage: (date: string, imageId: string) => {
    set((state) => {
      const existingNote = state.notes[date];
      if (!existingNote) return state;

      const newNote: DailyNote = {
        ...existingNote,
        images: existingNote.images.filter(img => img.id !== imageId),
        lastUpdated: new Date().toISOString()
      };

      const newNotes = {
        ...state.notes,
        [date]: newNote
      };

      saveNotesToStorage(newNotes);
      return { notes: newNotes };
    });
  },

  updateImageCaption: (date: string, imageId: string, caption: string) => {
    set((state) => {
      const existingNote = state.notes[date];
      if (!existingNote) return state;

      const newNote: DailyNote = {
        ...existingNote,
        images: existingNote.images.map(img => 
          img.id === imageId ? { ...img, caption } : img
        ),
        lastUpdated: new Date().toISOString()
      };

      const newNotes = {
        ...state.notes,
        [date]: newNote
      };

      saveNotesToStorage(newNotes);
      return { notes: newNotes };
    });
  },

  deleteNote: (date: string) => {
    set((state) => {
      const { [date]: _, ...rest } = state.notes;
      saveNotesToStorage(rest);
      return { notes: rest };
    });
  },

  hasNote: (date: string) => {
    const note = get().notes[date];
    return !!(note && (note.content.trim() || note.images.length > 0));
  }
}));
