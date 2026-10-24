import { afterAll, describe, expect, test } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

import {
  persistInlineClassroomImages,
  readImageDimensions,
} from '@/lib/server/classroom-media-generation';
import { CLASSROOMS_DIR } from '@/lib/server/classroom-storage';

/**
 * Covers the "student uploaded a photo of the original problem" path: the
 * mistake-lesson route hands raw base64 to generateClassroom(), which now
 * persists it so slides can reference it as a real source image.
 *
 * The two invariants that matter and would otherwise fail silently:
 *   1. `imageMapping` is populated — without it `resolveImageIds()` *drops*
 *      the image element instead of rendering it.
 *   2. `visionImages` carries inline data URLs, not the serving URL — the LLM
 *      provider cannot fetch this server's own media route.
 */

// Real directory layout, unique per run, removed afterwards. We deliberately
// don't mock CLASSROOMS_DIR so the id/path composition is exercised for real.
const TEST_CLASSROOM_ID = `test-uploaded-${process.pid}-${Date.now()}`;

afterAll(async () => {
  await fs.rm(path.join(CLASSROOMS_DIR, TEST_CLASSROOM_ID), { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Minimal header-only fixtures
// ---------------------------------------------------------------------------

function pngBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(26);
  buf.writeUInt32BE(0x89504e47, 0); // PNG magic
  buf.writeUInt32BE(0x0d0a1a0a, 4);
  buf.writeUInt32BE(13, 8); // IHDR chunk length
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function gifBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(14);
  buf.write('GIF89a', 0, 'ascii');
  buf.writeUInt16LE(width, 6);
  buf.writeUInt16LE(height, 8);
  return buf;
}

function jpegBuffer(width: number, height: number): Buffer {
  const u16be = (value: number) => {
    const b = Buffer.alloc(2);
    b.writeUInt16BE(value);
    return b;
  };
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]), // SOI
    Buffer.from([0xff, 0xe0, 0x00, 0x10]), // APP0 marker + length 16
    Buffer.from('JFIF\0', 'latin1'), // 5 bytes
    Buffer.from([0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]), // 9 bytes → 14 payload
    Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08]), // SOF0 + length 17 + precision
    u16be(height),
    u16be(width),
    Buffer.from([0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]),
  ]);
}

function webpVp8xBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(32);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(24, 4);
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8X', 12, 'ascii');
  buf.writeUInt32LE(10, 16);
  buf.writeUInt8(0, 20); // flags byte
  buf.writeUIntLE(width - 1, 24, 3);
  buf.writeUIntLE(height - 1, 27, 3);
  return buf;
}

// ---------------------------------------------------------------------------
// readImageDimensions
// ---------------------------------------------------------------------------

describe('readImageDimensions', () => {
  test('reads PNG IHDR', () => {
    expect(readImageDimensions(pngBuffer(1200, 1600))).toEqual({ width: 1200, height: 1600 });
  });

  test('reads GIF logical screen descriptor', () => {
    expect(readImageDimensions(gifBuffer(640, 480))).toEqual({ width: 640, height: 480 });
  });

  test('walks JPEG markers to the SOF0 frame header', () => {
    expect(readImageDimensions(jpegBuffer(1600, 1200))).toEqual({ width: 1600, height: 1200 });
  });

  test('reads WebP VP8X canvas size', () => {
    expect(readImageDimensions(webpVp8xBuffer(800, 600))).toEqual({ width: 800, height: 600 });
  });

  test('returns undefined for an unrecognised or truncated buffer', () => {
    expect(readImageDimensions(Buffer.from('not an image at all'))).toBeUndefined();
    expect(readImageDimensions(Buffer.alloc(0))).toBeUndefined();
    // PNG magic but cut off before IHDR completes.
    expect(readImageDimensions(pngBuffer(10, 10).subarray(0, 12))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// persistInlineClassroomImages
// ---------------------------------------------------------------------------

describe('persistInlineClassroomImages', () => {
  test('returns empty results when nothing was uploaded', async () => {
    const result = await persistInlineClassroomImages([], TEST_CLASSROOM_ID, 'http://localhost:3001');

    expect(result.pdfImages).toEqual([]);
    expect(result.imageMapping).toEqual({});
    expect(result.visionImages).toEqual([]);
  });

  test('writes the bytes to disk and maps img_N to a serving URL', async () => {
    const png = pngBuffer(1200, 1600);

    const result = await persistInlineClassroomImages(
      [{ mimeType: 'image/png', base64: png.toString('base64') }],
      TEST_CLASSROOM_ID,
      'http://localhost:3001',
    );

    expect(result.pdfImages).toHaveLength(1);

    const [image] = result.pdfImages;
    expect(image.id).toBe('img_1');
    // `img_N` specifically: `isImageIdReference()` only treats that shape as a
    // resolvable id, and the slide prompt's examples are all `img_N`.
    expect(image.src).toBe(
      `http://localhost:3001/api/classroom-media/${TEST_CLASSROOM_ID}/media/img_1.png`,
    );
    expect(image.width).toBe(1200);
    expect(image.height).toBe(1600);
    expect(image.origin).toBeTruthy();

    // The mapping is what stops resolveImageIds() from dropping the element.
    expect(result.imageMapping).toEqual({ img_1: image.src });

    const onDisk = await fs.readFile(path.join(CLASSROOMS_DIR, TEST_CLASSROOM_ID, 'media', 'img_1.png'));
    expect(onDisk.equals(png)).toBe(true);
  });

  test('gives vision inline data URLs while scenes get serving URLs', async () => {
    const jpeg = jpegBuffer(1600, 1200);

    const result = await persistInlineClassroomImages(
      [{ mimeType: 'image/jpeg', base64: jpeg.toString('base64') }],
      TEST_CLASSROOM_ID,
      'http://localhost:3001',
    );

    const [vision] = result.visionImages;
    // Provider must be able to read the bytes; it can't reach our own route.
    expect(vision.src.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(vision.src).not.toBe(result.pdfImages[0].src);
    // Same id in both views so suggestedImageIds line up with the mapping.
    expect(vision.id).toBe(result.pdfImages[0].id);
    expect(result.pdfImages[0].src.endsWith('/media/img_1.jpg')).toBe(true);
  });

  test('derives the file extension from the mime type and numbers images in order', async () => {
    const result = await persistInlineClassroomImages(
      [
        { mimeType: 'image/webp', base64: webpVp8xBuffer(800, 600).toString('base64') },
        { mimeType: 'image/gif', base64: gifBuffer(640, 480).toString('base64') },
      ],
      TEST_CLASSROOM_ID,
      'http://localhost:3001',
    );

    expect(result.pdfImages.map((img) => img.id)).toEqual(['img_1', 'img_2']);
    expect(result.pdfImages[0].src.endsWith('/media/img_1.webp')).toBe(true);
    expect(result.pdfImages[1].src.endsWith('/media/img_2.gif')).toBe(true);
  });

  test('skips images that decode to zero bytes instead of failing the batch', async () => {
    const result = await persistInlineClassroomImages(
      [
        { mimeType: 'image/png', base64: '' },
        { mimeType: 'image/png', base64: pngBuffer(100, 100).toString('base64') },
      ],
      TEST_CLASSROOM_ID,
      'http://localhost:3001',
    );

    expect(result.pdfImages).toHaveLength(1);
    expect(result.pdfImages[0].src.endsWith('/media/img_2.png')).toBe(true);
  });
});
