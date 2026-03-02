// IndexedDB utility for TradePilot
// Provides 50MB+ storage vs localStorage's 5MB limit
// Used for: accounts/trades, journal notes (with images), and images
//
// SAFETY DESIGN:
//   - IndexedDB is the PRIMARY store (large capacity)
//   - localStorage is a PERMANENT BACKUP MIRROR (always kept in sync)
//   - We NEVER delete from localStorage — it is always there as a fallback
//   - On load: try IDB first, fall back to localStorage if IDB fails/empty

const DB_NAME = 'TradePilotDB';
const DB_VERSION = 3;

// Object store names
const IMAGES_STORE = 'images';
const ACCOUNTS_STORE = 'accounts';
const NOTES_STORE = 'notes';

export interface StoredImage {
  id: string;
  dateKey: string; // YYYY-MM-DD
  dataUrl: string;
  caption?: string;
  addedAt: string;
}

let dbInstance: IDBDatabase | null = null;

// ─── DB Init ──────────────────────────────────────────────────────────────────

export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Images store (v1)
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        const store = db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
        store.createIndex('dateKey', 'dateKey', { unique: false });
      }

      // Accounts store (v2)
      if (!db.objectStoreNames.contains(ACCOUNTS_STORE)) {
        db.createObjectStore(ACCOUNTS_STORE, { keyPath: 'key' });
      }

      // Notes store (v3)
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        const notesStore = db.createObjectStore(NOTES_STORE, { keyPath: 'key' });
        notesStore.createIndex('date', 'date', { unique: false });
      }
    };
  });
}

// ─── Generic key-value helpers ────────────────────────────────────────────────

export async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet<T>(storeName: string, key: string, value: T): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetAll<T>(storeName: string): Promise<Array<{ key: string; value: T }>> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ─── Accounts store ───────────────────────────────────────────────────────────

const ACCOUNTS_KEY = 'tradepilot_accounts';
const SELECTED_KEY = 'tradepilot_selected_account';

/**
 * Save accounts to BOTH IndexedDB (primary) AND localStorage (permanent backup).
 * Never rely on only one location.
 */
export async function saveAccountsToIDB(accounts: unknown[]): Promise<void> {
  // Always write localStorage backup first (sync, never fails silently)
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (lsErr) {
    console.warn('localStorage backup write failed (quota?):', lsErr);
  }

  // Then write to IDB (async, primary)
  try {
    await idbSet(ACCOUNTS_STORE, ACCOUNTS_KEY, accounts);
  } catch (e) {
    console.error('IDB save failed — localStorage backup is still intact:', e);
  }
}

/**
 * Load accounts — tries IDB first, falls back to localStorage.
 * NEVER deletes from localStorage.
 */
export async function loadAccountsFromIDB(): Promise<unknown[] | null> {
  // Try IDB first
  try {
    const data = await idbGet<unknown[]>(ACCOUNTS_STORE, ACCOUNTS_KEY);
    if (data && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (e) {
    console.warn('IDB load failed, falling back to localStorage:', e);
  }

  // Fall back to localStorage (permanent backup — never deleted)
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Silently re-sync back to IDB (repair)
        idbSet(ACCOUNTS_STORE, ACCOUNTS_KEY, parsed).catch(() => { });
        return parsed;
      }
    }
  } catch { }

  return null;
}

export function saveSelectedAccountId(id: string | null): void {
  try {
    if (id) localStorage.setItem(SELECTED_KEY, id);
    else localStorage.removeItem(SELECTED_KEY);
  } catch { }
}

export function loadSelectedAccountId(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

// ─── Notes store ──────────────────────────────────────────────────────────────

const NOTES_LS_KEY = 'tradepilot-daily-notes';

/**
 * Save notes to BOTH IDB (primary) AND localStorage (permanent backup).
 */
export async function saveNotesToIDB(notes: Record<string, unknown>): Promise<void> {
  // localStorage backup first
  try {
    localStorage.setItem(NOTES_LS_KEY, JSON.stringify(notes));
  } catch (lsErr) {
    console.warn('localStorage notes backup write failed:', lsErr);
  }

  // IDB primary
  try {
    await idbSet(NOTES_STORE, NOTES_LS_KEY, notes);
  } catch (e) {
    console.error('IDB notes save failed — localStorage backup is intact:', e);
  }
}

/**
 * Load notes — tries IDB first, falls back to localStorage.
 * NEVER deletes from localStorage.
 */
export async function loadNotesFromIDB(): Promise<Record<string, unknown>> {
  try {
    const data = await idbGet<Record<string, unknown>>(NOTES_STORE, NOTES_LS_KEY);
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      return data;
    }
  } catch (e) {
    console.warn('IDB notes load failed, falling back to localStorage:', e);
  }

  // Fallback to localStorage (permanent backup)
  try {
    const raw = localStorage.getItem(NOTES_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (Object.keys(parsed).length > 0) {
        // Silently re-sync to IDB
        idbSet(NOTES_STORE, NOTES_LS_KEY, parsed).catch(() => { });
        return parsed;
      }
    }
  } catch { }

  return {};
}

// ─── Images store ─────────────────────────────────────────────────────────────

export async function saveImage(image: StoredImage): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([IMAGES_STORE], 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);
    const request = store.put(image);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getImagesByDate(dateKey: string): Promise<StoredImage[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([IMAGES_STORE], 'readonly');
    const store = transaction.objectStore(IMAGES_STORE);
    const index = store.index('dateKey');
    const request = index.getAll(dateKey);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getImage(id: string): Promise<StoredImage | undefined> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([IMAGES_STORE], 'readonly');
    const store = transaction.objectStore(IMAGES_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteImage(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([IMAGES_STORE], 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllImages(): Promise<StoredImage[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([IMAGES_STORE], 'readonly');
    const store = transaction.objectStore(IMAGES_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function importImages(images: StoredImage[]): Promise<number> {
  const db = await initDB();
  let imported = 0;
  for (const image of images) {
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([IMAGES_STORE], 'readwrite');
        const store = transaction.objectStore(IMAGES_STORE);
        const request = store.put(image);
        request.onsuccess = () => { imported++; resolve(); };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to import image:', image.id, error);
    }
  }
  return imported;
}

export async function clearAllImages(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([IMAGES_STORE], 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ─── Storage estimate ─────────────────────────────────────────────────────────

export async function getStorageEstimate(): Promise<{ used: number; quota: number; percentage: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      return {
        used,
        quota,
        percentage: quota > 0 ? (used / quota) * 100 : 0
      };
    } catch {
      // fallthrough
    }
  }
  // Fallback: estimate based on localStorage only
  let localStorageSize = 0;
  for (const key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      localStorageSize += (localStorage.getItem(key)?.length || 0) * 2;
    }
  }
  return {
    used: localStorageSize,
    quota: 1024 * 1024 * 1024,
    percentage: (localStorageSize / (1024 * 1024 * 1024)) * 100
  };
}
