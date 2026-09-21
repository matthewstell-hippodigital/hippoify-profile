# Hippoify Profile — project plan

A single-page web app. The user selects a photo, positions it in a circular
mask, and downloads a square JPEG with the Hippo logomark in the bottom-right
of the circle. The output is for a Google or Microsoft profile picture.

This plan holds every decision made in the design interview. Follow it.
Where the plan gives a formula, use that formula.

## 1. Constraints

- The app runs on GitHub Pages. It doesn't have a server component.
- The app doesn't send the photo anywhere. All work happens in the browser.
- The repository is public, under a personal GitHub account.
- Pages serves the site from the `main` branch, root directory.
- The repository doesn't contain a licence file.
- Target browsers: current Chrome, Safari, Firefox and Edge.

## 2. Stack

Plain HTML, CSS and ES modules. There is no build step and no runtime
dependency. What the repository holds is what the site serves.

ES modules need an HTTP origin. They don't load from `file://`. For local
work, run `python3 -m http.server` in the repository root.

Test dependencies are permitted, but the site must stay dependency-free.

## 3. File layout

```
index.html
styles.css
.nojekyll
README.md
PLAN.md
src/
  main.js        wiring, DOM, events
  cropper.js     transform state, pan and zoom, clamping
  geometry.js    pure functions, unit tested
  logo.js        loads the PNGs, scans alpha, caches the hull
  render.js      the single render path (preview and export)
  export.js      JPEG size search and download
  colour.js      luminance and contrast, auto variant choice
assets/
  Hippo-logomark-navy.png
  Hippo-logomark-white.png
  Hippo-logomark-grey.png
  fonts/DMSans-Regular.woff2
  fonts/DMSans-Medium.woff2
  fonts/DMSans-Bold.woff2
  fonts/DMSans-Regular.ttf
  fonts/DMSans-Medium.ttf
  fonts/DMSans-Bold.ttf
  fonts/OFL.txt
test/
  geometry.test.js
```

`assets/fonts/OFL.txt` is the DM Sans licence. The SIL Open Font License
requires it to stay with the font files. It says nothing about the rest of
the repository.

## 4. Brand

Source: `HIP398_Hippo Rebrand 2025_p11_Colour.pdf` (Hippo Rebrand v0.1).

| Family | Lightest | Light | Base | Dark | Darkest |
|---|---|---|---|---|---|
| Navy | `#a5d0ff` | `#6699cc` | `#0c2340` | `#000522` | `#000004` |
| Grey | `#ffffff` | `#eff2f2` | `#dde4e6` | `#c9d0d2` | `#060a0c` |
| Pink | `#ffcbdf` | `#ea9dc1` | `#e07fa3` | `#b8577b` | `#2d0000` |
| Turquoise | `#a0f5e7` | `#8ce1d3` | `#6db9ab` | `#4f9b8d` | `#002f26` |

Pink and Turquoise don't reach 4.5:1 against white. Don't put text or a focus
ring in those colours on a white or light background.

Apply the palette as follows:

- Page surface: Grey Light `#eff2f2`.
- Cards and the cropper stage: white `#ffffff`.
- Text, borders and controls: Navy `#0c2340`.
- Focus ring: Navy Dark `#000522`, 3px, with a 2px offset.
- Download button, before a crop is ready: Navy `#0c2340`, white text.
- Download button, when a crop is ready: Turquoise `#6db9ab` with Turquoise
  Darkest `#002f26` text. That pair gives about 7:1.

Typeface: DM Sans, self-hosted. Declare three `@font-face` rules that all use
`font-family: "DM Sans"` with `font-weight` 400, 500 and 700. The Medium file
names itself "DM Sans Medium" internally. Ignore that name and use the weight.
Use `font-display: swap`. Don't call the Google Fonts CDN.

## 5. Assets to verify

The three logomark PNGs are 1080 x 1080 with an alpha channel. Get them from
this Google Drive folder:

`https://drive.google.com/drive/folders/1XeLZsp4tbj92uQR23vPbLIXjwBy6R4_Q`

| File | Drive file ID | Bytes |
|---|---|---|
| `Hippo-logomark-navy.png` | `1tjsA0pGrqD3ErXbIQdRfH-OGbK_qPQ6g` | 18283 |
| `Hippo-logomark-white.png` | `1gLYGXnWO5_jfwaX8HIzSyoc2QQtRAWou` | 17955 |
| `Hippo-logomark-grey.png` | `18lAnPt_fd7l1G4JE0SzYoznfE_1DeqMO` | 17665 |

**Warning.** A previous attempt transcribed these files through base64 text and
corrupted them. The files decoded as valid PNG headers but the pixel data was
broken. Before you use a PNG, check two things:

1. The file size equals the byte count in the table.
2. The file decodes completely, for example with
   `uv run --python 3.12 --with pillow python -c "from PIL import Image; im=Image.open(p); im.load()"`.

If a check fails, get the file again. Don't build on a file that fails.

The fonts in `assets/fonts/` are already correct and verified.

### 5.1 Verified measurements

All three files were checked on 2026-09-21. The byte counts match and each file
decodes completely. The three variants share one geometry:

| Property | Value |
|---|---|
| Canvas | 1080 x 1080, RGBA |
| Artwork alpha bounding box | `(101, 188)` to `(978, 893)` |
| Artwork size | 877 x 705 |
| Artwork aspect ratio | 1.2440, wider than tall |
| Padding, left and right | 9.4% of the canvas |
| Padding, top and bottom | 17.4% of the canvas |

The padding is large, which is why section 9.2 scales by the artwork and not by
the canvas. Scaling by the canvas would make the visible mark about 17% smaller
than intended.

Because the artwork is wider than tall, the longest side is the width. At a
1024px export the logo is 307px wide and 247px tall.

The dominant opaque colour of each variant:

| Variant | Colour |
|---|---|
| Navy | `#06213e` |
| White | `#ffffff` |
| Grey | `#dde4e6` |

The navy artwork is `#06213e`. That isn't the brand Navy `#0c2340`, and it
isn't the `#15243d` used by an older lockup SVG. Use `#06213e` wherever the
code needs the logo's own colour, for example the contrast test in section 10.
Use the brand Navy `#0c2340` for the page furniture.

## 6. User flow

1. The page opens with an empty drop area and a "Choose a photo" button.
2. The user supplies a photo by file picker, drag and drop, or clipboard paste.
3. The cropper opens. The photo covers the circle at the minimum scale.
4. The app picks the best logo variant once. See section 10.
5. The user pans and zooms the photo. The user can change the logo variant.
6. The user clicks Download. The browser saves `hippo-profile-picture.jpg`.
7. A "Choose a different photo" control resets the app to step 1.

## 7. Input

The file input uses `accept="image/jpeg,image/png,image/webp"`.

HEIC is excluded on purpose. Chrome and Firefox can't decode HEIC.

Drag and drop and clipboard paste don't obey `accept`. Check the MIME type in
the handler. If the type isn't one of the three, show this message:

> That file type doesn't open here. Use a JPEG, PNG or WebP. iPhone HEIC photos
> need to be exported as JPEG first.

All three input paths call one function, `handleFile(file)`.

Browsers apply EXIF orientation when they decode an image. The app doesn't
need to read EXIF and doesn't offer a rotation control.

## 8. Cropper

### 8.1 Layout

The stage is a square element. The circle sits at its centre. The circle
diameter is 80% of the stage width. The area outside the circle is dimmed with
a translucent white overlay. The preview shows the circle only. It doesn't
show the square.

### 8.2 Transform state

```js
{ scale, tx, ty }   // image pixels -> stage pixels: p_stage = p_image * scale + t
```

Let `iw` and `ih` be the natural image size. Let `R` be the circle radius in
stage pixels, and `(cx, cy)` the circle centre.

The export square is the bounding box of the circle. The photo must cover that
square, so the cover rule uses the square, not the circle:

```
minScale = max(2R / iw, 2R / ih)
scale >= minScale
```

Clamp the translation so the square stays inside the image:

```
tx <= cx - R          and    tx + scale*iw >= cx + R
ty <= cy - R          and    ty + scale*ih >= cy + R
```

A gap can't appear. Apply the clamp after every pan, every zoom and every
window resize.

Cap the maximum scale at the point where one image pixel covers four stage
pixels (`scale <= 4 * minScale` is acceptable), so the user can't zoom into
mush.

### 8.3 Controls

- Drag with the mouse or one finger to pan.
- Wheel or pinch to zoom, centred on the pointer.
- A labelled `<input type="range">` for zoom.
- The stage takes focus with `tabindex="0"` and an `aria-label`.
  Arrow keys pan by 2% of the circle diameter. Shift plus an arrow key pans by
  10%. `+` and `-` change the zoom by 5% steps.

## 9. Logo placement

All the maths below happens in export space. Let `D` be the export square
size in pixels and `r = D / 2`. The circle centre is `(r, r)`.

### 9.1 Silhouette

Do this once per variant and cache the result.

1. Draw the PNG to an offscreen canvas at its natural size.
2. Read the pixel data. A pixel is opaque when `alpha > 8`.
3. Record the alpha bounding box. Call its size `aw` by `ah`.
4. Compute the convex hull of the opaque pixels. Store the hull vertices in
   coordinates normalised to the bounding box, so each vertex is in `[0,1]`.

Only hull vertices matter. The point furthest from any centre is always a hull
vertex, so the hull gives an exact answer and keeps the work small.

### 9.2 Scale

The logo is scaled by its visible artwork, not by the PNG canvas. Transparent
padding is ignored.

```
L = 0.30 * D                  // 30% of the circle diameter
k = L / max(aw, ah)           // scale factor
lw = aw * k,  lh = ah * k     // drawn size of the artwork
```

### 9.3 Position

The logo slides down the 45 degree line into the bottom-right of the circle.
It stops when its nearest opaque pixel touches a circle of radius `r - p`,
where `p = 0.02 * D`.

Let `u = (1/sqrt2, 1/sqrt2)`. Start with the artwork centred on the circle
centre. For a hull vertex at that start position, let `v` be its offset from
the circle centre. The vertex sits on the inset circle when:

```
|v + d*u|^2 = (r - p)^2
```

which gives a quadratic in `d`:

```
d^2 + 2*d*(v . u) + |v|^2 - (r - p)^2 = 0

d = -(v . u) + sqrt( (v . u)^2 - |v|^2 + (r - p)^2 )
```

Take the positive root for every hull vertex. The travel distance is the
smallest of those roots:

```
d_final = min over hull vertices of d
```

The artwork centre is then at `(r, r) + d_final * u`, and the draw origin is
that centre minus `(lw/2, lh/2)`.

If any discriminant is negative, the logo doesn't fit. That can't happen at
30% and a 2% inset, so treat it as a programming error and throw.

### 9.4 Draw

Draw the logo with `ctx.globalAlpha = 0.90`. Restore the alpha afterwards.

The opacity is fixed at 90%. It isn't a control.

## 10. Automatic variant choice

Run this once, when a photo loads and the initial transform is set. Don't run
it again while the user pans or zooms. A variant that changes during a drag
reads as a fault.

1. Render the crop to a small offscreen canvas, for example 128 x 128, without
   the logo.
2. Read the pixels that fall inside the logo's placement area.
3. Compute the mean WCAG relative luminance of those pixels.
4. Compute the contrast ratio of that luminance against the artwork colour of
   each variant: white `#ffffff`, navy `#06213e` and grey `#dde4e6`. These are
   the colours in the PNG files, not the brand palette. See section 5.1.
5. Select the variant with the highest ratio.

If the user changes the variant, the choice stays until a new photo loads.

## 11. Export

### 11.1 Size

The app never upscales. The export size is the number of real image pixels
across the square, capped at 1024:

```
available = floor(2R / scale)     // source pixels across the square
D = min(1024, available)
```

When `D < 1024`, show this note near the download button:

> This crop is <D>px. Zoom out or use a larger photo for a sharper result.

Always show the final size and file size beside the download button.

### 11.2 Render path

One function renders both the preview and the export:

```js
renderTo(ctx, size, state)
```

The preview calls it with the stage size times `devicePixelRatio`. The export
calls it with `D`. This is what keeps the preview and the file identical.

The export render adds nothing the preview lacks except the square corners.
The preview render adds the circular mask and the dim overlay.

Fill the canvas with white before drawing the photo. That covers any
transparency in a source PNG.

When the source region is much larger than `D`, downscale in halving steps on
an offscreen canvas before the final draw. A single large downscale in one
step gives a soft, aliased result.

### 11.3 Byte budget

Target: under 300 KB (307200 bytes).

1. Binary search the JPEG quality in `[0.40, 0.92]` with about 7 iterations.
   Use `canvas.toBlob(cb, 'image/jpeg', q)`. Keep the largest quality that
   produces a blob under the target.
2. If quality 0.40 is still over the target, reduce `D` through 896, 768, 640
   and 512, and search again at each size.

Download the blob as `hippo-profile-picture.jpg` with an object URL and a
temporary anchor. Revoke the URL afterwards.

## 12. Accessibility

- Every control has a visible label or an `aria-label`.
- The logo variant control is a real radio group, labelled "Logo colour".
- Focus is visible everywhere, 3px Navy Dark `#000522` with a 2px offset.
- Pan and zoom work from the keyboard. See section 8.3.
- A polite live region announces the export size and file size when they
  change.
- All text meets WCAG AA. See the warning in section 4.
- The layout is a single responsive column. It works at 320px wide.

## 13. Page copy

- Title: Hippoify your profile picture.
- One line under the title: Your photo stays in your browser. Nothing is
  uploaded.
- One line of instruction: Drag to move the photo. Scroll or pinch to zoom.

## 14. Tests

Unit tests only, on the pure functions in `src/geometry.js`. Use the node
built-in test runner (`node --test`). There is no browser test and no test
dependency.

`src/geometry.js` holds these pure functions:

| Function | Returns |
|---|---|
| `coverScale(iw, ih, square)` | the smallest scale that covers the square |
| `clampTransform(t, iw, ih, square)` | a transform with no gap |
| `exportSize(scale, squareStage, max)` | the export size, capped, never upscaled |
| `convexHull(points)` | hull vertices, counter-clockwise |
| `logoScale(aw, ah, diameter, fraction)` | the logo scale factor |
| `tangentOffset(hull, lw, lh, diameter, inset)` | the logo draw origin |
| `relativeLuminance(rgb)` | WCAG relative luminance |
| `contrastRatio(a, b)` | WCAG contrast ratio |

Write at least these cases:

1. `coverScale` returns the larger of the two ratios for a wide image and for
   a tall image.
2. `clampTransform` pulls a transform back when the image edge enters the
   square, and leaves a valid transform alone.
3. `exportSize` caps at 1024, and returns the available pixels when they are
   fewer than 1024.
4. `logoScale` uses the longest side. Check a wide artwork and a tall one.
5. `tangentOffset` with a square hull: every hull vertex lies within
   `r - inset` of the centre, and at least one vertex lies on that radius to
   within a small tolerance.
6. `tangentOffset` with a circular hull: the same two assertions. A round mark
   must sit closer to the edge than a square one of the same size. Assert that
   difference, because it is the reason silhouette tangency was chosen.
7. `tangentOffset` places the logo down and to the right. Both components of
   the offset from the centre are positive and equal.
8. `contrastRatio` returns 21 for black against white, and about 7.0 for
   `#002f26` against `#6db9ab`.

Drive the hull tests with synthetic shapes. Don't load the PNGs in a test.

## 15. Non-goals

Don't add these. Each one was considered and rejected.

- A rotation control. Browsers apply EXIF orientation.
- A HEIC decoder. It is 1 to 2 MB of WASM for a minority of users.
- A square preview or a preview toggle. The circle is the preview.
- Zooming out past cover, and a background colour choice behind the photo.
- Upscaling a small crop to 1024.
- A framework, a bundler or any runtime dependency.
- A browser test suite.
- Analytics of any kind.

## 16. Decisions and the reason for each

| Decision | Reason |
|---|---|
| Zero build | What is in the repository is what ships. There is no toolchain to rot. |
| Fixed circle, photo moves | Google, LinkedIn and Teams all work this way, so it needs no explanation. The output resolution stays constant. |
| Tight square, circle inscribed | Google and Microsoft crop their own circle from the square. A tight square makes the preview exact. |
| Three logo variants | Grey helps against a busy mid-tone background, where white glares and navy disappears. |
| Silhouette tangency | A bounding box corner is empty space on a round mark, which pushes the logo further from the edge than it needs to be. |
| 30% of the visible artwork | The logo then looks the same size whatever padding the PNG carries. |
| 2% inset | Antialiasing never clips, and there is slack if a platform crops a little tighter. |
| Clamp to cover | A gap is never wanted, so the app makes it unreachable. |
| Auto-suggest the variant once | It makes the right choice for most people. Re-running it during a drag looks like a fault. |
| Never upscale | An upscaled image invents no detail. It is only bigger, softer and heavier. |
| JPEG at 1024, under 300 KB | Every upload target accepts JPEG. 1024 stays sharp on a large avatar. |
| Unit tests on geometry only | A wrong formula is the likeliest fault. A browser suite was judged too much for this tool. |
| No licence file | The repository holds Hippo trademarks, which aren't the author's to license. |
