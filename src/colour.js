/**
 * The automatic variant choice. It measures how light the photo is behind the
 * logo and picks the artwork colour that stands out most.
 *
 * Run it once, when a photo loads and the first transform is set. A variant
 * that changes during a drag reads as a fault.
 */

import { contrastRatio, relativeLuminance, rgbFromHex } from './geometry.js';
import { ARTWORK_COLOUR, variants } from './logo.js';
import { logoRect, renderSquare } from './render.js';

/** The probe renders this small. It only needs a mean. */
const PROBE = 128;

/**
 * The best variant for the photo behind the logo. `silhouette` supplies the
 * placement area; all three variants share one geometry, so any of them does.
 */
export function pickVariant(state, silhouette) {
  const mean = meanLuminance(state, silhouette);
  let best = null;
  for (const variant of variants()) {
    const ratio = contrastRatio(mean, rgbFromHex(ARTWORK_COLOUR[variant]));
    if (!best || ratio > best.ratio) best = { variant, ratio };
  }
  return best.variant;
}

/** The mean WCAG relative luminance of the crop under the logo. */
function meanLuminance(state, silhouette) {
  const area = logoRect(PROBE, silhouette);
  const x = Math.max(0, Math.floor(area.x));
  const y = Math.max(0, Math.floor(area.y));
  const w = Math.min(PROBE - x, Math.max(1, Math.ceil(area.w)));
  const h = Math.min(PROBE - y, Math.max(1, Math.ceil(area.h)));

  const canvas = renderSquare(PROBE, state, { logo: false, read: true });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { data } = ctx.getImageData(x, y, w, h);

  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += relativeLuminance([data[i], data[i + 1], data[i + 2]]);
  }
  return total / (data.length / 4);
}
