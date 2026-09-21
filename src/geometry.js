/**
 * Pure geometry and colour maths for the cropper, the logo placement and the
 * variant choice. No DOM and no canvas, so `node --test` can run it.
 * See test/geometry.test.js.
 *
 * Transform convention
 * --------------------
 * A transform maps image pixels to square pixels:
 *
 *     p_square = p_image * scale + t
 *
 * The square is the export square, which is the bounding box of the crop
 * circle. Its top-left corner is the origin and its side length is `square`.
 * The app holds the live transform against a square of 1, so the same three
 * numbers render the preview and a 1024px export. See src/render.js.
 */

/** The user can't zoom past this multiple of the cover scale. */
export const MAX_ZOOM = 4;

/**
 * The smallest scale at which the image covers the square. The photo must
 * cover the square and not only the circle, because the export is the square.
 */
export function coverScale(iw, ih, square) {
  return Math.max(square / iw, square / ih);
}

/**
 * The nearest transform that leaves no gap in the square. It also holds the
 * scale between the cover scale and MAX_ZOOM times the cover scale. Call it
 * after every pan, every zoom and every resize.
 */
export function clampTransform(t, iw, ih, square) {
  const cover = coverScale(iw, ih, square);
  const scale = Math.min(Math.max(t.scale, cover), cover * MAX_ZOOM);
  return {
    scale,
    tx: clampAxis(t.tx, square - scale * iw),
    ty: clampAxis(t.ty, square - scale * ih),
  };
}

/**
 * Hold one axis in [lo, 0]. `lo` is negative while the drawn image is longer
 * than the square. If rounding puts it a little above zero, the image is
 * centred instead.
 */
function clampAxis(v, lo) {
  if (lo >= 0) return lo / 2;
  return Math.min(0, Math.max(lo, v));
}

/**
 * The export size in pixels: the number of real image pixels across the
 * square, capped at `max`. The app never upscales.
 */
export function exportSize(scale, squareStage, max) {
  return Math.min(max, Math.floor(squareStage / scale));
}

/**
 * The convex hull of `points`, counter-clockwise in a y-up axis, by Andrew's
 * monotone chain. Collinear points are dropped. Fewer than three different
 * points come back as they are.
 */
export function convexHull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const pts = sorted.filter(
    (p, i) => i === 0 || p.x !== sorted[i - 1].x || p.y !== sorted[i - 1].y,
  );
  if (pts.length < 3) return pts;
  return [...halfHull(pts), ...halfHull([...pts].reverse())];
}

function halfHull(pts) {
  const out = [];
  for (const p of pts) {
    while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) {
      out.pop();
    }
    out.push(p);
  }
  out.pop();
  return out;
}

function cross(o, a, b) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * The factor that draws the artwork at `fraction` of the circle diameter along
 * its longest side. The artwork bounding box drives it, not the PNG canvas, so
 * transparent padding doesn't make the mark smaller.
 */
export function logoScale(aw, ah, diameter, fraction) {
  return (fraction * diameter) / Math.max(aw, ah);
}

/**
 * Where to draw the logo. The mark slides down the 45 degree line from the
 * circle centre until its nearest opaque pixel touches a circle of radius
 * `r - inset`. The hull makes that exact, because the point that touches first
 * is always a hull vertex.
 *
 * `hull` holds vertices normalised to the artwork bounding box, so each
 * component is in [0,1]. `lw` and `lh` are the drawn size of that box.
 * `diameter`, `inset` and the result are in the same pixels.
 *
 * Returns the top-left corner for the drawn artwork.
 */
export function tangentOffset(hull, lw, lh, diameter, inset) {
  const r = diameter / 2;
  const limit = r - inset;
  const u = Math.SQRT1_2; // both components of the unit 45 degree vector
  let travel = Infinity;
  for (const p of hull) {
    // The vertex offset from the circle centre, with the artwork centred there.
    const vx = (p.x - 0.5) * lw;
    const vy = (p.y - 0.5) * lh;
    const vu = (vx + vy) * u;
    const disc = vu * vu - (vx * vx + vy * vy) + limit * limit;
    if (disc < 0) {
      throw new Error('The logo is too large to fit inside the inset circle.');
    }
    travel = Math.min(travel, -vu + Math.sqrt(disc));
  }
  if (!Number.isFinite(travel)) {
    throw new Error('tangentOffset needs at least one hull vertex.');
  }
  return { x: r + travel * u - lw / 2, y: r + travel * u - lh / 2 };
}

/** The three channels of a hex colour such as "#06213e", each in [0,255]. */
export function rgbFromHex(hex) {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The WCAG relative luminance of an [r,g,b] triple. */
export function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The WCAG contrast ratio, from 1 to 21. Each argument is an [r,g,b] triple or
 * a relative luminance that is already worked out. The variant choice compares
 * a mean luminance against a colour, so it needs both forms.
 */
export function contrastRatio(a, b) {
  const la = typeof a === 'number' ? a : relativeLuminance(a);
  const lb = typeof b === 'number' ? b : relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
