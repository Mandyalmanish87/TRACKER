/**
 * Student Tracker — Private Progress Photo Storage (IndexedDB)
 * Document ID: FITNESS-M04-BODY-TRACKING
 *
 * Local-First Binary Blob Storage:
 * - Stores full-resolution images in IndexedDB ('tracker_photo_vault')
 * - Never inflates localStorage quotas
 * - Canvas-based WebP compression (< 1600px)
 * - Safe fallback for non-IndexedDB environments (SSR / test mocks)
 */

const DB_NAME = 'tracker_fitness_vault_db';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

// In-memory fallback map for test environments where indexedDB might be unpolyfilled
const memoryStore = new Map<string, Blob>();

function openPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open photo IndexedDB.'));
  });
}

/**
 * Compresses an image File or Blob using HTML5 Canvas to WebP.
 * Clamps maximum dimension to 1600px and returns compressed Blob.
 */
export async function compressImageToWebP(
  sourceBlob: Blob,
  maxDimension: number = 1600,
  quality: number = 0.85
): Promise<{ compressedBlob: Blob; thumbnailDataUrl: string }> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { compressedBlob: sourceBlob, thumbnailDataUrl: '' };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(sourceBlob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ compressedBlob: sourceBlob, thumbnailDataUrl: '' });
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Create low-res thumbnail data URL for fast gallery loading
      const thumbCanvas = document.createElement('canvas');
      const thumbScale = Math.min(1, 160 / Math.max(width, height));
      thumbCanvas.width = Math.max(1, Math.round(width * thumbScale));
      thumbCanvas.height = Math.max(1, Math.round(height * thumbScale));
      const thumbCtx = thumbCanvas.getContext('2d');
      if (thumbCtx) {
        thumbCtx.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
      }
      const thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.6);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ compressedBlob: blob, thumbnailDataUrl });
          } else {
            resolve({ compressedBlob: sourceBlob, thumbnailDataUrl });
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}

/**
 * Stores a photo binary Blob locally in IndexedDB.
 */
export async function storePhotoLocally(photoId: string, blob: Blob): Promise<void> {
  try {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ id: photoId, blob, updatedAt: new Date().toISOString() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback to in-memory store
    memoryStore.set(photoId, blob);
  }
}

/**
 * Retrieves a photo Blob from IndexedDB and returns a temporary browser Object URL.
 */
export async function retrievePhotoLocally(photoId: string): Promise<string | null> {
  try {
    const db = await openPhotoDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(photoId);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          const url = URL.createObjectURL(req.result.blob);
          resolve(url);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    const blob = memoryStore.get(photoId);
    return blob ? URL.createObjectURL(blob) : null;
  }
}

/**
 * Deletes a photo Blob from IndexedDB.
 */
export async function deletePhotoLocally(photoId: string): Promise<void> {
  try {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(photoId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryStore.delete(photoId);
  }
}

export const compressImageFile = compressImageToWebP;
export const storePhotoBlob = storePhotoLocally;
export const deletePhotoBlob = deletePhotoLocally;

export async function getPhotoBlob(photoId: string): Promise<Blob | null> {
  try {
    const db = await openPhotoDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(photoId);
      req.onsuccess = () => resolve(req.result?.blob || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return memoryStore.get(photoId) || null;
  }
}

