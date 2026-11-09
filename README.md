# PackMate

Generates paper box dielines as SVG. The generator core is written in Rust and
shared by every platform:

| Path | What it is |
| --- | --- |
| `crates/packmate-core` | Platform-independent dieline generator (pure Rust, no dependencies) |
| `crates/packmate-wasm` | WebAssembly bindings, used by the web UI |
| `app/` | Svelte + TypeScript UI, packaged as a web app and, via Tauri 2 (`app/src-tauri`), as desktop (macOS, Windows, Linux) and mobile (Android, iOS) apps |
| `Dockerfile` | Self-hosted web app image (static files served by nginx on port 8080) |

## Prerequisites

- Rust (stable) with `rustup target add wasm32-unknown-unknown`
- `cargo install --locked wasm-pack`
- Node 22 and pnpm 10 (`corepack enable`)
- For desktop builds, the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS

## Common commands

```bash
cargo test --workspace                          # core tests
cargo clippy --workspace --all-targets -- -D warnings
cd app && pnpm install
pnpm dev                                        # web app at http://localhost:1420
pnpm build                                      # static web app in app/build
pnpm check                                      # Svelte/TypeScript checks
pnpm tauri dev                                  # desktop app
pnpm tauri build                                # desktop installers
pnpm tauri android init && pnpm tauri android build   # needs Android SDK/NDK
```

## Docker

```bash
docker build -t packmate .
docker run -p 8080:8080 packmate
```

## License

GPL-3.0-or-later
