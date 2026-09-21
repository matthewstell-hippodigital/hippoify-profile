/**
 * The wiring: the DOM, the input paths and the app state.
 *
 * src/cropper.js owns the photo and the transform. This module owns the logo
 * variant, the render, the file size and the download.
 */

import { createCropper } from './cropper.js';
import { preload, silhouette } from './logo.js';
import { PREVIEW_MARGIN, maskPreview, renderTo } from './render.js';
import { pickVariant } from './colour.js';
import { MAX_SIZE, download, encode, sizeFor } from './export.js';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const BAD_TYPE =
  "That file type doesn't open here. Use a JPEG, PNG or WebP. "
  + 'iPhone HEIC photos need to be exported as JPEG first.';
const NO_LOGO = 'The Hippo logomark didn’t load. Reload the page and try again.';
/** The file size is worked out once the pointer stops moving. */
const SETTLE_MS = 250;

const el = {
  picker: document.getElementById('picker'),
  editor: document.getElementById('editor'),
  drop: document.getElementById('drop'),
  choose: document.getElementById('choose'),
  file: document.getElementById('file'),
  error: document.getElementById('error'),
  stage: document.getElementById('stage'),
  zoom: document.getElementById('zoom'),
  download: document.getElementById('download'),
  meta: document.getElementById('meta'),
  soft: document.getElementById('soft'),
  reset: document.getElementById('reset'),
};

/** The logo silhouette on screen, which carries the chosen variant. */
let mark = null;
/** The settle timer, and a counter that drops an encode which lands too late. */
let settle = 0;
let job = 0;
/** The encoded file for the transform on screen, or null while it is stale. */
let ready = null;

const cropper = createCropper({
  stage: el.stage,
  slider: el.zoom,
  onChange: () => {
    draw();
    invalidate();
  },
});

/** What the render, the probe and the export all read. */
function view() {
  return { image: cropper.image, transform: cropper.transform, silhouette: mark };
}

/* ---------------------------------------------------------------- the photo */

async function handleFile(file) {
  if (!file) return;
  if (!ACCEPTED.includes(file.type)) {
    showError(BAD_TYPE);
    return;
  }
  showError('');

  let image;
  try {
    image = await readImage(file);
  } catch {
    showError("That photo didn't open. Try another one.");
    return;
  }

  let base;
  try {
    base = await silhouette('navy');
  } catch {
    showError(NO_LOGO);
    return;
  }

  mark = null;
  cropper.load(image);
  el.picker.hidden = true;
  el.editor.hidden = false;
  el.stage.focus();
  // The choice runs once, now that the first transform is set.
  await setVariant(pickVariant(view(), base));
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.addEventListener('load', () => {
      URL.revokeObjectURL(url);
      resolve(image);
    });
    image.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('The browser could not decode the file.'));
    });
    image.src = url;
  });
}

function reset() {
  clearTimeout(settle);
  job += 1;
  ready = null;
  cropper.clear();
  el.file.value = '';
  // Clear the last file size, so a stale one can't show against a new photo.
  el.meta.textContent = '';
  el.soft.hidden = true;
  el.download.classList.remove('is-ready');
  el.editor.hidden = true;
  el.picker.hidden = false;
  el.choose.focus();
}

function showError(message) {
  el.error.textContent = message;
  el.error.hidden = message === '';
}

/* ----------------------------------------------------------------- the paint */

function draw() {
  if (!cropper.image) return;
  const dpr = window.devicePixelRatio || 1;
  const size = Math.max(1, Math.round(el.stage.clientWidth * dpr));
  if (el.stage.width !== size) {
    el.stage.width = size;
    el.stage.height = size;
  }
  const ctx = el.stage.getContext('2d');
  renderTo(ctx, size, view(), { margin: PREVIEW_MARGIN });
  maskPreview(ctx, size);
}

/* ---------------------------------------------------------------- the variant */

async function setVariant(variant) {
  try {
    mark = await silhouette(variant);
  } catch {
    showError(NO_LOGO);
    return;
  }
  for (const input of el.editor.querySelectorAll('input[name="variant"]')) {
    input.checked = input.value === variant;
  }
  draw();
  invalidate();
}

/* ------------------------------------------------------------------ the file */

/** The crop changed, so the encoded file no longer matches it. */
function invalidate() {
  ready = null;
  job += 1;
  el.download.classList.remove('is-ready');
  el.meta.textContent = 'Working out the file size…';
  showSoftNote();
  clearTimeout(settle);
  settle = setTimeout(refresh, SETTLE_MS);
}

async function refresh() {
  clearTimeout(settle);
  if (!cropper.image || !mark) return;
  const id = ++job;
  let result;
  try {
    result = await encode(view());
  } catch {
    el.meta.textContent = "The file size didn't work out. Try Download anyway.";
    return;
  }
  if (id !== job) return; // the crop moved on while this one encoded
  ready = result;
  el.meta.textContent = `${result.size}px · ${formatBytes(result.blob.size)}`;
  el.download.classList.add('is-ready');
}

function showSoftNote() {
  const size = sizeFor(cropper.transform);
  const soft = size < MAX_SIZE;
  el.soft.hidden = !soft;
  if (soft) {
    el.soft.textContent =
      `This crop is ${size}px. Zoom out or use a larger photo for a sharper result.`;
  }
}

function formatBytes(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

async function save() {
  el.download.disabled = true;
  try {
    if (!ready) await refresh();
    if (ready) download(ready.blob);
  } finally {
    el.download.disabled = false;
  }
}

/* ----------------------------------------------------------------- the events */

el.choose.addEventListener('click', () => el.file.click());
el.file.addEventListener('change', () => handleFile(el.file.files[0]));
el.reset.addEventListener('click', reset);
el.download.addEventListener('click', save);

el.editor.addEventListener('change', (event) => {
  if (event.target.name === 'variant') setVariant(event.target.value);
});

/* Drag and drop, anywhere on the page. It doesn't obey the accept list, so
   handleFile checks the type. */
for (const type of ['dragenter', 'dragover']) {
  document.addEventListener(type, (event) => {
    event.preventDefault();
    if (!el.picker.hidden) el.drop.classList.add('is-over');
  });
}
document.addEventListener('dragleave', (event) => {
  if (!event.relatedTarget) el.drop.classList.remove('is-over');
});
document.addEventListener('drop', (event) => {
  event.preventDefault();
  el.drop.classList.remove('is-over');
  handleFile(event.dataTransfer?.files?.[0]);
});

/* A clipboard paste. */
window.addEventListener('paste', (event) => {
  const item = [...(event.clipboardData?.items ?? [])].find((i) => i.kind === 'file');
  const file = item?.getAsFile();
  if (!file) return;
  event.preventDefault();
  handleFile(file);
});

/* A resize changes the pixels, not the transform. */
new ResizeObserver(() => draw()).observe(el.stage);

/* Scan all three variants now, so a change of colour later doesn't wait. */
preload().catch(() => showError(NO_LOGO));
