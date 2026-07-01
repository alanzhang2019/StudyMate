// Client-side text-region detection using a DBNet ONNX model
// (chineseocr_lite's dbnet.onnx, 1.8MB) via OpenCV.js's DNN module.
//
// Pipeline:
//   1. Resize image to 640x640 (model input size, dynamic H/W supported)
//   2. BGR→RGB + /255 normalize (cv.blobFromImage with swapRB=true)
//   3. ImageNet mean/std normalize manually
//   4. Run DBNet forward → 1×1×320×320 probability map
//   5. Threshold at 0.3 → binary text mask
//   6. Find contours in mask → per-text-region bounding boxes
//   7. Scale boxes back to original image coordinates
//   8. Group nearby boxes into "problem" blocks by vertical proximity
//   9. Return the bounding box of the largest problem block
//
// Falls back to null on any error so the caller can use the previous
// edge-based algorithm as a fallback.

import type * as OpenCVNamespace from '@techstark/opencv-js';

export type CropBox = { x: number; y: number; width: number; height: number };

type OpenCVValue = any;

const MODEL_URL = '/models/dbnet.onnx';
const INPUT_SIZE = 640; // model input — dynamic but we use fixed for speed
const OUTPUT_SIZE = 320; // model output is fixed 320x320
const TEXT_THRESHOLD = 0.3;
const MIN_BOX_AREA = 200; // px² in original image coords
const GROUP_GAP_RATIO = 0.04; // 4% of image height

let cvPromise: Promise<typeof OpenCVNamespace> | null = null;
let modelPromise: Promise<any> | null = null;

export function loadOpenCV(): Promise<typeof OpenCVNamespace> {
  if (!cvPromise) cvPromise = import('@techstark/opencv-js');
  return cvPromise;
}

async function getDBNetModel(cv: OpenCVValue): Promise<any> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const net = cv.dnn.readNetFromONNX(MODEL_URL);
      // WASM backend (faster than CPU JS). OpenCV.js auto-selects the best
      // available backend for the platform.
      try {
        cv.dnn.setPreferableBackend(cv.dnn.DNN_BACKEND_OPENCV);
        cv.dnn.setPreferableTarget(cv.dnn.DNN_TARGET_CPU);
      } catch {
        // ignore — fall back to defaults
      }
      return net;
    })();
  }
  return modelPromise;
}

export async function prewarmDBNet(): Promise<void> {
  try {
    console.log('[detect-text] prewarm: importing OpenCV…');
    const cv = await loadOpenCV();
    console.log('[detect-text] prewarm: cv loaded, has dnn?', !!cv?.dnn,
      'has readNetFromONNX?', !!cv?.dnn?.readNetFromONNX);
    if (!cv?.dnn?.readNetFromONNX) {
      console.warn('[detect-text] prewarm: cv.dnn.readNetFromONNX is missing — DBNet unavailable');
      return;
    }
    console.log('[detect-text] prewarm: loading dbnet.onnx…');
    const net = await getDBNetModel(cv);
    console.log('[detect-text] prewarm: net =', net,
      'setInput?', typeof net?.setInput, 'forward?', typeof net?.forward);
    console.log('[detect-text] DBNet pre-warmed');
  } catch (err) {
    console.warn('[detect-text] prewarm failed:', err);
  }
}

export async function detectTextRegion(
  img: HTMLImageElement,
  timeoutMs = 6000,
): Promise<CropBox | null> {
  if (!img.naturalWidth || !img.naturalHeight) return null;

  let cv;
  try {
    cv = await loadOpenCV();
  } catch (err) {
    console.warn('[detect-text] failed to load OpenCV:', err);
    return null;
  }

  return Promise.race([
    new Promise<CropBox | null>(async (resolve) => {
      try {
        const net = await getDBNetModel(cv);
        const result = runDBNet(cv, net, img);
        resolve(result);
      } catch (err) {
        console.warn('[detect-text] inference failed:', err);
        resolve(null);
      }
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

function runDBNet(cv: OpenCVValue, net: any, img: HTMLImageElement): CropBox | null {
  const mat = cv.imread(img);
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
  const data = blob.data32F;
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const hw = INPUT_SIZE * INPUT_SIZE;
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < hw; i++) {
      data[c * hw + i] = (data[c * hw + i] - mean[c]) / std[c];
    }
  }

  // 4. Forward
  net.setInput(blob);
  const output = net.forward();

  // output is 1×1×320×320. Reshape to a single 320×320 Mat.
  const probMap = output.reshape(1, OUTPUT_SIZE);

  // 5. Threshold probability map
  const binary = new cv.Mat();
  cv.threshold(probMap, binary, TEXT_THRESHOLD, 255, cv.THRESH_BINARY);

  // 6. Resize mask back to original image size
  const binaryFull = new cv.Mat();
  cv.resize(binary, binaryFull, new cv.Size(origW, origH), 0, 0, cv.INTER_NEAREST);

  // 7. Find contours of text regions
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
  binary.delete();
  binaryFull.delete();
  contours.delete();
  hierarchy.delete();

  if (boxes.length === 0) {
    console.warn(`[detect-text] no text regions (${contours.size()} contours, all < ${MIN_BOX_AREA}px²)`);
    return null;
  }

  // 8. Group boxes by vertical proximity to form "problem" blocks
  const result = groupAndPickBest(boxes, origH, origW);
  console.log(
    `[detect-text] ${boxes.length} text regions, ${result.groups} problem group(s), best = ${result.best.width}×${result.best.height}`,
  );
  return result.best;
}

function groupAndPickBest(
  boxes: CropBox[],
  imageH: number,
  imageW: number,
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
