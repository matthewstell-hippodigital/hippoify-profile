/**
 * The logomark PNGs and their silhouettes. A silhouette is the alpha bounding
 * box plus the convex hull of the opaque pixels, normalised to that box. The
 * scan reads the pixels once per variant and the result is cached.
 */

import { convexHull } from './geometry.js';

const VARIANTS = ['navy', 'white', 'grey'];

const SOURCES = {
  navy: 'assets/Hippo-logomark-navy.png',
  white: 'assets/Hippo-logomark-white.png',
  grey: 'assets/Hippo-logomark-grey.png',
};

/**
 * The colour of the artwork inside each PNG. These aren't the brand palette:
 * the navy artwork is #06213e and the brand Navy is #0c2340. The variant
 * choice measures contrast against what the file really holds.
 */
export const ARTWORK_COLOUR = {
  navy: '#06213e',
  white: '#ffffff',
  grey: '#dde4e6',
};

/** A pixel counts as artwork above this alpha. */
const OPAQUE = 8;

/** variant -> Promise of a silhouette. The promise is cached, not the result,
 *  so two early calls share one scan. */
const cache = new Map();

/** The variant names, in the order the radio group shows them. */
export function variants() {
  return [...VARIANTS];
}

/** The image, bounding box and hull of one variant. */
export function silhouette(variant) {
  if (!cache.has(variant)) cache.set(variant, scan(variant));
  return cache.get(variant);
}

/** Start every scan now, so a variant change later doesn't wait. */
export function preload() {
  return Promise.all(VARIANTS.map((v) => silhouette(v)));
}

async function scan(variant) {
  const src = SOURCES[variant];
  if (!src) throw new Error(`${variant} isn't a logo variant.`);
  const image = await loadImage(src);
  const w = image.naturalWidth;
  const h = image.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);

  // The leftmost and rightmost opaque pixel of each row. Every other opaque
  // pixel of a row sits between those two, so the hull of the edges is the
  // hull of all of them. It turns a million points into a few thousand.
  const edges = [];
  let minX = w;
  let maxX = -1;
  let minY = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > OPAQUE) {
        if (left < 0) left = x;
        right = x;
      }
    }
    if (left < 0) continue;
    edges.push({ x: left, y }, { x: right, y });
    if (left < minX) minX = left;
    if (right > maxX) maxX = right;
    if (minY < 0) minY = y;
    maxY = y;
  }
  if (maxX < 0) throw new Error(`${src} holds no opaque pixel.`);

  const box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  const hull = convexHull(edges).map((p) => ({
    x: (p.x - box.x) / (box.w - 1),
    y: (p.y - box.y) / (box.h - 1),
  }));
  return { variant, image, box, hull, colour: ARTWORK_COLOUR[variant] };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error(`${src} didn't load.`)));
    image.src = src;
  });
}
