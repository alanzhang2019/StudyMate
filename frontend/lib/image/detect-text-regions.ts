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
// DBNet downsamples by 2x, so the default output is 320x320 for a 640x640
// input. But the model advertises dynamic output dims, and ORT will
// happily give us back the same spatial size as the input if the runtime
// didn't apply the downsample op. We read the actual dims from the tensor
// at runtime so the postprocessing pipeline stays correct in either case.
const DEFAULT_OUTPUT_SIZE = 320; // expected output H/W for INPUT_SIZE=640
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
const BUILD_TAG = 'dbnet-2026-07-02-r8-aligned-input';

// ORT 1.27.0 WASM tensors require 16-byte aligned backing buffers. A
// `new Float32Array(n)` allocates from V8's normal heap, which is only
// guaranteed 8-byte aligned — on some browsers the SIMD memcpy op in
// ORT then traps and surfaces as error code 2472980 with no message.
// Allocating a `ArrayBuffer` with explicit 16-byte alignment first
// guarantees the float32 view is properly aligned for ORT's WASM SIMD.
function allocAlignedFloat32(length: number): Float32Array {
  const BYTES_PER_F32 = 4;
  const ALIGN = 16;
  const stride = Math.ceil((length * BYTES_PER_F32) / ALIGN) * ALIGN;
  const ab = new ArrayBuffer(stride);
  return new Float32Array(ab);
}

let cvPromise: Promise<typeof OpenCVNamespace> | null = null;
let sessionPromise: Promise<ORTSession> | null = null;

export function loadOpenCV(): Promise<typeof OpenCVNamespace> {
  if (!cvPromise) cvPromise = import('@techstark/opencv-js');
  return cvPromise;
}

async function getDBNetSession(): Promise<ORTSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      // Provider order is significant. On modern Chrome/Edge ORT will
      // pick WebGPU → WebGL → WASM. On Safari/Firefox it'll fall back
      // to WASM. We list all three so ORT picks the best one available
      // instead of failing outright when the user's environment
      // doesn't support WASM SIMD/threads (which previously surfaced
      // as error code 2472980 with no usable message).
      //
      // `enableCpuMemArena: false` works around a known ORT 1.27.0
      // bug where the arena allocator in WASM thread mode returns
      // a tensor pointer that downstream Conv kernels reject.
      //
      // `executionMode: 'sequential'` makes the run deterministic
      // and skips a parallel-execution path that has been observed
      // to fail shape checks for some dbnet graphs.
      //
      // `disable_shape_verification: '1'` is required because this
      // model graph declares output as {1,1,320,320} but at runtime
      // ORT's chosen implementation elides the downsample and
      // produces {1,1,640,640}. We read `outTensor.dims` for the
      // real H×W in the postprocess step.
      const session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['webgpu', 'webgl', 'wasm'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: false,
        executionMode: 'sequential',
        logSeverityLevel: 3,
        extra: {
          session: {
            disable_shape_verification: '1',
          },
        },
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
        // ORT 1.27.0 throws `Error("… ERROR_CODE: <num>, ERROR_MESSAGE: …")`
        // from native bindings. Logging the raw object loses the message
        // because Chrome collapses it; we extract the salient bits so the
        // console shows the human-readable cause, not just an integer.
        const e = err as unknown as { message?: string; name?: string; code?: number; stack?: string };
        const msg = e?.message ?? String(err);
        const code = typeof e?.code === 'number' ? e.code : extractOrtCode(msg);
        console.warn(
          `[detect-text] [${BUILD_TAG}] inference failed: code=${code} name=${e?.name ?? '?'} message=${msg}`,
          e?.stack ?? '',
        );
        resolve(null);
      }
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

function extractOrtCode(msg: string): number | null {
  const m = msg.match(/ERROR_CODE:\s*(\d+)/);
  return m ? Number(m[1]) : null;
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
  //    We copy into a *16-byte aligned* Float32Array because ORT's WASM
  //    SIMD memcpy trap on unaligned buffers surfaces as a bare
  //    `2472980` code with no message (a `new Float32Array(chw)` is
  //    only 8-byte aligned on V8's normal heap). See `allocAlignedFloat32`.
  const inputName = session.inputNames[0];
  const inputData = allocAlignedFloat32(3 * INPUT_SIZE * INPUT_SIZE);
  inputData.set(chw);
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
  // Read the actual output shape from the tensor. DBNet's graph declares
  // dynamic spatial dims; in practice we see either {1,1,320,320} (after
  // the stride-2 downsample) or {1,1,640,640} (when ORT's optimization
  // elides the downsample for the chosen input size). Both shapes are
  // legitimate — the rest of the pipeline only needs H×W.
  const outDims = (outTensor.dims as readonly number[]) ?? [];
  let outH = DEFAULT_OUTPUT_SIZE;
  let outW = DEFAULT_OUTPUT_SIZE;
  if (outDims.length === 4) {
    outH = outDims[2];
    outW = outDims[3];
  } else if (outDims.length === 3) {
    outH = outDims[1];
    outW = outDims[2];
  } else if (outDims.length === 2) {
    outH = outDims[0];
    outW = outDims[1];
  }
  if (outData.length !== outH * outW) {
    throw new Error(
      `unexpected ORT output length ${outData.length} (expected ${outH * outW} for shape ${JSON.stringify(outDims)})`,
    );
  }

  // 6. Wrap output in a (outH×outW) Float32 Mat for postprocessing
  const probMap = cv.matFromArray(outH, outW, cv.CV_32F, outData);

  // 7. Threshold probability map
  const binary = new cv.Mat();
  cv.threshold(probMap, binary, TEXT_THRESHOLD, 255, cv.THRESH_BINARY);

  // 7b. Dilate vertically (in the model's output space). Math fractions
  // have tall glyph extents that DBNet's tight thresholding tends to
  // fragment; dilating a few pixels in the output space merges nearby
  // text rows back into a single contour. We size the kernel to be ~0.5%
  // of the output dimension, so it works for both 320×320 and 640×640
  // output shapes (1–3 px).
  const dilateSize = Math.max(1, Math.round(Math.min(outH, outW) * 0.005));
  const dilateKernel = cv.Mat.ones(dilateSize, 1, cv.CV_8U);
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
