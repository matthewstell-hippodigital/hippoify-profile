/**
 * The cropper: the transform state, the fit of a new photo, and the pan and
 * zoom gestures.
 *
 * The clamp that stops a gap is a formula, so it lives in src/geometry.js
 * where the unit tests reach it. This module applies it after every change.
 *
 * The transform maps image pixels into a square of 1, so a resize or a change
 * of devicePixelRatio doesn't touch it. See src/render.js.
 */

import { MAX_ZOOM, clampTransform, coverScale } from './geometry.js';
import { PREVIEW_MARGIN } from './render.js';

/** The stage shows this many squares across. See PREVIEW_MARGIN. */
const VIEW = 1 + 2 * PREVIEW_MARGIN;
/** An arrow key pans by this share of the circle diameter, and 10% with shift. */
const PAN_STEP = 0.02;
const PAN_STEP_FAST = 0.10;
/** The + and - keys change the zoom by 5%. */
const ZOOM_STEP = 1.05;

/**
 * Take charge of the stage and the zoom slider.
 *
 * `onChange` runs after every change to the transform, and after a new photo
 * is fitted. The caller redraws there.
 */
export function createCropper({ stage, slider, onChange }) {
  let image = null;
  let transform = { scale: 1, tx: 0, ty: 0 };
  /** The cover scale of the photo now loaded. The slider works off it. */
  let cover = 1;

  /* ------------------------------------------------------------- the state */

  function set(next) {
    if (!image) return;
    transform = clampTransform(next, image.naturalWidth, image.naturalHeight, 1);
    slider.value = String(scaleToSlider(transform.scale));
    onChange();
  }

  /** The photo covers the circle at the minimum scale, centred. */
  function fit() {
    const iw = image.naturalWidth;
    const ih = image.naturalHeight;
    cover = coverScale(iw, ih, 1);
    set({ scale: cover, tx: (1 - cover * iw) / 2, ty: (1 - cover * ih) / 2 });
  }

  function holdScale(scale) {
    return Math.min(Math.max(scale, cover), cover * MAX_ZOOM);
  }

  /** Zoom, holding the image point under (ux, uy) still. Both are square units. */
  function zoomAt(scale, ux, uy) {
    const next = holdScale(scale);
    const k = next / transform.scale;
    set({
      scale: next,
      tx: ux - (ux - transform.tx) * k,
      ty: uy - (uy - transform.ty) * k,
    });
  }

  function sliderToScale(value) {
    return cover * (1 + (MAX_ZOOM - 1) * (Number(value) / 100));
  }

  function scaleToSlider(scale) {
    return Math.round(((scale / cover - 1) / (MAX_ZOOM - 1)) * 100);
  }

  /** An event position in square units. The square runs 0 to 1 in the stage. */
  function unitFrom(event) {
    const rect = stage.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEW - PREVIEW_MARGIN,
      y: ((event.clientY - rect.top) / rect.height) * VIEW - PREVIEW_MARGIN,
    };
  }

  /* ---------------------------------------------------------- the gestures */

  /* Pan with one pointer and pinch with two. Every move works from the
     baseline the gesture started with, so two fingers pan and zoom together. */
  const pointers = new Map();
  let gesture = null;

  function startGesture() {
    const points = [...pointers.values()];
    gesture = {
      transform: { ...transform },
      centre: midpoint(points),
      spread: points.length > 1 ? distance(points[0], points[1]) : 0,
    };
  }

  stage.addEventListener('pointerdown', (event) => {
    if (!image) return;
    stage.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, unitFrom(event));
    startGesture();
  });

  stage.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, unitFrom(event));
    const points = [...pointers.values()];

    if (points.length === 1) {
      const to = points[0];
      set({
        scale: gesture.transform.scale,
        tx: gesture.transform.tx + (to.x - gesture.centre.x),
        ty: gesture.transform.ty + (to.y - gesture.centre.y),
      });
      return;
    }

    if (gesture.spread <= 0) return;
    const centre = midpoint(points);
    const scale = holdScale(
      gesture.transform.scale * (distance(points[0], points[1]) / gesture.spread),
    );
    const k = scale / gesture.transform.scale;
    set({
      scale,
      tx: centre.x - (gesture.centre.x - gesture.transform.tx) * k,
      ty: centre.y - (gesture.centre.y - gesture.transform.ty) * k,
    });
  });

  for (const type of ['pointerup', 'pointercancel']) {
    stage.addEventListener(type, (event) => {
      if (!pointers.delete(event.pointerId)) return;
      // The gesture changed shape, so it needs a new baseline.
      if (pointers.size === 0) gesture = null;
      else startGesture();
    });
  }

  stage.addEventListener('wheel', (event) => {
    if (!image) return;
    event.preventDefault();
    const lines = event.deltaMode === 1 ? 16 : 1;
    const at = unitFrom(event);
    zoomAt(transform.scale * Math.exp((-event.deltaY * lines) / 500), at.x, at.y);
  }, { passive: false });

  stage.addEventListener('keydown', (event) => {
    if (!image) return;
    const step = event.shiftKey ? PAN_STEP_FAST : PAN_STEP;
    const t = transform;
    switch (event.key) {
      case 'ArrowLeft': set({ ...t, tx: t.tx - step }); break;
      case 'ArrowRight': set({ ...t, tx: t.tx + step }); break;
      case 'ArrowUp': set({ ...t, ty: t.ty - step }); break;
      case 'ArrowDown': set({ ...t, ty: t.ty + step }); break;
      // The keyboard zooms on the middle of the circle.
      case '+': case '=': zoomAt(t.scale * ZOOM_STEP, 0.5, 0.5); break;
      case '-': case '_': zoomAt(t.scale / ZOOM_STEP, 0.5, 0.5); break;
      default: return;
    }
    event.preventDefault();
  });

  slider.addEventListener('input', () => {
    if (!image) return;
    zoomAt(sliderToScale(slider.value), 0.5, 0.5);
  });

  return {
    get image() {
      return image;
    },
    get transform() {
      return transform;
    },
    /** Take a photo and fit it to the circle. */
    load(next) {
      image = next;
      pointers.clear();
      gesture = null;
      fit();
    },
    /** Let the photo go. */
    clear() {
      image = null;
      pointers.clear();
      gesture = null;
    },
  };
}

function midpoint(points) {
  const sum = points.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
