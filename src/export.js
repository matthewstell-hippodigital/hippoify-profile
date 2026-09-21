/**
 * The JPEG export: how large the file may be, how large the picture may be,
 * and the download itself.
 */

import { exportSize } from './geometry.js';
import { renderSquare } from './render.js';

/** The export never goes above this, and never upscales to reach it. */
export const MAX_SIZE = 1024;
/** 300 KB. Every upload target takes a file this size. */
export const TARGET_BYTES = 307200;
/** The quality search stays inside this range. */
const QUALITY = { low: 0.40, high: 0.92 };
/** Halving steps of the quality range. */
const STEPS = 7;
/** Sizes to fall back through when even the lowest quality is too large. */
const FALLBACK_SIZES = [896, 768, 640, 512];

export const FILE_NAME = 'hippo-profile-picture.jpg';

/**
 * The export size for a transform: the real image pixels across the square,
 * capped at MAX_SIZE. The transform is held against a square of 1.
 */
export function sizeFor(transform) {
  return Math.max(1, exportSize(transform.scale, 1, MAX_SIZE));
}

/**
 * A JPEG of the current crop, under TARGET_BYTES where that is reachable.
 * Returns { blob, quality, size }.
 */
export async function encode(state) {
  const first = sizeFor(state.transform);
  const sizes = [first, ...FALLBACK_SIZES.filter((s) => s < first)];
  let smallest = null;
  for (const size of sizes) {
    const canvas = renderSquare(size, state);
    const found = await search(canvas, size);
    if (found.blob.size <= TARGET_BYTES) return found;
    smallest = found;
  }
  // Every size stayed above the target. Hand back the smallest file made.
  return smallest;
}

/**
 * The largest quality that fits the target, by halving the range. The ends are
 * tested first: most crops pass at the top, and a crop that fails at the
 * bottom needs a smaller picture instead.
 */
async function search(canvas, size) {
  const high = await toJpeg(canvas, QUALITY.high, size);
  if (high.blob.size <= TARGET_BYTES) return high;
  const low = await toJpeg(canvas, QUALITY.low, size);
  if (low.blob.size > TARGET_BYTES) return low;

  let lo = QUALITY.low;
  let hi = QUALITY.high;
  let best = low;
  for (let i = 0; i < STEPS; i++) {
    const mid = (lo + hi) / 2;
    const attempt = await toJpeg(canvas, mid, size);
    if (attempt.blob.size <= TARGET_BYTES) {
      best = attempt;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}

function toJpeg(canvas, quality, size) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve({ blob, quality, size });
        else reject(new Error("The browser didn't make a JPEG."));
      },
      'image/jpeg',
      quality,
    );
  });
}

/** Save a blob through a temporary anchor and an object URL. */
export function download(blob, name = FILE_NAME) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Safari needs the URL to outlive the click by a tick.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
