# PackMate

**Parametric packaging dielines for hobby cutting machines and print shops.**

Pick a box, mailer, bag or envelope and type the size you need. PackMate draws the unfolded
dieline as clean vector cut and crease lines on a cutting mat, folds it in 3D so you can check it,
and exports files for **Brother ScanNCut**, **Cricut**, **Silhouette**, cutting plotters and print
shops. Your dielines and folders are kept on your own device: there is no account and no server.

## Use it

| Where | How |
| --- | --- |
| **Online** | Open the GitHub Pages site (see *Deploy* below). |
| **macOS, Windows, Linux** | Open the site in Chrome or Edge and choose *Install PackMate* in the address bar (Safari: *File > Add to Dock*). It then runs in its own window and works offline. |
| **Android / iPhone** | Open the site in the browser and choose *Install app* / *Add to Home Screen*. |
| **NAS or home server** | `docker run -d -p 8080:80 ghcr.io/<owner>/packmate:latest`, or `docker compose up -d` in this repo, then open `http://<your-nas>:8080`. The image supports amd64 and arm64. |

Data lives in the browser's own storage (IndexedDB) for the address you use, so the Pages site and
your NAS keep separate libraries.

## What it does today (milestone 1)

- **Workspace:** a projects tree with folders (create, rename, move, duplicate, delete), the dieline
  on a cutting mat with cut / crease / glue / label layers and the outline of your machine's mat,
  and a configuration column generated from the template.
- **3D fold view** with a fold slider, play button, a shadow that follows the box, and a swap
  between the big view and the inset.
- **8 generators:** Reverse and Straight Tuck End boxes, Mailer Box (flip-top), Locking Tray,
  Pillow Box, Gable Box with handle, Card Envelope and Gusseted Paper Bag.
- **Materials:** kraft, white, black and E-flute presets; the thickness feeds the geometry.
- **Export** to **SVG** (real millimetres, separate cut and crease layers), **PDF** (layers) and
  **DXF R12**. Creases can go on their own layer, become perforated cuts (for machines without a
  scoring tool) or be left out. Chrome and Edge open a native *Save as* dialog; other browsers
  download.
- **Settings:** units (mm or inches), your machine, custom mat sizes, light / dark theme, six accent
  colours, English and Slovak.
- Installable, offline, responsive down to phone width.

Coming next: a full Materials library with textures, a sync folder and backup / restore, more
generators, desktop installers, and splitting large dielines across sheets.

### Tips for your machine

- **Brother ScanNCut** (CanvasWorkspace): import the SVG. Without an embossing or scoring tool,
  export with *Perforated* creases; otherwise set the crease layer to *Draw* with a pen as a guide.
- **Cricut** (Design Space): upload the SVG, select the crease layer, set it to **Score**, then
  select both layers and **Attach** them.
- **Silhouette Studio:** use *Cut by line color*: red is cut, blue is score or perforate.

## Architecture

```
crates/
  dieline-core/   Rust: geometry, 8 parametric templates, fold model, layout/tiling, SVG/PDF/DXF writers
  dieline-wasm/   wasm-bindgen facade (JSON in / JSON out)
app/              React + TypeScript + Vite UI, three.js fold view, PWA (hash routes, relative URLs)
  src-tauri/      Tauri 2 shell (dormant: the desktop story is the installable PWA for now)
docker/           Static nginx image for NAS / servers
```

All geometry runs on the client (Rust compiled to WebAssembly), so there is no backend.
Templates implement one trait:

```rust
pub trait Template: Sync {
    fn info(&self) -> TemplateInfo;      // id, name, category, description, tags
    fn params(&self) -> Vec<ParamDef>;   // UI form schema (lengths, choices, toggles)
    fn build(&self, p: &Params) -> Dieline; // cut/crease paths + panel fold tree
}
```

A `Dieline` holds:

- tagged vector paths: cut, crease and perforation, as lines and cubic Béziers in mm;
- a **panel tree**: each panel has a hinge line and fold angle. The 3D preview uses this tree
  to fold the flat layout with no template-specific UI code.

Every template is tested to check that:

- it produces exactly one closed, non-self-intersecting outline;
- no crease runs along a cut;
- the flat size matches the dimension maths;
- the fold model folds to the entered size (checked in the front-end tests).

## Development

Requirements:

- Rust stable with the `wasm32-unknown-unknown` target
- [`wasm-pack`](https://rustwasm.github.io/wasm-pack/) 0.15
- Node 22 and pnpm 10

```bash
cd app
pnpm install
pnpm dev          # builds the WASM engine, then starts Vite on http://localhost:5173
```

```bash
cargo test --workspace              # geometry, templates, exporters
cd app && pnpm build && pnpm test   # type-check, production build, unit tests
cd app && pnpm e2e                  # Playwright end-to-end test (needs a Chromium)
```

Write every template's default dieline to SVG files:

```bash
cargo run -p dieline-core --example export_all -- out/
```

### Desktop and Android (Tauri)

Install the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS, then:

```bash
cd app
pnpm tauri dev      # desktop window with hot reload
pnpm tauri build    # installers in app/src-tauri/target/release/bundle
```

Android needs the Android SDK/NDK and `rustup target add aarch64-linux-android armv7-linux-androideabi`:

```bash
pnpm tauri android init
pnpm tauri android build --apk
```

`.github/workflows/release.yml` can build the installers into a draft release. It runs only when you
start it by hand.

### Docker / NAS

```bash
docker compose up -d       # → http://<host>:8080
```

The image is a static nginx site of about 25 MB. It needs no database and no outbound network
access. CI publishes it to `ghcr.io/<owner>/packmate` for amd64 and arm64 (make the package public
in the repository's package settings if you want to pull it without logging in).

### GitHub Pages

Set **Settings > Pages > Source** to *GitHub Actions*. Every push to `main` then builds and deploys
the site to `https://<owner>.github.io/<repo>/`. The build uses relative URLs, so the sub-path just
works.

## Adding a template

1. Create `crates/dieline-core/src/templates/<name>.rs`:
   - Implement `Template`.
   - Draw the outline clockwise with `Contour`. Use `Edge` and `push_profile` for flaps; the
     shared `lid_with_tuck`, `dust_flap` and `glue_flap` helpers cover common cases.
   - Add creases with `Dieline::crease`.
   - Describe the folds with `Dieline::root` / `Dieline::fold`.
2. Register it in `templates/mod.rs`.
3. Add a test that calls `testutil::check`.

The generator list, form, 3D view and exporters pick it up automatically. Add its English name and
description to `app/src/i18n/en.ts` (`tpl.<id>.name` / `.desc`) and the Slovak text to `sk.ts`; without them the
app falls back to the engine's English text.

## Roadmap

- FCM export for ScanNCut, and print-then-cut registration marks
- Artwork upload onto panels, and a printable PDF with artwork and bleed
- More styles: hexagon box, pyramid, sleeve, crash-lock bottom, inserts and dividers
- Smarter nesting (interlocking outlines rather than bounding boxes)
