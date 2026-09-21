/**
 * The single render path. One function draws the preview and the export, which
 * is what keeps the file the same as the picture on screen.
 */

import { logoScale, tangentOffset } from './geometry.js';

/** The logo covers this much of the circle diameter along its longest side. */
export const LOGO_FRACTION = 0.30;
/** The logo stops this far inside the circle edge, as a share of the diameter. */
export const LOGO_INSET = 0.02;
/** Fixed. It isn't a control. */
export const LOGO_ALPHA = 0.90;
/**
 * The circle is 80% of the stage width, so the stage shows this much of the
 * photo past each edge of the export square, measured in squares.
 */
export const PREVIEW_MARGIN = 0.125;

/**
 * Draw a state into a square canvas context.
 *
 * `size` is the canvas side in device pixels. It holds the export square
 * exactly, unless `margin` widens the view for the preview.
 *
 * state = { image, transform: { scale, tx, ty }, silhouette }
 * The transform maps image pixels into a square of 1. See src/geometry.js.
 */
export function renderTo(ctx, size, state, { margin = 0, logo = true } = {}) {
  const view = 1 + 2 * margin;
  const square = size / view; // the export square, in canvas pixels
  const origin = margin * square; // its top-left corner

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // White first, so transparency in a source PNG doesn't come through.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const { image, transform } = state;
  if (image) {
    const iw = image.naturalWidth;
    const ih = image.naturalHeight;
    drawDownscaled(
      ctx, image, 0, 0, iw, ih,
      origin + transform.tx * square,
      origin + transform.ty * square,
      transform.scale * iw * square,
      transform.scale * ih * square,
    );
  }
  if (logo && state.silhouette) {
    const at = logoRect(square, state.silhouette);
    const { box, image: mark } = state.silhouette;
    ctx.save();
    ctx.globalAlpha = LOGO_ALPHA;
    drawDownscaled(
      ctx, mark, box.x, box.y, box.w, box.h,
      origin + at.x, origin + at.y, at.w, at.h,
    );
    ctx.restore();
  }
}

/** The rectangle the artwork covers in an export square of `size` pixels. */
export function logoRect(size, silhouette) {
  const { box, hull } = silhouette;
  const k = logoScale(box.w, box.h, size, LOGO_FRACTION);
  const w = box.w * k;
  const h = box.h * k;
  const at = tangentOffset(hull, w, h, size, LOGO_INSET * size);
  return { x: at.x, y: at.y, w, h };
}

/** A square canvas holding exactly what the export holds. */
export function renderSquare(size, state, options = {}) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d', { willReadFrequently: options.read === true });
  renderTo(ctx, size, state, options);
  return canvas;
}

/**
 * The extras that belong to the preview and not to the file: the area outside
 * the circle is dimmed, and the circle gets a faint edge. The preview shows
 * the circle only. It doesn't show the square.
 */
export function maskPreview(ctx, size) {
  const view = 1 + 2 * PREVIEW_MARGIN;
  const centre = size / 2;
  const radius = size / (2 * view);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.rect(0, 0, size, size);
  ctx.arc(centre, centre, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.fill('evenodd');
  ctx.beginPath();
  ctx.arc(centre, centre, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, size / 600);
  ctx.strokeStyle = 'rgba(12, 35, 64, 0.3)';
  ctx.stroke();
  ctx.restore();
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * A chain of half-size copies of one source region, cached against the source
 * image. A single large downscale in one drawImage() step gives a soft,
 * aliased result, so the render steps down by halves first and the last step
 * is always under 2:1. The chain grows only as far as a render needs.
 */
const chains = new WeakMap();

function drawDownscaled(ctx, source, sx, sy, sw, sh, dx, dy, dw, dh) {
  const level = levelFor(source, sx, sy, sw, sh, dw);
  if (level) ctx.drawImage(level.canvas, 0, 0, level.w, level.h, dx, dy, dw, dh);
  else ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
}

function levelFor(source, sx, sy, sw, sh, dw) {
  const key = `${sx},${sy},${sw},${sh}`;
  let chain = chains.get(source);
  if (!chain || chain.key !== key) {
    chain = { key, levels: [] };
    chains.set(source, chain);
  }
  const { levels } = chain;

  for (;;) {
    const last = levels.length ? levels[levels.length - 1] : { w: sw, h: sh };
    if (last.w < dw * 2 || last.w < 2) break;
    const w = Math.max(1, Math.floor(last.w / 2));
    const h = Math.max(1, Math.floor(last.h / 2));
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (levels.length === 0) ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
    else ctx.drawImage(last.canvas, 0, 0, last.w, last.h, 0, 0, w, h);
    levels.push({ canvas, w, h });
  }

  // The smallest level that is still at least the drawn size. A larger render
  // later, such as the export after a preview, falls back to a bigger level.
  for (let i = levels.length - 1; i >= 0; i--) {
    if (levels[i].w >= dw) return levels[i];
  }
  return null; // draw from the source itself
}
