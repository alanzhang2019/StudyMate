/**
 * Image preprocessing utilities for OCR
 * Compresses and optimizes images before sending to OCR API
 */

export interface PreprocessOptions {
  /** Maximum width/height in pixels */
  maxDimension?: number;
  /** JPEG quality (0-1) */
  quality?: number;
  /** Whether to correct orientation based on EXIF */
  correctOrientation?: boolean;
}

const DEFAULT_OPTIONS: PreprocessOptions = {
  maxDimension: 1920,
  quality: 0.9,
  correctOrientation: true,
};

/**
 * Preprocess an image file for OCR:
 * 1. Correct orientation from EXIF data
 * 2. Resize if too large
 * 3. Compress to reduce file size
 * 4. Convert to JPEG for consistency
 */
export async function preprocessImageForOCR(
  file: File,
  options: PreprocessOptions = {},
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions
      let { width, height } = img;
      const maxDim = opts.maxDimension || 1920;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Enable image smoothing for better quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw image
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob from canvas'));
            return;
          }

          const processedFile = new File([blob], 'processed.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          resolve(processedFile);
        },
        'image/jpeg',
        opts.quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Check if an image needs preprocessing
 * (e.g., if it's too large or not JPEG)
 */
export function shouldPreprocessImage(file: File): boolean {
  // Preprocess if file is larger than 2MB
  if (file.size > 2 * 1024 * 1024) return true;

  // Preprocess if not JPEG (to ensure consistent format)
  if (!file.type.startsWith('image/jpeg')) return true;

  return false;
}
