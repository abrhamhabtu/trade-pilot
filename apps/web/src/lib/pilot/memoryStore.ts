'use client';

// What Pilot remembers, per account, in this browser: past conversations to
// pick back up, and short notes the trader chose to keep. Notes ride along in
// every fact sheet so Pilot builds on them.

import { create } from 'zustand';
import type { ChatTurn } from '@/lib/pilot/chatTypes';

const KEY = 'tradepilot_pilot_memory_v1';
const MAX_CHATS_PER_ACCOUNT = 25;
const MAX_NOTES_PER_ACCOUNT = 20;

export interface SavedChat {
  id: string;
  accountId: string;
  title: string;
  updatedAt: string;
  turns: ChatTurn[];
}

export interface PilotNote {
  id: string;
  accountId: string;
  text: string;
  createdAt: string;
}

interface MemoryState {
  chats: SavedChat[];
  notes: PilotNote[];
  hydrated: boolean;
  hydrate: () => void;
  saveChat: (chat: SavedChat) => void;
  deleteChat: (id: string) => void;
  addNote: (accountId: string, text: string) => void;
  deleteNote: (id: string) => void;
}

function persist(chats: SavedChat[], notes: PilotNote[]) {
  // Storage can fill up; drop the oldest chats until it fits rather than lose notes.
  let keep = [...chats];
  for (;;) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ chats: keep, notes }));
      return;
    } catch {
      if (!keep.length) return;
      keep = keep.slice(0, -1);
    }
  }
}

const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const usePilotMemory = create<MemoryState>((set, get) => ({
  chats: [],
  notes: [],
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved) set({ chats: Array.isArray(saved.chats) ? saved.chats : [], notes: Array.isArray(saved.notes) ? saved.notes : [] });
    } catch {
      /* start empty */
    }
    set({ hydrated: true });
  },
  saveChat: (chat) => {
    const others = get().chats.filter((c) => c.id !== chat.id);
    const mine = [chat, ...others.filter((c) => c.accountId === chat.accountId)].slice(0, MAX_CHATS_PER_ACCOUNT);
    const chats = [...mine, ...others.filter((c) => c.accountId !== chat.accountId)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    set({ chats });
    persist(chats, get().notes);
  },
  deleteChat: (id) => {
    const chats = get().chats.filter((c) => c.id !== id);
    set({ chats });
    persist(chats, get().notes);
  },
  addNote: (accountId, text) => {
    const clean = text.trim().replace(/\s+/g, ' ').slice(0, 280);
    if (!clean || get().notes.some((n) => n.accountId === accountId && n.text === clean)) return;
    const mine = get().notes.filter((n) => n.accountId === accountId);
    const note = { id: newId('note'), accountId, text: clean, createdAt: new Date().toISOString() };
    const notes = [note, ...mine].slice(0, MAX_NOTES_PER_ACCOUNT).concat(get().notes.filter((n) => n.accountId !== accountId));
    set({ notes });
    persist(get().chats, notes);
  },
  deleteNote: (id) => {
    const notes = get().notes.filter((n) => n.id !== id);
    set({ notes });
    persist(get().chats, notes);
  },
}));

export const newChatId = () => newId('chat');

/** The line worth keeping from an answer: its "Do this next", else its first sentence. */
export function takeaway(answer: string): string {
  const next = /##\s*Do this next\s*\n+([\s\S]*?)(?:\n##|\s*$)/i.exec(answer)?.[1];
  const text = (next ?? answer).replace(/[#*_`>]/g, '').replace(/^\s*[-•]\s*/gm, '').trim();
  const first = /^(.+?[.!?])(\s|$)/.exec(text)?.[1] ?? text;
  return (next ? text : first).replace(/\s+/g, ' ').slice(0, 280);
}
