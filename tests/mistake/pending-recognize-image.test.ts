import { describe, expect, it, vi } from 'vitest';

import {
  buildPendingRecognizeImageUrl,
  loadPendingRecognizeImage,
  cleanupPendingRecognizeImage,
} from '@/lib/mistake/ui/pending-recognize-image';

describe('buildPendingRecognizeImageUrl', () => {
  it('falls back to base64 when IndexedDB is not available', async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'math.png', {
      type: 'image/png',
    });

    const imageUrl = await buildPendingRecognizeImageUrl(file);

    // In test environment without IndexedDB, should fallback to base64
    expect(imageUrl.startsWith('data:image/png;base64,')).toBe(true);
  });
});

describe('loadPendingRecognizeImage', () => {
  it('returns original URL for non-storage keys (data URLs)', async () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const result = await loadPendingRecognizeImage(dataUrl);
    expect(result).toBe(dataUrl);
  });

  it('returns original URL for external URLs', async () => {
    const externalUrl = 'https://example.com/image.png';
    const result = await loadPendingRecognizeImage(externalUrl);
    expect(result).toBe(externalUrl);
  });

  it('returns null for missing IndexedDB storage key', async () => {
    const storageKey = 'pending_recognize_img_test123';
    const result = await loadPendingRecognizeImage(storageKey);
    // In test environment without IndexedDB, returns null
    expect(result).toBeNull();
  });
});

describe('cleanupPendingRecognizeImage', () => {
  it('does not throw for non-storage keys', async () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    await expect(cleanupPendingRecognizeImage(dataUrl)).resolves.not.toThrow();
  });
});
