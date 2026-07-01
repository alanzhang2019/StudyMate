// Convert a box in original image pixel coordinates to the cropper's
// display coordinate system, which is centered and scaled inside a
// fixed-size container.

import type { CropBox } from './detect-problem';

export type DisplayBox = CropBox;

export function imageBoxToDisplayBox(
  imageBox: CropBox,
  imgSize: { w: number; h: number },
  display: { w: number; h: number },
  imagePos: { x: number; y: number },
): DisplayBox {
  if (!imgSize.w || !imgSize.h) {
    return { x: imagePos.x, y: imagePos.y, width: display.w, height: display.h };
  }
  const scale = display.w / imgSize.w;
  return {
    x: imagePos.x + imageBox.x * scale,
    y: imagePos.y + imageBox.y * scale,
    width: imageBox.width * scale,
    height: imageBox.height * scale,
  };
}
