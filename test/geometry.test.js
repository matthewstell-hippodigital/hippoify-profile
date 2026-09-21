import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_ZOOM,
  clampTransform,
  contrastRatio,
  convexHull,
  coverScale,
  exportSize,
  logoScale,
  rgbFromHex,
  relativeLuminance,
  tangentOffset,
} from '../src/geometry.js';

/** The hull of a unit square, normalised to its bounding box. */
const SQUARE_HULL = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** The hull of a circle that fills its bounding box. */
function circleHull(steps = 64) {
  const points = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    points.push({ x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a) });
  }
  return convexHull(points);
}

/** The distance of every hull vertex from the circle centre, once placed. */
function vertexRadii(hull, origin, lw, lh, diameter) {
  const r = diameter / 2;
  return hull.map((p) => {
    const dx = origin.x + p.x * lw - r;
    const dy = origin.y + p.y * lh - r;
    return Math.hypot(dx, dy);
  });
}

/** How far the mark travelled down the 45 degree line, from its draw origin. */
function travelOf(origin, lw, diameter) {
  return (origin.x + lw / 2 - diameter / 2) / Math.SQRT1_2;
}

describe('coverScale', () => {
  it('returns the larger of the two ratios for a wide image', () => {
    // 400 x 200 into 100: the height is the tight side.
    assert.equal(coverScale(400, 200, 100), 0.5);
  });

  it('returns the larger of the two ratios for a tall image', () => {
    assert.equal(coverScale(200, 400, 100), 0.5);
  });

  it('covers the square exactly on the tight side', () => {
    const scale = coverScale(1000, 400, 200);
    assert.equal(scale * 400, 200);
    assert.ok(scale * 1000 >= 200);
  });
});

describe('clampTransform', () => {
  const iw = 400;
  const ih = 300;
  const square = 200;

  it('leaves a valid transform alone', () => {
    const t = { scale: 1, tx: -60, ty: -40 };
    assert.deepEqual(clampTransform(t, iw, ih, square), t);
  });

  it('pulls a transform back when the right image edge enters the square', () => {
    // scale 1 draws 400 x 300, so tx may not fall below 200 - 400 = -200.
    const t = clampTransform({ scale: 1, tx: -260, ty: -40 }, iw, ih, square);
    assert.equal(t.tx, -200);
    assert.equal(t.ty, -40);
  });

  it('pulls a transform back when the left image edge enters the square', () => {
    const t = clampTransform({ scale: 1, tx: 30, ty: -40 }, iw, ih, square);
    assert.equal(t.tx, 0);
  });

  it('raises a scale that leaves a gap to the cover scale', () => {
    const t = clampTransform({ scale: 0.1, tx: 0, ty: 0 }, iw, ih, square);
    assert.equal(t.scale, coverScale(iw, ih, square));
  });

  it('holds the scale at MAX_ZOOM times the cover scale', () => {
    const cover = coverScale(iw, ih, square);
    const t = clampTransform({ scale: cover * 99, tx: 0, ty: 0 }, iw, ih, square);
    assert.equal(t.scale, cover * MAX_ZOOM);
  });

  it('leaves no gap on either axis, whatever it is given', () => {
    for (const tx of [-1000, -200, -13, 0, 500]) {
      for (const ty of [-1000, -150, -7, 0, 500]) {
        const t = clampTransform({ scale: 1, tx, ty }, iw, ih, square);
        assert.ok(t.tx <= 0 && t.tx + t.scale * iw >= square, `tx ${t.tx}`);
        assert.ok(t.ty <= 0 && t.ty + t.scale * ih >= square, `ty ${t.ty}`);
      }
    }
  });
});

describe('exportSize', () => {
  it('caps at 1024', () => {
    // 4000 image pixels across the square, so it caps.
    assert.equal(exportSize(1 / 4000, 1, 1024), 1024);
  });

  it('returns the available pixels when they are fewer than 1024', () => {
    assert.equal(exportSize(1 / 600, 1, 1024), 600);
  });

  it('never rounds up a part pixel', () => {
    assert.equal(exportSize(1 / 600.9, 1, 1024), 600);
  });

  it('works in stage pixels as well as in unit squares', () => {
    // A 400px square at scale 0.5 reads 800 source pixels.
    assert.equal(exportSize(0.5, 400, 1024), 800);
  });
});

describe('convexHull', () => {
  it('drops a point inside the shape', () => {
    const hull = convexHull([...SQUARE_HULL, { x: 0.5, y: 0.5 }]);
    assert.equal(hull.length, 4);
  });

  it('drops a collinear point on an edge', () => {
    const hull = convexHull([...SQUARE_HULL, { x: 0.5, y: 0 }]);
    assert.equal(hull.length, 4);
  });

  it('gives back fewer than three points as they are', () => {
    assert.deepEqual(convexHull([{ x: 1, y: 2 }]), [{ x: 1, y: 2 }]);
  });
});

describe('logoScale', () => {
  it('uses the longest side of a wide artwork', () => {
    // 877 x 705 at 30% of 1024 gives 307.2 across the width.
    const k = logoScale(877, 705, 1024, 0.3);
    assert.ok(Math.abs(877 * k - 307.2) < 1e-9);
    assert.ok(705 * k < 307.2);
  });

  it('uses the longest side of a tall artwork', () => {
    const k = logoScale(400, 800, 1000, 0.3);
    assert.ok(Math.abs(800 * k - 300) < 1e-9);
    assert.ok(Math.abs(400 * k - 150) < 1e-9);
  });
});

describe('tangentOffset', () => {
  const diameter = 1024;
  const inset = 0.02 * diameter;
  const limit = diameter / 2 - inset;
  const side = logoScale(1, 1, diameter, 0.3) * 1; // a square mark at 30%

  it('keeps a square hull inside the inset circle and touches it', () => {
    const origin = tangentOffset(SQUARE_HULL, side, side, diameter, inset);
    const radii = vertexRadii(SQUARE_HULL, origin, side, side, diameter);
    assert.ok(Math.max(...radii) <= limit + 1e-6, 'a vertex crossed the inset circle');
    assert.ok(Math.abs(Math.max(...radii) - limit) < 1e-6, 'no vertex reached the inset circle');
  });

  it('keeps a circular hull inside the inset circle and touches it', () => {
    const hull = circleHull();
    const origin = tangentOffset(hull, side, side, diameter, inset);
    const radii = vertexRadii(hull, origin, side, side, diameter);
    assert.ok(Math.max(...radii) <= limit + 1e-6, 'a vertex crossed the inset circle');
    assert.ok(Math.abs(Math.max(...radii) - limit) < 1e-3, 'no vertex reached the inset circle');
  });

  it('puts a round mark closer to the edge than a square one of the same size', () => {
    // This difference is the reason the placement follows the silhouette and
    // not the bounding box. A square corner is empty space on a round mark.
    const square = travelOf(tangentOffset(SQUARE_HULL, side, side, diameter, inset), side, diameter);
    const round = travelOf(tangentOffset(circleHull(), side, side, diameter, inset), side, diameter);
    const gain = round - square;
    assert.ok(gain > 0, 'the round mark did not travel further');
    // A square corner sits side/sqrt(2) from the centre of the mark and the
    // edge of a circle sits side/2, so the round mark gains the difference.
    const expected = side * (Math.SQRT1_2 - 0.5);
    assert.ok(Math.abs(gain - expected) < 0.5, `gain ${gain} against ${expected}`);
  });

  it('places the logo down and to the right, by equal amounts', () => {
    const origin = tangentOffset(SQUARE_HULL, side, side, diameter, inset);
    const r = diameter / 2;
    const offsetX = origin.x + side / 2 - r;
    const offsetY = origin.y + side / 2 - r;
    assert.ok(offsetX > 0, 'the logo did not move right');
    assert.ok(offsetY > 0, 'the logo did not move down');
    assert.ok(Math.abs(offsetX - offsetY) < 1e-9, 'the move was not on the 45 degree line');
  });

  it('holds the real artwork shape inside the inset circle', () => {
    // The shipped artwork is 877 x 705, wider than tall.
    const k = logoScale(877, 705, diameter, 0.3);
    const lw = 877 * k;
    const lh = 705 * k;
    const origin = tangentOffset(SQUARE_HULL, lw, lh, diameter, inset);
    const radii = vertexRadii(SQUARE_HULL, origin, lw, lh, diameter);
    assert.ok(Math.max(...radii) <= limit + 1e-6);
  });

  it('throws when the mark is too large for the circle', () => {
    assert.throws(() => tangentOffset(SQUARE_HULL, 4000, 4000, diameter, inset));
  });
});

describe('relativeLuminance', () => {
  it('gives 0 for black and 1 for white', () => {
    assert.equal(relativeLuminance([0, 0, 0]), 0);
    assert.ok(Math.abs(relativeLuminance([255, 255, 255]) - 1) < 1e-12);
  });
});

describe('contrastRatio', () => {
  it('returns 21 for black against white', () => {
    assert.ok(Math.abs(contrastRatio([0, 0, 0], [255, 255, 255]) - 21) < 1e-9);
  });

  it('returns 6.40 for Turquoise Darkest against Turquoise', () => {
    // The plan says about 7.0 for this pair. The WCAG formula gives 6.40, which
    // still passes AA for all text sizes. See README.md.
    const ratio = contrastRatio(rgbFromHex('#002f26'), rgbFromHex('#6db9ab'));
    assert.ok(Math.abs(ratio - 6.4) < 0.05, `ratio ${ratio}`);
    assert.ok(ratio >= 4.5, 'the download button fails WCAG AA');
  });

  it('accepts a luminance that is already worked out', () => {
    const both = contrastRatio(relativeLuminance([0, 0, 0]), [255, 255, 255]);
    assert.ok(Math.abs(both - 21) < 1e-9);
  });

  it('gives the brand text colours 4.5 or better on the page surface', () => {
    const surface = rgbFromHex('#eff2f2');
    assert.ok(contrastRatio(rgbFromHex('#0c2340'), surface) >= 4.5);
    assert.ok(contrastRatio(rgbFromHex('#0c2340'), rgbFromHex('#ffffff')) >= 4.5);
  });
});
