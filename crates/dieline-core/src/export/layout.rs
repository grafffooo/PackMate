//! Placing artwork on machine mats / sheets: crease handling, nesting copies and tiling.

use crate::dieline::Dieline;
use crate::geom::{pt, BBox, LineKind, Path, Pt};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum CreaseMode {
    /// Creases on their own layer (assign "Score" / "Draw" in the machine software).
    #[default]
    Layer,
    /// Creases converted to short through-cuts — for machines without a scoring tool.
    Dashed,
    /// Leave creases out.
    Omit,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub struct Sheet {
    pub w: f64,
    pub h: f64,
    #[serde(default)]
    pub margin: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(default)]
pub struct LayoutOptions {
    pub crease_mode: CreaseMode,
    pub dash: f64,
    pub gap: f64,
    /// None = page sized to the artwork.
    pub sheet: Option<Sheet>,
    pub copies: u32,
    /// Spacing between nested copies.
    pub spacing: f64,
    /// Overlap between tiles when the design is bigger than the sheet.
    pub tile_overlap: f64,
    /// Margin around the artwork when no sheet is given.
    pub page_margin: f64,
}

impl Default for LayoutOptions {
    fn default() -> Self {
        LayoutOptions {
            crease_mode: CreaseMode::Layer,
            dash: 2.0,
            gap: 2.0,
            sheet: None,
            copies: 1,
            spacing: 4.0,
            tile_overlap: 10.0,
            page_margin: 5.0,
        }
    }
}

#[derive(Clone, Debug)]
pub struct Page {
    pub w: f64,
    pub h: f64,
    pub paths: Vec<Path>,
    /// e.g. "sheet-2" or "tile-r1-c2"; empty for a single page.
    pub suffix: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct FitInfo {
    pub fits: bool,
    pub rotated: bool,
    pub per_sheet: u32,
    pub tiles: u32,
}

/// Paths ready for output: creases converted per mode, sorted for cutting (scores first, inner
/// holes before the outline so the piece doesn't shift on the mat).
pub fn machine_paths(d: &Dieline, opts: &LayoutOptions) -> Vec<Path> {
    let mut out: Vec<Path> = Vec::new();
    for p in &d.paths {
        match (p.kind, opts.crease_mode) {
            (LineKind::Crease, CreaseMode::Omit) => {}
            (LineKind::Crease, CreaseMode::Dashed) => {
                out.extend(dashes(p, opts.dash.max(0.2), opts.gap.max(0.2)));
            }
            _ => out.push(p.clone()),
        }
    }
    let rank = |k: LineKind| match k {
        LineKind::Crease => 0,
        LineKind::Perforation => 1,
        LineKind::Cut => 2,
    };
    out.sort_by(|a, b| {
        rank(a.kind).cmp(&rank(b.kind)).then(
            a.bbox()
                .area()
                .partial_cmp(&b.bbox().area())
                .unwrap_or(std::cmp::Ordering::Equal),
        )
    });
    out
}

/// Split a path into dashes (kind = Perforation).
pub fn dashes(p: &Path, dash: f64, gap: f64) -> Vec<Path> {
    let pts = p.flatten(0.05);
    let total: f64 = pts.windows(2).map(|w| w[0].dist(w[1])).sum();
    if total <= dash {
        return vec![p.clone().with_kind(LineKind::Perforation)];
    }
    // centre the pattern so both ends get a cut
    let n = ((total - dash) / (dash + gap)).floor();
    let period = (total - dash) / n.max(1.0);
    let dash = dash.min(period * 0.75);
    let mut out = Vec::new();
    let mut s = 0.0;
    while s <= total - dash + 1e-6 {
        let seg = sub_polyline(&pts, s, s + dash);
        if seg.len() >= 2 {
            out.push(Path::polyline(LineKind::Perforation, &seg, false));
        }
        s += period;
    }
    out
}

fn sub_polyline(pts: &[Pt], s0: f64, s1: f64) -> Vec<Pt> {
    let mut out = Vec::new();
    let mut acc = 0.0;
    for w in pts.windows(2) {
        let l = w[0].dist(w[1]);
        let (a, b) = (acc, acc + l);
        if b >= s0 && a <= s1 && l > 0.0 {
            let t0 = ((s0 - a) / l).clamp(0.0, 1.0);
            let t1 = ((s1 - a) / l).clamp(0.0, 1.0);
            let p0 = w[0].lerp(w[1], t0);
            if out.last().map(|q: &Pt| !q.near(p0, 1e-9)).unwrap_or(true) {
                out.push(p0);
            }
            out.push(w[0].lerp(w[1], t1));
        }
        acc = b;
        if acc > s1 {
            break;
        }
    }
    out
}

fn grid(uw: f64, uh: f64, bw: f64, bh: f64, sp: f64) -> u32 {
    if bw > uw + 1e-6 || bh > uh + 1e-6 {
        return 0;
    }
    let cols = ((uw + sp) / (bw + sp)).floor().max(1.0);
    let rows = ((uh + sp) / (bh + sp)).floor().max(1.0);
    (cols * rows) as u32
}

pub fn fit(bb: &BBox, sheet: &Sheet, spacing: f64, overlap: f64) -> FitInfo {
    let (uw, uh) = (sheet.w - 2.0 * sheet.margin, sheet.h - 2.0 * sheet.margin);
    let (bw, bh) = (bb.width(), bb.height());
    let n0 = grid(uw, uh, bw, bh, spacing);
    let n1 = grid(uw, uh, bh, bw, spacing);
    if n0 > 0 || n1 > 0 {
        return FitInfo {
            fits: true,
            rotated: n1 > n0,
            per_sheet: n0.max(n1),
            tiles: 1,
        };
    }
    let tiles = |w: f64, h: f64| -> u32 {
        let nx = tile_count(w, uw, overlap);
        let ny = tile_count(h, uh, overlap);
        nx * ny
    };
    let t0 = tiles(bw, bh);
    let t1 = tiles(bh, bw);
    FitInfo {
        fits: false,
        rotated: t1 < t0,
        per_sheet: 0,
        tiles: t0.min(t1),
    }
}

fn tile_count(len: f64, usable: f64, overlap: f64) -> u32 {
    if len <= usable {
        return 1;
    }
    let step = (usable - overlap).max(usable * 0.25);
    1 + ((len - usable) / step).ceil() as u32
}

pub fn layout(d: &Dieline, opts: &LayoutOptions) -> Vec<Page> {
    let paths = machine_paths(d, opts);
    let bb = d.bbox();
    let copies = opts.copies.clamp(1, 500);
    let Some(sheet) = opts.sheet else {
        let m = opts.page_margin.max(0.0);
        let cols = (copies as f64).sqrt().ceil() as u32;
        let rows = copies.div_ceil(cols);
        let (bw, bh) = (bb.width(), bb.height());
        let mut page = Page {
            w: cols as f64 * bw + (cols - 1) as f64 * opts.spacing + 2.0 * m,
            h: rows as f64 * bh + (rows - 1) as f64 * opts.spacing + 2.0 * m,
            paths: Vec::new(),
            suffix: String::new(),
        };
        for i in 0..copies {
            let off = pt(
                m + (i % cols) as f64 * (bw + opts.spacing) - bb.min.x,
                m + (i / cols) as f64 * (bh + opts.spacing) - bb.min.y,
            );
            page.paths.extend(paths.iter().map(|p| p.map(|q| q + off)));
        }
        return vec![page];
    };

    let info = fit(&bb, &sheet, opts.spacing, opts.tile_overlap);
    let m = sheet.margin;
    let (uw, uh) = (sheet.w - 2.0 * m, sheet.h - 2.0 * m);
    // orient artwork
    let (bw, bh) = if info.rotated {
        (bb.height(), bb.width())
    } else {
        (bb.width(), bb.height())
    };
    let orient = |q: Pt| -> Pt {
        let q = q - bb.min;
        if info.rotated {
            pt(bb.height() - q.y, q.x)
        } else {
            q
        }
    };
    let oriented: Vec<Path> = paths.iter().map(|p| p.map(orient)).collect();

    if info.fits {
        let per = info.per_sheet.max(1);
        let cols = (((uw + opts.spacing) / (bw + opts.spacing)).floor() as u32).max(1);
        let sheets = copies.div_ceil(per);
        let mut pages = Vec::new();
        for s in 0..sheets {
            let mut page = Page {
                w: sheet.w,
                h: sheet.h,
                paths: Vec::new(),
                suffix: if sheets > 1 {
                    format!("sheet-{}", s + 1)
                } else {
                    String::new()
                },
            };
            let n = (copies - s * per).min(per);
            for i in 0..n {
                let off = pt(
                    m + (i % cols) as f64 * (bw + opts.spacing),
                    m + (i / cols) as f64 * (bh + opts.spacing),
                );
                page.paths
                    .extend(oriented.iter().map(|p| p.map(|q| q + off)));
            }
            pages.push(page);
        }
        return pages;
    }

    // tiling
    let nx = tile_count(bw, uw, opts.tile_overlap);
    let ny = tile_count(bh, uh, opts.tile_overlap);
    let step = |n: u32, len: f64, usable: f64| {
        if n > 1 {
            (len - usable) / (n - 1) as f64
        } else {
            0.0
        }
    };
    let (sx, sy) = (step(nx, bw, uw), step(ny, bh, uh));
    let mut pages = Vec::new();
    for r in 0..ny {
        for c in 0..nx {
            let x0 = c as f64 * sx;
            let y0 = r as f64 * sy;
            let clip = BBox {
                min: pt(x0, y0),
                max: pt(x0 + uw, y0 + uh),
            };
            let off = pt(m - x0, m - y0);
            let mut page = Page {
                w: sheet.w,
                h: sheet.h,
                paths: Vec::new(),
                suffix: format!("tile-r{}-c{}", r + 1, c + 1),
            };
            for p in &oriented {
                for q in clip_path(p, &clip) {
                    page.paths.push(q.map(|z| z + off));
                }
            }
            pages.push(page);
        }
    }
    pages
}

/// Clip a path to a rectangle. Paths fully inside are returned unchanged (curves kept).
pub fn clip_path(p: &Path, r: &BBox) -> Vec<Path> {
    let bb = p.bbox();
    if r.contains_box(&bb, 1e-6) {
        return vec![p.clone()];
    }
    if bb.max.x < r.min.x || bb.min.x > r.max.x || bb.max.y < r.min.y || bb.min.y > r.max.y {
        return vec![];
    }
    let pts = p.flatten(0.05);
    let mut out: Vec<Vec<Pt>> = Vec::new();
    for w in pts.windows(2) {
        if let Some((a, b)) = clip_seg(w[0], w[1], r) {
            match out.last_mut() {
                Some(line) if line.last().unwrap().near(a, 1e-9) => line.push(b),
                _ => out.push(vec![a, b]),
            }
        }
    }
    out.into_iter()
        .filter(|l| l.len() >= 2)
        .map(|l| Path::polyline(p.kind, &l, false))
        .collect()
}

/// Liang–Barsky segment clipping.
fn clip_seg(a: Pt, b: Pt, r: &BBox) -> Option<(Pt, Pt)> {
    let d = b - a;
    let (mut t0, mut t1) = (0.0f64, 1.0f64);
    for (p, q) in [
        (-d.x, a.x - r.min.x),
        (d.x, r.max.x - a.x),
        (-d.y, a.y - r.min.y),
        (d.y, r.max.y - a.y),
    ] {
        if p.abs() < 1e-12 {
            if q < 0.0 {
                return None;
            }
        } else {
            let t = q / p;
            if p < 0.0 {
                t0 = t0.max(t);
            } else {
                t1 = t1.min(t);
            }
        }
    }
    if t0 > t1 || (t1 - t0) * d.len() < 1e-6 {
        return None;
    }
    Some((a + d * t0, a + d * t1))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::templates;
    use serde_json::json;

    fn mailer() -> Dieline {
        templates::generate(templates::find("mailer-box").unwrap(), &json!({})).1
    }

    #[test]
    fn dashed_creases_become_perforations() {
        let d = mailer();
        let o = LayoutOptions {
            crease_mode: CreaseMode::Dashed,
            ..Default::default()
        };
        let paths = machine_paths(&d, &o);
        assert!(paths.iter().all(|p| p.kind != LineKind::Crease));
        assert!(
            paths
                .iter()
                .filter(|p| p.kind == LineKind::Perforation)
                .count()
                > 50
        );
        // outline is cut last
        assert_eq!(paths.last().unwrap().kind, LineKind::Cut);
        assert!(paths.last().unwrap().closed);
    }

    #[test]
    fn small_box_nests_on_mat() {
        let (_, d) = templates::generate(
            templates::find("envelope").unwrap(),
            &json!({"width": 60, "height": 40}),
        );
        let o = LayoutOptions {
            sheet: Some(Sheet {
                w: 296.0,
                h: 296.0,
                margin: 0.0,
            }),
            copies: 6,
            ..Default::default()
        };
        let pages = layout(&d, &o);
        assert_eq!(pages.len(), 1);
        let outlines = pages[0]
            .paths
            .iter()
            .filter(|p| p.kind == LineKind::Cut && p.closed)
            .count();
        assert_eq!(outlines, 6);
        for p in &pages[0].paths {
            let b = p.bbox();
            assert!(b.min.x >= -1e-6 && b.max.x <= 296.0 + 1e-6 && b.max.y <= 296.0 + 1e-6);
        }
    }

    #[test]
    fn big_mailer_tiles() {
        let d = mailer();
        let sheet = Sheet {
            w: 296.0,
            h: 296.0,
            margin: 0.0,
        };
        let info = fit(&d.bbox(), &sheet, 4.0, 10.0);
        assert!(!info.fits);
        let o = LayoutOptions {
            sheet: Some(sheet),
            ..Default::default()
        };
        let pages = layout(&d, &o);
        assert_eq!(pages.len() as u32, info.tiles);
        for pg in &pages {
            for p in &pg.paths {
                let b = p.bbox();
                assert!(b.min.x >= -1e-6 && b.max.x <= 296.0 + 1e-6, "{b:?}");
                assert!(b.min.y >= -1e-6 && b.max.y <= 296.0 + 1e-6, "{b:?}");
            }
        }
    }
}
