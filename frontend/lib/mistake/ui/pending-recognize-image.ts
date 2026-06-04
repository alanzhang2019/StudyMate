import { db } from '@/lib/utils/database';
import { nanoid } from 'nanoid';
import { createLogger } from '@/lib/logger';

const log = createLogger('PendingRecognizeImage');

const STORAGE_KEY_PREFIX = 'pending_recognize_img_';

/**
 * Store image blob in IndexedDB and return a storage key.
 * This avoids sessionStorage 5MB limit on mobile devices.
 */
export async function buildPendingRecognizeImageUrl(file: Blob): Promise<string> {
  const storageKey = `${STORAGE_KEY_PREFIX}${nanoid(10)}`;
  const mimeType = file.type || 'application/octet-stream';

  try {
    await db.imageFiles.put({
      id: storageKey,
      blob: file,
      filename: 'pending-recognize-image',
      mimeType,
      size: file.size,
      createdAt: Date.now(),
    });
    log.info(`Stored pending recognize image: ${storageKey}, size: ${file.size}`);
    return storageKey;
  } catch (error) {
    log.error('Failed to store image in IndexedDB, falling back to base64:', error);
    // Fallback to base64 if IndexedDB fails
    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = bytesToBase64(bytes);
    return `data:${mimeType};base64,${base64}`;
  }
}

/**
 * Load image from IndexedDB by storage key.
 * Returns base64 data URL for display.
 */
export async function loadPendingRecognizeImage(storageKey: string): Promise<string | null> {
  if (!storageKey.startsWith(STORAGE_KEY_PREFIX)) {
    // It's already a data URL or external URL
    return storageKey;
  }

  try {
    const record = await db.imageFiles.get(storageKey);
    if (!record) {
      log.warn(`Pending recognize image not found: ${storageKey}`);
      return null;
    }
    return blobToBase64(record.blob);
  } catch (error) {
    log.error(`Failed to load pending recognize image ${storageKey}:`, error);
    return null;
  }
}

/**
 * Clean up stored pending recognize image
 */
export async function cleanupPendingRecognizeImage(storageKey: string): Promise<void> {
  if (!storageKey.startsWith(STORAGE_KEY_PREFIX)) {
    return;
  }

  try {
    await db.imageFiles.delete(storageKey);
    log.info(`Cleaned up pending recognize image: ${storageKey}`);
  } catch (error) {
    log.error(`Failed to cleanup pending recognize image ${storageKey}:`, error);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
