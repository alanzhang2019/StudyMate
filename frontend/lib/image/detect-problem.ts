// Client-side detection of the most "complete" problem region in a captured
// math-problem image. Used to pre-fill the crop box so the user only has
// to confirm or fine-tune — not redraw the box from scratch.
//
// Algorithm (OpenCV):
//   1. Grayscale + median blur (handles noisy phone photos well)
//   2. Adaptive threshold (handles uneven lighting from flash/shadow)
//   3. Morphological DILATE with a wide horizontal kernel — connects
//      characters in the same line into a single horizontal block.
//      This is the key step: it makes problem rows become single
//      rectangles while smooth areas (hands, devices, blank space)
//      stay as sparse or unconnected regions.
//   4. findContours on the dilated binary image
//   5. Filter candidates by area (min 4% of image) and aspect ratio
//   6. For each candidate, count edges in the ORIGINAL grayscale inside
//      its bounding rect — this gives the "edge density" score
//   7. Score = density² × area  (favors dense text regions over large
//      smooth areas like hands or page backgrounds)
//   8. Return the best rect with 5% padding, clipped to image bounds
//
// Returns null on any failure so the caller can fall back to a centered
// default crop.

import type * as OpenCVNamespace from '@techstark/opencv-js';

export type CropBox = { x: number; y: number; width: number; height: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenCVValue = any;

let cvPromise: Promise<typeof OpenCVNamespace> | null = null;

export function loadOpenCV(): Promise<typeof OpenCVNamespace> {
  if (!cvPromise) {
    cvPromise = import('@techstark/opencv-js');
  }
  return cvPromise;
}

type DetectionOptions = {
  timeoutMs?: number;
  minAreaFraction?: number;
  paddingFraction?: number;
};

type Candidate = {
  rect: CropBox;
  area: number;
  density: number;
  score: number;
};

export async function detectProblemRegion(
  img: HTMLImageElement,
  options: DetectionOptions = {},
): Promise<CropBox | null> {
  // Detection is timeboxed generously because OpenCV is pre-warmed on page
  // mount. The timebox here is for the algorithm itself, not the wasm load.
  const { timeoutMs = 3000, minAreaFraction = 0.04, paddingFraction = 0.05 } = options;

  if (!img.naturalWidth || !img.naturalHeight) return null;

  let cv;
  try {
    cv = await loadOpenCV();
  } catch (err) {
    console.warn('[detect-problem] failed to load OpenCV:', err);
    return null;
  }

  return Promise.race([
    new Promise<CropBox | null>((resolve) => {
      setTimeout(() => {
        try {
          const result = runDetection(cv, img, minAreaFraction, paddingFraction);
          resolve(result);
        } catch (err) {
          console.warn('[detect-problem] detection failed:', err);
          resolve(null);
        }
      }, 0);
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

function runDetection(
  cv: OpenCVValue,
  img: HTMLImageElement,
  minAreaFraction: number,
  paddingFraction: number,
): CropBox | null {
  const mat = cv.imread(img);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const thresh = new cv.Mat();
  const dilated = new cv.Mat();
  // Edge map for density scoring. Text characters produce many internal
  // edges (each glyph has strokes that Canny picks up), so dense text
  // has high edge count. A solid object (phone, hand) has only its
  // outer outline as edges — few pixels.
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  // Wide+short kernel: merges characters in a line, plus a small vertical
  // extent so consecutive problem rows close together also connect.
  const kernel = cv.Mat.ones(40, 5, cv.CV_8U);

  try {
    // 1. Grayscale
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
    // 2. Median blur (preserves edges while denoising)
    cv.medianBlur(gray, blurred, 3);
    // 3. Adaptive threshold for contour finding (binary B&W)
    cv.adaptiveThreshold(
      blurred,
      thresh,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      11,
      2,
    );
    // 4. Horizontal dilate — connects characters in a row
    cv.dilate(thresh, dilated, kernel);
    // 5. Canny edges for density scoring (text has many internal edges,
    //    solid objects have only outline edges)
    cv.Canny(blurred, edges, 50, 150);
    // 6. Find external contours on the dilated threshold image
    cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const imageArea = img.naturalWidth * img.naturalHeight;
    const minArea = imageArea * minAreaFraction;
    const candidates: Candidate[] = [];

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const rect = cv.boundingRect(contour);
      const area = rect.width * rect.height;
      if (area < minArea) continue;

      // Density = Canny edge pixels inside the rect. Text has high density
      // (many strokes per character). A solid object (phone, hand) has
      // low density (only the outer outline).
      const density = countNonZeroInRect(cv, edges, rect);
      // density² × area: heavily favors text regions
      const score = density * density * area;
      candidates.push({ rect, area, density, score });
    }

    if (candidates.length === 0) {
      console.warn(
        `[detect-problem] no candidates. ${contours.size()} contours, min area = ${minArea}px²`,
      );
      return null;
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    console.log(
      `[detect-problem] ${candidates.length} candidates, best area=${best.area}px² density=${best.density}`,
    );

    return padCropBox(best.rect, img.naturalWidth, img.naturalHeight, paddingFraction);
  } finally {
    mat.delete();
    gray.delete();
    blurred.delete();
    thresh.delete();
    dilated.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
    kernel.delete();
  }
}

function countNonZeroInRect(
  cv: OpenCVValue,
  src: OpenCVValue,
  rect: CropBox,
): number {
  const safeRect = {
    x: Math.max(0, Math.floor(rect.x)),
    y: Math.max(0, Math.floor(rect.y)),
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
  };
  try {
    const roi = src.roi(new cv.Rect(safeRect.x, safeRect.y, safeRect.width, safeRect.height));
    const nonzero = cv.countNonZero(roi);
    roi.delete();
    return nonzero;
  } catch {
    return 0;
  }
}

function padCropBox(
  rect: CropBox,
  imgW: number,
  imgH: number,
  paddingFraction: number,
): CropBox {
  const padX = rect.width * paddingFraction;
  const padY = rect.height * paddingFraction;
  const x = Math.max(0, Math.floor(rect.x - padX));
  const y = Math.max(0, Math.floor(rect.y - padY));
  const right = Math.min(imgW, Math.ceil(rect.x + rect.width + padX));
  const bottom = Math.min(imgH, Math.ceil(rect.y + rect.height + padY));
  return { x, y, width: right - x, height: bottom - y };
}
