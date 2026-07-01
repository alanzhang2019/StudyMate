// Client-side detection of the most "complete" problem region in a captured
// math-problem image. Used to pre-fill the crop box so the user only has
// to confirm or fine-tune — not redraw the box from scratch.
//
// Algorithm (DBNet → edge-based fallback):
//   1. DBNet (chineseocr_lite's dbnet.onnx via OpenCV.js DNN).
//      A learned text detector that explicitly models text regions, so it
//      handles photos of homework with hands/devices/backgrounds much
//      better than pure edge detection. Returns the bounding box of the
//      largest grouped text region (multi-line problems are favored over
//      isolated fragments like headers or page numbers).
//   2. Edge-based fallback. Adaptive threshold + Canny density scoring.
//      Used when DBNet is unavailable (slow connection, no model, etc.).
//   3. Pad the final box with 5% breathing margin and clip to image bounds.

import type * as OpenCVNamespace from '@techstark/opencv-js';
import { detectTextRegion, prewarmDBNet } from './detect-text-regions';

export type CropBox = { x: number; y: number; width: number; height: number };

// Re-export so callers (e.g. /mistake page) can pre-warm the DBNet model on
// mount in a single import.
export { prewarmDBNet };

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
  const { timeoutMs = 6000, minAreaFraction = 0.04, paddingFraction = 0.1 } = options;

  if (!img.naturalWidth || !img.naturalHeight) return null;

  // 1. DBNet (preferred). Returns the bounding box of the largest grouped
  //    text region. Timebox is generous because the first call also loads
  //    the 3.6MB ONNX model. Subsequent calls reuse the cached model and
  //    usually finish in <500ms.
  try {
    const dbnetBox = await detectTextRegion(img, timeoutMs);
    if (dbnetBox) {
      console.log('[detect-problem] using DBNet result');
      return padCropBox(dbnetBox, img.naturalWidth, img.naturalHeight, paddingFraction);
    }
    console.warn('[detect-problem] DBNet returned null, falling back to edge-based');
  } catch (err) {
    console.warn('[detect-problem] DBNet failed, falling back to edge-based:', err);
  }

  // 2. Edge-based fallback. Faster (~100-500ms) but less accurate on
  //    photos with hands/devices/backgrounds. Also serve as a graceful
  //    degradation path if the ONNX model is blocked or fails to load.
  let cv;
  try {
    cv = await loadOpenCV();
  } catch (err) {
    console.warn('[detect-problem] failed to load OpenCV:', err);
    return null;
  }

  const fallbackTimeout = Math.min(3000, timeoutMs);
  return Promise.race([
    new Promise<CropBox | null>((resolve) => {
      setTimeout(() => {
        try {
          const result = runEdgeDetection(cv, img, minAreaFraction, paddingFraction);
          resolve(result);
        } catch (err) {
          console.warn('[detect-problem] edge-based detection failed:', err);
          resolve(null);
        }
      }, 0);
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), fallbackTimeout)),
  ]);
}

function runEdgeDetection(
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
  // OpenCV kernel: cv.Mat.ones(rows, cols) → a kernel of `rows` height
  // and `cols` width. We use a TALL × narrow kernel (60 rows × 1 col)
  // so it merges all foreground pixels within 60px vertically — this
  // connects consecutive lines of a problem (typical 30-60px line
  // spacing) into a single contour per problem, while gaps > 60px
  // (between problems or near solid objects) remain separate.
  //
  // Edge density (from Canny) is what differentiates text contours
  // (high density, many internal edges) from solid object contours
  // (low density, only outer outline).
  const kernel = cv.Mat.ones(60, 1, cv.CV_8U);

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
    const imageH = img.naturalHeight;

    // 7. Collect per-line rects (each line of text is a separate contour)
    const lineRects: CropBox[] = [];
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const rect = cv.boundingRect(contour);
      const area = rect.width * rect.height;
      if (area < minArea) continue;
      // Skip very thin / very wide strips (likely artifacts of the kernel)
      const aspect = rect.width / Math.max(1, rect.height);
      if (aspect < 0.3) continue;
      lineRects.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    }

    if (lineRects.length === 0) {
      console.warn(`[detect-problem] no line rects. ${contours.size()} contours, min area = ${minArea}px²`);
      return null;
    }

    // 8. Sort by y, then group by vertical gap.
    //    Lines that are close together (gap < groupGap) belong to the
    //    same problem; a larger gap means a new problem starts.
    //    The gap is relative to image height so the same threshold works
    //    across different photo resolutions.
    lineRects.sort((a, b) => a.y - b.y);
    // Generous gap: ~8% of image height (96px for 1200px photo). This
    // covers typical line spacing within a multi-line problem AND the
    // visual distance between a section header and the equation below,
    // even when the equation has tall fraction glyphs. Gaps larger than
    // this indicate a new problem (or a section header that's farther
    // away from the problem block than usual).
    const groupGap = Math.max(60, imageH * 0.08);
    const groups: CropBox[][] = [];
    let current: CropBox[] = [lineRects[0]];
    for (let i = 1; i < lineRects.length; i++) {
      const prev = current[current.length - 1];
      const curr = lineRects[i];
      const gap = curr.y - (prev.y + prev.height);
      if (gap < groupGap) {
        current.push(curr);
      } else {
        groups.push(current);
        current = [curr];
      }
    }
    groups.push(current);

    // 9. For each group, compute the bounding rect + score.
    //    Score = line_count × density² × area.
    //    The line_count factor favors groups with MORE lines (i.e. a
    //    complete multi-line problem) over groups with just 1-2 lines
    //    (which might be a fragment like "下午孵出 107 只" or a section
    //    header). A complete problem is more useful to crop.
    type ScoredGroup = {
      group: CropBox[];
      rect: CropBox;
      area: number;
      density: number;
      lineCount: number;
      score: number;
    };
    const candidates: ScoredGroup[] = groups.map((group) => {
      const x = Math.min(...group.map((r) => r.x));
      const y = Math.min(...group.map((r) => r.y));
      const right = Math.max(...group.map((r) => r.x + r.width));
      const bottom = Math.max(...group.map((r) => r.y + r.height));
      const rect: CropBox = { x, y, width: right - x, height: bottom - y };
      const density = countNonZeroInRect(cv, edges, rect);
      const area = rect.width * rect.height;
      const lineCount = group.length;
      return {
        group,
        rect,
        area,
        density,
        lineCount,
        score: lineCount * density * density * area,
      };
    });

    if (candidates.length === 0) {
      console.warn('[detect-problem] no grouped candidates');
      return null;
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    console.log(
      `[detect-problem] ${lineRects.length} lines, ${groups.length} problem(s), ` +
        `best = ${best.lineCount} lines area=${best.area}px² ` +
        `(${best.rect.width}×${best.rect.height}) density=${best.density}`,
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
