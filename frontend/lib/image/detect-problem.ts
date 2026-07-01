// Client-side detection of the most "complete" problem region in a captured
// math-problem image. Used to pre-fill the crop box so the user only has
// to confirm or fine-tune — not redraw the box from scratch.
//
// Pipeline (OpenCV):
//   1. Grayscale + Gaussian blur (denoise)
//   2. Canny edge detection
//   3. External contour retrieval
//   4. For each contour, compute bounding rect. We DON'T require 4 vertices
//      (real phone photos have irregular edges; approxPolyDP rarely returns
//      exactly 4). Just use cv.boundingRect.
//   5. Filter by area (must be at least 15% of image area) and aspect ratio
//   6. Score = area * (1 + edge_density)
//      Edge density biases toward text-heavy regions (denser edges = more
//      text/equations inside).
//   7. Apply 5% padding around the chosen rect (gives OpenCV a safety
//      margin so it doesn't crop characters at the edge)
//   8. Return the best rect in original image coordinates
//
// Returns null on any failure so the caller can fall back to a centered
// default crop.

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
  paddingFraction?: number; // 0..0.3, padding around the chosen rect
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
  // mount, so by the time a photo is taken the module is already loaded.
  // The timebox here is for the algorithm itself, not the wasm load.
  // minAreaFraction default lowered to 5% so a single small problem on a
  // desk still gets detected. 15% was filtering out typical phone shots
  // where the problem occupies only part of the frame.
  const { timeoutMs = 3000, minAreaFraction = 0.05, paddingFraction = 0.05 } = options;

  if (!img.naturalWidth || !img.naturalHeight) return null;

  let cv;
  try {
    cv = await loadOpenCV();
  } catch (err) {
    console.warn('[detect-problem] failed to load OpenCV:', err);
    return null;
  }

  // Run detection on a separate "tick" via setTimeout to avoid blocking UI,
  // and race against the timeout to keep the UI responsive.
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

    // Iterate over all contours (no 4-vertex requirement — use bounding rect).
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const rect = cv.boundingRect(contour);
      const area = rect.width * rect.height;
      if (area < minArea) continue;

      const aspect = rect.width / Math.max(1, rect.height);
      // Math problems are typically wider than tall, but allow some
      // flexibility (portrait problems exist too).
      if (aspect < 0.25 || aspect > 4.0) continue;

      const density = countEdgesInside(cv, edged, rect);
      // Score combines area (preferring larger regions) with edge density
      // (preferring content-rich regions). +1 keeps low-density candidates
      // from getting a zero score.
      const score = area * (1 + density / 1000);

      candidates.push({ rect, area, density, score });
    }

    if (candidates.length === 0) {
      console.warn(
        `[detect-problem] no candidates (min area = ${minArea}px², found ${contours.size()} contours)`,
      );
      return null;
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    console.log(
      `[detect-problem] found ${candidates.length} candidates, best area=${best.area}px² density=${best.density}`,
    );

    return padCropBox(best.rect, img.naturalWidth, img.naturalHeight, paddingFraction);
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
  const safeRect = {
    x: Math.max(0, Math.floor(rect.x)),
    y: Math.max(0, Math.floor(rect.y)),
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
  };
  try {
    const roi = edged.roi(new cv.Rect(safeRect.x, safeRect.y, safeRect.width, safeRect.height));
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
