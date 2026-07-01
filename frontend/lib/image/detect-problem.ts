// Client-side detection of the most "complete" problem region in a captured
// math-problem image. Used to pre-fill the crop box so the user only has
// to confirm or fine-tune — not redraw the box from scratch.
//
// Pipeline (OpenCV):
//   1. Grayscale + Gaussian blur (denoise)
//   2. Canny edge detection
//   3. External contour retrieval
//   4. Polygon approximation; keep those with exactly 4 vertices
//   5. Filter by area + aspect ratio (math problems are wide rectangles)
//   6. Score by area * edge_density
//   7. Return the best bounding box (in original image coordinates)
//
// Returns null on any failure (no OpenCV, no candidates, timeout, throw) so
// the caller can fall back to a centered default crop.

import type * as OpenCVNamespace from '@techstark/opencv-js';

export type CropBox = { x: number; y: number; width: number; height: number };

// We type OpenCV values as the imported namespace's "any" because the
// library exposes Mat/MatVector as runtime classes; using the runtime
// type for the param signature keeps the call sites clean.
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
  minAreaFraction?: number; // 0..1, ignore candidates smaller than this fraction of image area
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
  const { timeoutMs = 1500, minAreaFraction = 0.05 } = options;

  if (!img.naturalWidth || !img.naturalHeight) return null;

  const cv = await Promise.race([
    loadOpenCV(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
  if (!cv) return null;

  // Run detection on a separate "thread" via setTimeout to avoid blocking UI.
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const result = runDetection(cv, img, minAreaFraction);
        resolve(result);
      } catch {
        resolve(null);
      }
    }, 0);
  });
}

function runDetection(
  cv: OpenCVValue,
  img: HTMLImageElement,
  minAreaFraction: number,
): CropBox | null {
  const mat = cv.imread(img);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edged = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edged, 50, 150);
    cv.findContours(edged, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const imageArea = img.naturalWidth * img.naturalHeight;
    const minArea = imageArea * minAreaFraction;
    const candidates: Candidate[] = [];

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * peri, true);

      if (approx.rows === 4) {
        const rect = cv.boundingRect(approx);
        const area = rect.width * rect.height;
        const aspect = rect.width / Math.max(1, rect.height);
        if (area > minArea && aspect >= 0.3 && aspect <= 3.5) {
          const density = countEdgesInside(cv, edged, rect);
          candidates.push({ rect, area, density, score: area * density });
        }
      }
      approx.delete();
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.rect ?? null;
  } finally {
    mat.delete();
    gray.delete();
    blurred.delete();
    edged.delete();
    contours.delete();
    hierarchy.delete();
  }
}

function countEdgesInside(
  cv: OpenCVValue,
  edged: OpenCVValue,
  rect: CropBox,
): number {
  // Approximate edge density by sampling the edge map inside the rect.
  // Canny produces a binary image (0 or 255), so we count nonzero pixels.
  const roi = edged.roi(
    new cv.Rect(Math.max(0, rect.x), Math.max(0, rect.y), rect.width, rect.height),
  );
  const nonzero = cv.countNonZero(roi);
  roi.delete();
  return nonzero;
}
