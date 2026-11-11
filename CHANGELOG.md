# Changelog

## v0.1.0 - 2026-11-11

The first public release of PackMate: packaging dielines for your cutting machine.

### What you get

- **18 generators**, most of them glue-free: tuck-end, tuck-lock and snap-lock boxes, mailer, locking tray,
  lid-and-base box, drawer box (matchbox), sleeve, slotted dividers, compartment tray, hexagon/polygon box,
  pyramid, cylinder box, pillow box, gable box, card envelope and gusseted bag.
- **Workspace** with folders, a dieline on a cutting mat that shows your machine's mat, a live **3D fold view**
  with a fold slider, and multi-part boxes that assemble in the preview.
- **Export** to SVG, PDF (layers) and DXF with machine-aware crease handling.
- **Materials library** with thickness, colour and textures for the 3D preview.
- **Backup and restore** as one zip, and a **sync folder** (Chrome and Edge on a computer).
- Light and dark themes, six accent colours, English and Slovak, installable PWA that works offline.

### Downloads

- **Desktop:** macOS (universal `.dmg`), Windows (`.msi` and `.exe` installer), Linux (`.AppImage`, `.deb`, `.rpm`).
- **Docker:** `ghcr.io/grafffooo/packmate:0.1.0` (also `latest`), for amd64 and arm64.
- **Web:** <https://grafffooo.github.io/PackMate/>, or the `packmate-web` zip below to host it yourself.
- `SHA256SUMS.txt` lists checksums for every file.

### First launch of the desktop installers

The installers are **not signed** yet, so your system asks for confirmation once:

- **macOS:** right-click the app and choose **Open**, then **Open** again (or System Settings > Privacy & Security > **Open Anyway**).
- **Windows:** if *Windows protected your PC* appears, click **More info**, then **Run anyway**.
- **Linux:** make the `.AppImage` executable (`chmod +x`), or install the `.deb`/`.rpm` with your package manager.

### Known limits

- The desktop installers have been built by CI but not yet tried on real macOS and Windows machines. Please report problems.
- Folder sync needs a Chromium browser (Chrome, Edge) and is not available in the desktop app yet; use backup and restore there.
- The Slovak translation is machine-assisted and awaiting review.
- Not yet possible: your own artwork and print-and-cut PDFs, laser-cut (finger-joint) boxes, more languages. See the [roadmap](docs/ROADMAP.md).
