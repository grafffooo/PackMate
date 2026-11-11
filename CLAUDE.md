# PackMate: notes for Claude Code

PackMate generates parametric packaging dielines (cut, crease and fold lines) for hobby cutting machines
and print shops. Rust engine compiled to WebAssembly (`crates/`), React + TypeScript app (`app/`),
installable PWA, Docker image and Tauri desktop shell. Everything runs on the client; data is local-first.

Full technical documentation: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Plans: [docs/ROADMAP.md](docs/ROADMAP.md).

## Commands

```bash
cargo test --workspace && cargo clippy --all-targets -- -D warnings && cargo fmt --all --check
cd app && pnpm wasm            # rebuild the engine after any Rust change (vitest and e2e load app/wasm)
cd app && npx tsc -b && npx vitest run
cd app && pnpm build:web && PW_CHROMIUM=/opt/pw-browsers/chromium pnpm e2e
```

## Gotchas

- `app/wasm/` is build output; run `pnpm wasm` before vitest or Playwright, or tests see old templates.
- `vite preview` serves `app/dist/`; the e2e config reuses a running server on port 4173, so rebuild
  `dist` (`pnpm build:web`) before e2e, or you test stale code.
- pnpm must be v10 (Docker pins it; newer majors reject fresh lockfile entries).
- Prettier reformats whole files: only run it on files you changed (`npx prettier --write <paths>`), then
  `git checkout` anything that got reformatted by accident.
- Translations: every key in `app/src/i18n/en.ts` needs a Slovak entry in `sk.ts`; new templates need
  `tpl.<id>.name/.desc` and parameter labels (tests enforce this and check English matches the engine).
- Every template carries exactly one tag, `no glue` or `needs glue`.
- Headless Chromium has no real save dialog: e2e tests delete `showSaveFilePicker` to use the download fallback.

## Working style

- Develop on the branch you are given, commit with clear messages, and end commits with the
  `Co-Authored-By` and `Claude-Session` trailers from the session instructions.
- Don't open pull requests or merge to `main` unless asked. Releases are tags on `main` (see DEVELOPMENT.md).
- Check UI changes in the real app with Playwright screenshots, not only with tests.
