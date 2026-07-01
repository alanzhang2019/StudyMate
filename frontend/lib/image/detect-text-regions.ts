// Client-side text-region detection using a DBNet ONNX model
// (chineseocr_lite's dbnet.onnx, 1.8MB).
//
// Pipeline:
//   1. Resize image to 640x640 (model input size, dynamic H/W supported)
//   2. BGR→RGB + /255 normalize + ImageNet mean/std
//   3. Run DBNet forward via onnxruntime-web → 1×1×320×320 probability map
//   4. Threshold at 0.3 → binary text mask
//   5. Dilate vertically to capture fraction glyph descenders
//   6. Find contours in mask → per-text-region bounding boxes
//   7. Scale boxes back to original image coordinates
//   8. Group nearby boxes into "problem" blocks by vertical proximity
//   9. Return the bounding box of the largest problem block
//
// We use OpenCV.js for image preprocessing (resize, blobFromImage) and
// postprocessing (threshold, dilate, findContours, boundingRect) and
// onnxruntime-web (Microsoft's official browser ONNX runtime) for the
// inference itself. The reason for splitting these is that the
// @techstark/opencv-js WASM build does not include the DNN module
// (`cv.dnn` is undefined), so we cannot use cv.dnn.readNetFromONNX here.
// ORT is ~200KB, supports WASM/WebGL/WebGPU, and works in all browsers.
//
// Falls back to null on any error so the caller can use the previous
// edge-based algorithm as a fallback.

import type * as OpenCVNamespace from '@techstark/opencv-js';
import * as ort from 'onnxruntime-web';

export type CropBox = { x: number; y: number; width: number; height: number };

type OpenCVValue = any;
type ORTSession = ort.InferenceSession;

const MODEL_URL = '/models/dbnet.onnx';
const INPUT_SIZE = 640; // model input — dynamic but we use fixed for speed
const OUTPUT_SIZE = 320; // model output is fixed 320x320
const TEXT_THRESHOLD = 0.3;
const MIN_BOX_AREA = 200; // px² in original image coords
// Vertical gap threshold for merging nearby text regions into one "problem".
// Math content often has multiple visually-close rows: section header + equation,
// or an equation with a fraction whose numerator and denominator are read as
// separate rows. We want a generous gap so these stay in one block.
const GROUP_GAP_RATIO = 0.12; // 12% of image height
// Fraction glyphs (numerator/denominator) extend below the baseline that
// DBNet learns. We dilate the binary mask vertically by this many pixels
// (in original-image coords) before finding contours, so the resulting
// bounding rect covers the full extent of the math content.
const VERTICAL_DILATE_PX = 12;
// Build tag — printed by prewarm so a quick console glance can confirm
// whether the latest code is actually running on a given deployment.
const BUILD_TAG = 'dbnet-2026-07-01-r4';

let cvPromise: Promise<typeof OpenCVNamespace> | null = null;
let sessionPromise: Promise<ORTSession> | null = null;

export function loadOpenCV(): Promise<typeof OpenCVNamespace> {
  if (!cvPromise) cvPromise = import('@techstark/opencv-js');
  return cvPromise;
}

async function getDBNetSession(): Promise<ORTSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      // Try WebGPU first (modern Chrome/Edge), then WebGL, then WASM.
      // ORT picks the first available provider from this list. WASM is
      // universally available, so the user always gets a working session
      // even on iOS Safari or older browsers.
      const session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      return session;
    })();
  }
  return sessionPromise;
}

export async function prewarmDBNet(): Promise<void> {
  try {
    console.log(`[detect-text] prewarm [${BUILD_TAG}]: loading ORT session…`);
    const session = await getDBNetSession();
    console.log(
      `[detect-text] prewarm [${BUILD_TAG}]: ORT session ready,`,
      'inputNames=', session.inputNames,
      'outputNames=', session.outputNames,
    );
    console.log(`[detect-text] DBNet pre-warmed [${BUILD_TAG}]`);
  } catch (err) {
    console.warn(`[detect-text] prewarm [${BUILD_TAG}] failed:`, err);
  }
}

export async function detectTextRegion(
  img: HTMLImageElement,
  timeoutMs = 6000,
): Promise<CropBox | null> {
  if (!img.naturalWidth || !img.naturalHeight) return null;

  let cv: any;
  let session: ORTSession;
  try {
    cv = await loadOpenCV();
    session = await getDBNetSession();
  } catch (err) {
    console.warn('[detect-text] failed to load deps:', err);
    return null;
  }

  return Promise.race([
    new Promise<CropBox | null>(async (resolve) => {
      try {
        const result = await runDBNet(cv, session, img);
        resolve(result);
      } catch (err) {
        console.warn('[detect-text] inference failed:', err);
        resolve(null);
      }
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

async function runDBNet(
  cv: OpenCVValue,
  session: ORTSession,
  img: HTMLImageElement,
): Promise<CropBox | null> {
  // cv.imread returns a 4-channel BGRA Mat when the source has alpha
  // (PNG, screenshots, certain camera outputs). DBNet's input is
  // strictly [1, 3, 640, 640] — an extra channel would silently make
  // the tensor shape mismatch, so we collapse to 3-channel BGR here.
  const matRaw = cv.imread(img);
  const mat =
    matRaw.channels() === 4
      ? (() => {
          const out = new cv.Mat();
          cv.cvtColor(matRaw, out, cv.COLOR_BGRA2BGR);
          matRaw.delete();
          return out;
        })()
      : matRaw;
  const origW = mat.cols;
  const origH = mat.rows;

  // 1. Resize to model input
  const resized = new cv.Mat();
  cv.resize(mat, resized, new cv.Size(INPUT_SIZE, INPUT_SIZE));

  // 2. blobFromImage: BGR→RGB (swapRB=true), /255, 1x3xHxW Float32
  const blob = cv.blobFromImage(
    resized,
    1 / 255,
    new cv.Size(INPUT_SIZE, INPUT_SIZE),
    new cv.Scalar(0, 0, 0),
    true, // swapRB
  );

  // 3. ImageNet mean/std normalize (RGB order, matches blobFromImage output)
  const chw = blob.data32F;
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const hw = INPUT_SIZE * INPUT_SIZE;
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < hw; i++) {
      chw[c * hw + i] = (chw[c * hw + i] - mean[c]) / std[c];
    }
  }

  // 4. Build ORT tensor (chw is a Float32Array view over the OpenCV blob)
  //    We copy into a fresh Float32Array because ORT may retain the buffer
  //    across the await call, and OpenCV will free `blob` in the cleanup
  //    step below.
  const inputName = session.inputNames[0];
  const inputData = new Float32Array(chw);
  const inputTensor = new ort.Tensor('float32', inputData, [
    1,
    3,
    INPUT_SIZE,
    INPUT_SIZE,
  ]);

  // 5. Forward
  const outputs = await session.run({ [inputName]: inputTensor });
  const outputName = session.outputNames[0];
  const outTensor = outputs[outputName] ?? outputs[Object.keys(outputs)[0]];
  const outData = outTensor.data as Float32Array;
  // Model output is [1, 1, 320, 320] — 102400 floats, row-major.
  if (outData.length !== OUTPUT_SIZE * OUTPUT_SIZE) {
    throw new Error(
      `unexpected ORT output length ${outData.length} (expected ${OUTPUT_SIZE * OUTPUT_SIZE})`,
    );
  }

  // 6. Wrap output in a 320×320 Float32 Mat for postprocessing
  const probMap = cv.matFromArray(
    OUTPUT_SIZE,
    OUTPUT_SIZE,
    cv.CV_32F,
    outData,
  );

  // 7. Threshold probability map
  const binary = new cv.Mat();
  cv.threshold(probMap, binary, TEXT_THRESHOLD, 255, cv.THRESH_BINARY);

  // 7b. Dilate vertically (in 320×320 output space). Math fractions have
  // tall glyph extents that DBNet's tight thresholding tends to fragment;
  // dilating ~3px in 320-space corresponds to ~6px in a typical 640px
  // input, and ~12px in a full-resolution original.
  const dilateKernel = cv.Mat.ones(3, 1, cv.CV_8U);
  const dilated = new cv.Mat();
  cv.dilate(binary, dilated, dilateKernel);
  dilateKernel.delete();
  binary.delete();

  // 8. Resize mask back to original image size
  const binaryFull = new cv.Mat();
  cv.resize(dilated, binaryFull, new cv.Size(origW, origH), 0, 0, cv.INTER_NEAREST);
  dilated.delete();

  // 9. Find contours of text regions
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    binaryFull,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE,
  );

  const boxes: CropBox[] = [];
  for (let i = 0; i < contours.size(); i++) {
    const r = cv.boundingRect(contours.get(i));
    const area = r.width * r.height;
    if (area < MIN_BOX_AREA) continue;
    boxes.push({ x: r.x, y: r.y, width: r.width, height: r.height });
  }

  // cleanup
  mat.delete();
  resized.delete();
  blob.delete();
  probMap.delete();
  binaryFull.delete();
  contours.delete();
  hierarchy.delete();

  if (boxes.length === 0) {
    console.warn(
      `[detect-text] [${BUILD_TAG}] no text regions (${contours.size()} contours, all < ${MIN_BOX_AREA}px²)`,
    );
    return null;
  }

  // 10. Group boxes by vertical proximity to form "problem" blocks
  const result = groupAndPickBest(boxes, origH, origW);
  console.log(
    `[detect-text] [${BUILD_TAG}] ${boxes.length} text regions, ${result.groups} problem group(s), best = ${result.best.width}×${result.best.height}`,
  );
  return result.best;
}

function groupAndPickBest(
  boxes: CropBox[],
  imageH: number,
  _imageW: number,
): { best: CropBox; groups: number } {
  // Sort by y, then group by vertical gap
  const sorted = [...boxes].sort((a, b) => a.y - b.y);
  const groupGap = Math.max(20, imageH * GROUP_GAP_RATIO);
  const groups: CropBox[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = groups[groups.length - 1][groups[groups.length - 1].length - 1];
    const curr = sorted[i];
    const gap = curr.y - (prev.y + prev.height);
    if (gap < groupGap) {
      groups[groups.length - 1].push(curr);
    } else {
      groups.push([curr]);
    }
  }

  // For each group, compute the bounding rect + a score that prefers
  // larger areas (multi-line problems over single characters)
  const scored = groups.map((g) => {
    const x = Math.min(...g.map((r) => r.x));
    const y = Math.min(...g.map((r) => r.y));
    const right = Math.max(...g.map((r) => r.x + r.width));
    const bottom = Math.max(...g.map((r) => r.y + r.height));
    const rect = { x, y, width: right - x, height: bottom - y };
    return { rect, score: rect.width * rect.height * g.length };
  });

  scored.sort((a, b) => b.score - a.score);
  return { best: scored[0].rect, groups: groups.length };
}
