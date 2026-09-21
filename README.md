# Hippoify Profile

A single page that puts the Hippo logomark on a profile picture.

Choose a photo, move it in the circle, then download a square JPEG. The file
suits a Google or Microsoft profile picture.

The photo stays in the browser. The app doesn't send it anywhere, and it
doesn't have a server component.

## How it works

1. Supply a photo with the file picker, drag and drop, or a clipboard paste.
   The app takes JPEG, PNG and WebP.
2. The photo covers the circle at the smallest scale that leaves no gap.
3. The app measures the photo behind the logo and selects the logo colour with
   the most contrast. You can change the colour.
4. Move the photo with a drag, the arrow keys, or a pan with two fingers.
   Change the zoom with the wheel, a pinch, the slider, or the `+` and `-`
   keys.
5. Download `hippo-profile-picture.jpg`.

The export is a square, and the circle fits exactly inside it. Google and
Microsoft cut their own circle out of the square, so the preview shows what
you get.

The export is 1024 x 1024 pixels, or smaller if the crop holds fewer real
pixels. The app doesn't upscale. It keeps the file below 300 KB.

HEIC doesn't work. Chrome and Firefox can't decode it. Export an iPhone photo
as JPEG first.

## Run it locally

The app uses ES modules. They need an HTTP origin, so `file://` doesn't work.

```sh
python3 -m http.server
```

Then open `http://localhost:8000`.

## Tests

The unit tests cover the pure functions in `src/geometry.js`, which hold the
formulas. They use the Node test runner and they don't have a dependency.

```sh
node --test
```

## What is in the repository

| Path | Holds |
|---|---|
| `index.html` | the page |
| `styles.css` | the brand palette, the layout and the self-hosted fonts |
| `src/main.js` | the DOM, the events and the app state |
| `src/cropper.js` | the transform state, the pan and the zoom |
| `src/geometry.js` | the pure formulas, unit tested |
| `src/logo.js` | the logomark PNGs and their silhouettes |
| `src/render.js` | the one render path, for the preview and the export |
| `src/colour.js` | luminance, contrast and the logo colour choice |
| `src/export.js` | the JPEG size search and the download |
| `assets/` | the logomark PNGs and DM Sans |
| `PLAN.md` | every decision, and the reason for each |

There is no build step and no runtime dependency. What the repository holds is
what the site serves. The `.nojekyll` file stops Jekyll from touching it.

`assets/fonts/OFL.txt` is the DM Sans licence. The SIL Open Font License
requires it to stay with the font files.

The repository holds Hippo trademarks, which aren't the author's to license, so
it doesn't hold a licence file.

## Continuous integration

Two workflows sit in `.github/workflows/`.

- `test.yml` runs `node --test` on a push to a branch and on a pull request.
- `deploy.yml` runs the same tests on a push to `main`, then it copies the site
  files and deploys them to GitHub Pages. The deployment leaves out the tests,
  the plan and the workflow files.

The Pages source must be **GitHub Actions**, in Settings > Pages. A branch
source stops the workflow from deploying.

## Notes on the plan

The build follows `PLAN.md`. Three points need a note, and each one is small.

- **`package.json`.** The plan doesn't list it. It holds `"type": "module"`
  only, so the Node test runner reads the `.js` files as ES modules without a
  warning. It doesn't add a dependency and the browser doesn't read it.
- **The clamp.** The plan gives `src/cropper.js` the clamping, and section 14
  gives `clampTransform` to `src/geometry.js`. The formula sits in
  `src/geometry.js`, where the unit tests reach it. `src/cropper.js` applies it
  after every pan and every zoom.
- **The contrast of the download button.** The plan says the Turquoise
  `#6db9ab` and Turquoise Darkest `#002f26` pair gives about 7:1. The WCAG
  formula gives 6.40:1. The pair still passes WCAG AA for text of every size,
  so the button is unchanged. `test/geometry.test.js` asserts the true figure.
