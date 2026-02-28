// IndexedDB utility for storing large data (screenshots, etc.)
// Provides 50MB+ storage vs localStorage's 5MB limit

const DB_NAME = 'TradePilotDB';
const DB_VERSION = 1;
const IMAGES_STORE = 'images';

interface StoredImage {
  id: string;
  dateKey: string; // YYYY-MM-DD
  dataUrl: string;
  caption?: string;
  addedAt: string;
}

let dbInstance: IDBDatabase | null = null;

// Initialize the database
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
      
      // Create images store if it doesn't exist
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        const store = db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
        store.createIndex('dateKey', 'dateKey', { unique: false });
      }
    };
  });
}

// Save an image to IndexedDB
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

// Get all images for a specific date
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

// Get a single image by ID
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

// Delete an image
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

// Get all images (for backup)
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

// Import images from backup
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

// Clear all images
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

// Get storage estimate
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
      // Fallback
    }
  }
  
  // Fallback: estimate based on localStorage
  let localStorageSize = 0;
  for (const key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      localStorageSize += (localStorage.getItem(key)?.length || 0) * 2; // UTF-16
    }
  }
  
  return {
    used: localStorageSize,
    quota: 50 * 1024 * 1024, // Assume 50MB available
    percentage: (localStorageSize / (50 * 1024 * 1024)) * 100
  };
}
