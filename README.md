# PackMate

**Parametric packaging dielines for hobby cutting machines and print shops.**

Choose a box, mailer, bag or envelope from the gallery and type the size you need. PackMate
generates the unfolded dieline as clean vector cut and crease lines, shows a live 3D fold preview,
and exports files ready for **Brother ScanNCut**, **Cricut**, **Silhouette**, cutting plotters and
print shops.

It runs everywhere from one codebase:

| Where | How |
| --- | --- |
| Any browser, desktop or mobile | Static web app (installable PWA, works offline) |
| NAS / home server | `docker compose up -d` |
| macOS, Windows, Linux | Tauri desktop app |
| Android | Tauri Android app, or install the PWA from Chrome |

## Features

- **Template gallery** with search and category filters: Reverse and Straight Tuck End boxes,
  Mailer Box (flip-top), Locking Tray, Pillow Box, Gable Box with handle, Card Envelope and
  Gusseted Paper Bag.
- **Dimension-driven editor.** Enter length, width and height as inside or outside dimensions.
  Material thickness is compensated automatically, using a preset (cardstock, kraft, chipboard,
  corrugated) or your own measured value.
- **mm or inches.** Inch fields accept fractions such as `3 1/2` and suffixes such as `40mm`
  or `2in`. Arrow keys nudge the value; hold Shift for ×10.
- **Live 3D fold preview** with a fold slider, a play animation, and kraft or white board.
- **2D dieline view** with pan, zoom and pinch; cut, crease, glue-area and label layers; overall
  dimensions; and the outline of your machine's mat.
- **Machine-aware export:**
  - Formats:
    - **SVG** in real millimetres, with one layer each for cut, crease and perforation.
      CanvasWorkspace and Design Space keep these as separate layers.
    - **PDF** with optional-content layers, for print shops and Illustrator.
    - **DXF R12**, for plotters, laser cutters and CAD.
  - **Machine profiles:** ScanNCut 12×12/12×24, Cricut 12×12/12×24/Joy Xtra, Silhouette,
    A4/Letter/A3, and the SRA3/B2/B1 print sheets.
  - **Fit check.** The app tells you whether the design fits your mat and rotates it 90° if
    that helps.
  - **Nesting.** Several copies are placed on one sheet.
  - **Tiling.** Designs bigger than the mat are split into tiles with a 10 mm overlap.
  - **Crease handling:**
    - creases on their own layer, for a scoring wheel, stylus or pen;
    - converted to perforated cuts, for machines without a scoring tool such as most ScanNCut
      setups;
    - or left out.
  - **Cut order.** Score lines and inner holes are cut before the outline, so the piece doesn't
    shift on the mat.
- **Saved designs and share links.** The URL always encodes the current design, and you can keep
  named designs on the device.

### Tips for your machine

- **Brother ScanNCut** (CanvasWorkspace):
  1. Import the SVG.
  2. If you have no embossing or scoring tool, export with *Perforated cut* creases.
  3. Otherwise, set the crease layer to *Draw* with a pen as a fold guide.
- **Cricut** (Design Space):
  1. Upload the SVG.
  2. Select the blue crease layer and set its operation to **Score**.
  3. Select both layers and **Attach** them.
- **Silhouette Studio:** use *Cut by line color*: red is cut, blue is score or perforate.

## Architecture

```
crates/
  dieline-core/   Rust: geometry, 8 parametric templates, fold model, layout/tiling, SVG/PDF/DXF writers
  dieline-wasm/   wasm-bindgen facade (JSON in / JSON out)
app/              React + TypeScript + Vite UI, three.js fold preview, PWA
  src-tauri/      Tauri 2 shell for desktop and Android
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
cd app && pnpm build && pnpm test   # type-check, production build, fold-model tests
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

Pushing a `v*` tag runs `.github/workflows/release.yml`, which builds macOS, Windows and Linux
installers into a draft GitHub release.

### Docker / NAS

```bash
docker compose up -d       # → http://<host>:8080
```

The image is a static nginx site of about 25 MB. It needs no database and no outbound network
access.

## Adding a template

1. Create `crates/dieline-core/src/templates/<name>.rs`:
   - Implement `Template`.
   - Draw the outline clockwise with `Contour`. Use `Edge` and `push_profile` for flaps; the
     shared `lid_with_tuck`, `dust_flap` and `glue_flap` helpers cover common cases.
   - Add creases with `Dieline::crease`.
   - Describe the folds with `Dieline::root` / `Dieline::fold`.
2. Register it in `templates/mod.rs`.
3. Add a test that calls `testutil::check`.

The gallery, form, 3D preview and exporters pick it up automatically.

## Roadmap

- FCM export for ScanNCut, and print-then-cut registration marks
- Artwork upload onto panels, and a printable PDF with artwork and bleed
- More styles: hexagon box, pyramid, sleeve, crash-lock bottom, inserts and dividers
- Smarter nesting (interlocking outlines rather than bounding boxes)
