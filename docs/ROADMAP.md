# Roadmap

What's done (see [CHANGELOG](../CHANGELOG.md)) and what's planned. Plans change; each milestone has a
tracking issue on GitHub where you can comment.

## Done

- **Milestone 1: workspace.** Projects and folders, dieline on a cutting mat, 3D fold view, export to
  SVG/PDF/DXF, English and Slovak, installable PWA, GitHub Pages and Docker.
- **Milestone 2: materials, backup and sync.** Materials library with textures, backup and restore as
  one zip, two-way sync folder.
- **Milestone 3: more generators.** 18 generators, most of them glue-free, including multi-part boxes
  and dividers.

## Milestone 4: laser-cut boxes (boxes.py)

Tracking issue: [#2](https://github.com/grafffooo/PackMate/issues/2)

Boxes for rigid material (wood, acrylic, MDF) with finger joints and kerf compensation, exported as
SVG/DXF for laser cutters, alongside the paper and card boxes.

- **Approach to settle with a spike first:**
  - run [boxes.py](https://github.com/florianfesti/boxes) (GPL-3.0+, compatible with PackMate) in the
    browser through Pyodide in a Web Worker: literal reuse of its many generators, works offline, but
    adds a Python runtime download and needs its dependencies to run in Pyodide;
  - or port the most-used generators to Rust: faster and smaller, but fewer generators and more work.
- A "Laser cut" category; the parameter form generated from the generator's settings.
- Kerf, tab width and board thickness in the materials library.
- Preview of the flat parts; SVG and DXF export with the right line colours for common laser software.

## Milestone 5: more languages

Tracking issue: [#3](https://github.com/grafffooo/PackMate/issues/3)

- Make adding a language a one-file job: translation guide, parity and plural tests (already in place),
  right-to-left check.
- First candidates: German, French, Spanish, Italian, Czech, Polish, Portuguese, Dutch. Tell us which
  you need first.
- Translate machine names' tips and template texts, not only the interface.

## Milestone 6: your own designs and print-and-cut PDFs

Tracking issue: [#4](https://github.com/grafffooo/PackMate/issues/4)

- Upload artwork (PNG, JPG, SVG, PDF) to a project.
- Place it on the dieline: per panel or across the whole dieline, with fit, fill, offset and rotation.
- See the artwork on the 3D box.
- Export a PDF with the artwork, a cut-contour layer and registration marks for Cricut Print Then Cut,
  Brother ScanNCut and Silhouette, with bleed and your sheet size.
- Artwork is stored with the project and included in backups and sync.

## Milestone 7: more box shapes

Tracking issue: [#5](https://github.com/grafffooo/PackMate/issues/5)

- Crash-lock bottom (needs a verified reference dieline).
- Heart, cone, trapezoid and triangular prisms.
- Bottle and wine box, cupcake box, book-style box, pizza box, display box with hang tab.
- Window cut-out on the mailer, more bag and envelope styles.

## Ideas

- Smarter nesting (interlocking outlines instead of bounding boxes).
- FCM export for ScanNCut.
- Folder sync in the desktop apps.
- Code signing and notarization of the desktop installers.
