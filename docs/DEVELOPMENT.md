# Developing PackMate

Technical notes for contributors. For what PackMate is and how to use it, see the [README](../README.md).

## Architecture

```
crates/
  dieline-core/   Rust: geometry, parametric templates, fold model, layout/tiling, SVG/PDF/DXF writers
  dieline-wasm/   wasm-bindgen facade (JSON in / JSON out)
app/              React + TypeScript + Vite UI, three.js fold view, PWA (hash routes, relative URLs)
  src/            app code (see "Front end" below)
  src-tauri/      Tauri 2 shell: the desktop installers for macOS, Windows and Linux
  e2e/            Playwright end-to-end tests
docker/           Static nginx image for NAS / servers
docs/             this file, the roadmap, screenshots
```

All geometry runs on the client (Rust compiled to WebAssembly), so there is no backend. Data is
local-first (IndexedDB), with optional backup archives and a two-way sync folder.

### The engine

Templates implement one trait:

```rust
pub trait Template: Sync {
    fn info(&self) -> TemplateInfo;      // id, name, category, description, tags
    fn params(&self) -> Vec<ParamDef>;   // UI form schema (lengths, numbers, choices, toggles)
    fn build(&self, p: &Params) -> Dieline; // cut/crease paths + panel fold tree
}
```

A `Dieline` holds:

- tagged vector paths: cut, crease and perforation, as lines and cubic Béziers in mm;
- a **panel tree**: each panel has a hinge line and fold angle. The 3D preview uses this tree to
  fold the flat layout with no template-specific UI code;
- optional **parts**: several loose pieces in one dieline. A part's root panel can carry an
  `assembly` (rotate/move steps) that the 3D preview plays when you move the fold slider;
- `upright`: set for tube-like packages whose axis is the layout's y axis.

Every template carries exactly one tag, `no glue` or `needs glue`, which the UI shows.

Tests (`crates/dieline-core/src/templates/mod.rs`, `testutil::check` / `check_parts`) verify for every
template that:

- each part has one closed, non-self-intersecting outline and parts don't overlap;
- no crease runs along a cut, and every crease lies inside an outline;
- the panel tree is consistent (parents come first, only part roots have an assembly);
- the template carries a glue tag;
- the flat size matches the dimension maths (per-template tests).

The front-end tests additionally fold the panel tree and check the result (`app/src/fold.test.ts`).

### Front end (`app/src`)

| Folder | What |
| --- | --- |
| `core.ts` | typed wrapper around the WASM engine |
| `fold.ts` | turns the panel tree and assemblies into 3D matrices |
| `theme/` | six accent palettes, light/dark generation, CSS variables |
| `i18n/` | flat-key catalogs `en.ts` (source) and `sk.ts`; tests check parity, key usage and template texts |
| `storage/` | IndexedDB repo (schema v2), data model, backup zip, bundle and merge logic shared with sync |
| `state/` | zustand library store |
| `sync/` | two-way folder sync engine and manager (File System Access API) |
| `ui/` | workspace, project tree, config panel, dieline and 3D views, dialogs, materials library |
| `save.ts` | native Save dialog where the platform has one, download fallback, Web Share |

Routing is hash based (`#/`, `#/new`, `#/export`, `#/materials/<id>`, `#/settings/<section>`) and
every URL is relative, so the app works from a sub-path (GitHub Pages) or behind a proxy.

## Requirements

- Rust stable with the `wasm32-unknown-unknown` target
- [`wasm-pack`](https://rustwasm.github.io/wasm-pack/) 0.15
- Node 22 and **pnpm 10** (newer pnpm majors apply a release-age policy that rejects fresh lockfile entries)

## Everyday commands

```bash
cd app
pnpm install
pnpm dev          # builds the WASM engine, then starts Vite on http://localhost:5173
```

```bash
cargo test --workspace                 # geometry, templates, exporters
cargo clippy --all-targets -- -D warnings
cargo fmt --all --check
cd app && pnpm wasm                    # rebuild the engine (needed before vitest/e2e after Rust changes)
cd app && pnpm build && pnpm test      # type-check, production build, unit tests
cd app && pnpm e2e                     # Playwright end-to-end tests
```

Playwright needs a Chromium. If the bundled one doesn't match, point at an installed one:
`PW_CHROMIUM=/path/to/chromium pnpm e2e`. The e2e config starts `vite preview` and **reuses a server
that is already running on port 4173, which serves whatever is in `dist/`**; rebuild (`pnpm build:web`)
before running e2e against a long-lived preview server.

Write every template's default dieline to SVG files:

```bash
cargo run -p dieline-core --example export_all -- out/
```

## Adding a template

1. Create `crates/dieline-core/src/templates/<name>.rs` and implement `Template`.
   - Draw the outline clockwise with `Contour`. Use `Edge` and `push_profile` for flaps; shared helpers
     in `templates/mod.rs` cover the common cases: `lid_with_tuck`, `dust_flap`, `glue_flap`,
     `end_flap`, `lock_flap` + `lock_slit` (tongue-and-slit seams), `slit`, `window`, `tube_panels`.
   - Add creases with `Dieline::crease`.
   - Describe the folds with `Dieline::root` / `Dieline::fold` (positive angles fold towards the inside).
   - For several loose pieces, build each into the same `Dieline` (or build sub-dielines with
     `generate` and `Dieline::absorb` them), then call `Dieline::assemble` on each part's root panel.
   - Tag it `"no glue"` or `"needs glue"`.
2. Register it in `templates/mod.rs` (`ALL`).
3. Add tests with `testutil::check` (one piece) or `check_parts` (several pieces), including extreme sizes.
4. Add texts: `tpl.<id>.name`, `tpl.<id>.desc`, `p.<param>` (or `p.<id>.<param>` when the label differs
   from other templates using the same parameter id), `cat.<category>` in `app/src/i18n/en.ts` and
   `sk.ts`. `app/src/i18n/templates.test.ts` fails if anything is missing or if the English text
   differs from the engine's label.
5. Rebuild the engine (`pnpm wasm`), open the app, check the flat view and the 3D fold, and take a
   look at it folded, half folded and flat.

## Docker / NAS

```bash
docker compose up -d       # → http://<host>:8080
docker build -f docker/Dockerfile -t packmate .
```

The image is a static nginx site of about 25 MB. It needs no database and no outbound network access.
CI (`.github/workflows/docker.yml`) builds amd64 and arm64 and pushes to `ghcr.io/<owner>/packmate`
on pushes to `main` (tag `latest`) and on `v*` tags (tags `0.1.0`, …). Make the package public in the
repository's package settings if it should be pullable without logging in.

## GitHub Pages

Set **Settings > Pages > Source** to *GitHub Actions*. Every push to `main` builds and deploys the
site to `https://<owner>.github.io/<repo>/` (`.github/workflows/pages.yml`).

## Desktop app (Tauri)

Install the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS, then:

```bash
cd app
pnpm tauri dev      # desktop window with hot reload
pnpm tauri build    # installers in app/src-tauri/target/release/bundle
```

Inside the desktop shell, files are saved through the native Save dialog (`@tauri-apps/plugin-dialog`
and `plugin-fs`, see `app/src/save.ts`); the service worker is not registered and folder sync is
unavailable (it needs the Chromium File System Access API).

Android needs the Android SDK/NDK and `rustup target add aarch64-linux-android armv7-linux-androideabi`:

```bash
pnpm tauri android init
pnpm tauri android build --apk
```

## Releases

Pushing a tag `v*` runs `.github/workflows/release.yml`, which builds the desktop installers on macOS
(universal), Ubuntu and Windows, attaches a static web build and checksums, and publishes the GitHub
release with the notes from `CHANGELOG.md`. The same tag makes `docker.yml` publish the image tags.
The workflow can also be started by hand (`workflow_dispatch`) with a tag name and *draft* enabled for
a dry run. Installers are **not signed or notarized**; the README explains the first-launch steps.

Before tagging: update the version in `app/src-tauri/tauri.conf.json`, `app/src-tauri/Cargo.toml`,
`app/package.json` and the workspace `Cargo.toml`, and add a section to `CHANGELOG.md`.

## Screenshots

`app/scripts/screenshots.mjs` regenerates every image in `docs/screenshots/` from the real app
(seeded through the UI, English, 1440×900): build first (`pnpm build:web`), start `pnpm preview --port 4173`,
then `node scripts/screenshots.mjs`.

## Conventions

- Commits end with the `Co-Authored-By` and `Claude-Session` trailers when written with Claude Code.
- Keep the English catalog as the source; every key must exist in Slovak (tests enforce it).
- Don't run Prettier over files you didn't change; it reformats the whole file.
