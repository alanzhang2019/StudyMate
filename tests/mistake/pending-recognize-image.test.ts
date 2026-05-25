import { describe, expect, it } from 'vitest';

import { buildPendingRecognizeImageUrl } from '@/lib/mistake/ui/pending-recognize-image';

describe('buildPendingRecognizeImageUrl', () => {
  it('creates a persistent data url for recognize-page previews', async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'math.png', {
      type: 'image/png',
    });

    const imageUrl = await buildPendingRecognizeImageUrl(file);

    expect(imageUrl).toBe('data:image/png;base64,iVBORw==');
    expect(imageUrl.startsWith('blob:')).toBe(false);
  });
});
