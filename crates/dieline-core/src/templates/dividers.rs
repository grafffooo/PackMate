use super::*;
use crate::dieline::AsmStep;
use crate::geom::{pt, LineKind, Pt};
use crate::params::*;

/// A grid of compartments: this many loose dividers, slotted together.
struct Grid {
    len: f64,
    wid: f64,
    h: f64,
    cols: usize,
    rows: usize,
    t: f64,
}

#[cfg(test)]
impl Grid {
    fn parts(&self) -> usize {
        (self.rows - 1) + (self.cols - 1)
    }
}

/// Add the divider parts to `d`: laid flat from `flat`, wrapping at `max_w`, and assembled on a
/// grid whose top-left corner is `grid` (layout coordinates, standing on z = 0).
fn add_dividers(d: &mut Dieline, g: &Grid, flat: Pt, max_w: f64, grid: Pt, stage: u32) {
    let sw = slit_width(g.t);
    let dd = g.h / 2.0;
    let gap = 6.0;
    let (mut x, mut y) = (flat.x, flat.y);
    let mut place = |len: f64| -> (f64, f64) {
        if x > flat.x && x + len > flat.x + max_w {
            x = flat.x;
            y += g.h + gap;
        }
        let at = (x, y);
        x += len + gap;
        at
    };

    // long dividers: slotted from the top where the short ones cross
    for k in 1..g.rows {
        let (x0, y0) = place(g.len);
        let mut c = Contour::new(pt(x0, y0));
        for i in 1..g.cols {
            let px = x0 + i as f64 * g.len / g.cols as f64;
            c.to(pt(px - sw / 2.0, y0))
                .to(pt(px - sw / 2.0, y0 + dd))
                .to(pt(px + sw / 2.0, y0 + dd))
                .to(pt(px + sw / 2.0, y0));
        }
        c.to(pt(x0 + g.len, y0))
            .to(pt(x0 + g.len, y0 + g.h))
            .to(pt(x0, y0 + g.h));
        d.add(c.close(LineKind::Cut));
        let part = d.root(
            &format!("Divider {}", d.panels.len() + 1),
            rect(x0, y0, x0 + g.len, y0 + g.h),
        );
        let bottom = pt(x0, y0 + g.h);
        d.assemble(
            part,
            vec![
                AsmStep::rot(bottom, [1.0, 0.0, 0.0], 90.0),
                AsmStep::mv(
                    grid.x - x0,
                    grid.y + k as f64 * g.wid / g.rows as f64 - (y0 + g.h),
                    0.0,
                ),
            ],
            stage,
        );
    }
    // short dividers: slotted from the bottom
    for j in 1..g.cols {
        let (x0, y0) = place(g.wid);
        let mut c = Contour::new(pt(x0, y0));
        c.to(pt(x0 + g.wid, y0)).to(pt(x0 + g.wid, y0 + g.h));
        for i in (1..g.rows).rev() {
            let px = x0 + i as f64 * g.wid / g.rows as f64;
            c.to(pt(px + sw / 2.0, y0 + g.h))
                .to(pt(px + sw / 2.0, y0 + g.h - dd))
                .to(pt(px - sw / 2.0, y0 + g.h - dd))
                .to(pt(px - sw / 2.0, y0 + g.h));
        }
        c.to(pt(x0, y0 + g.h));
        d.add(c.close(LineKind::Cut));
        let part = d.root(
            &format!("Divider {}", d.panels.len() + 1),
            rect(x0, y0, x0 + g.wid, y0 + g.h),
        );
        let bottom = pt(x0, y0 + g.h);
        d.assemble(
            part,
            vec![
                AsmStep::rot(bottom, [1.0, 0.0, 0.0], 90.0),
                AsmStep::rot(bottom, [0.0, 0.0, 1.0], 90.0),
                AsmStep::mv(
                    grid.x + j as f64 * g.len / g.cols as f64 - x0,
                    grid.y + g.wid - (y0 + g.h),
                    0.0,
                ),
            ],
            stage,
        );
    }
}

fn grid_params(p: &Params) -> (usize, usize) {
    let cols = p.f("cols").round().max(1.0) as usize;
    let rows = p.f("rows").round().max(1.0) as usize;
    (cols, rows)
}

/// Loose slotted dividers that lock together into a grid.
pub struct Dividers;

impl Template for Dividers {
    fn info(&self) -> TemplateInfo {
        TemplateInfo {
            id: "dividers",
            name: "Slotted Dividers",
            category: CAT_SLEEVE,
            description: "Loose dividers that slot together into a grid of compartments for a drawer or box. No glue.",
            tags: &["dividers", "insert", "grid", "organizer", "slots", "no glue"],
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let mut v = vec![
            length("length", "Length", G_DIM, 150.0, 30.0, 1200.0),
            length("width", "Width (depth)", G_DIM, 100.0, 30.0, 1200.0),
            length("height", "Divider height", G_DIM, 40.0, 10.0, 400.0),
            number(
                "cols",
                "Compartments along the length",
                G_DIM,
                3.0,
                1.0,
                12.0,
                1.0,
            ),
            number(
                "rows",
                "Compartments across the width",
                G_DIM,
                2.0,
                1.0,
                12.0,
                1.0,
            ),
        ];
        v.extend(material_params(false));
        v
    }

    fn build(&self, p: &Params) -> Dieline {
        let mut d = Dieline::new();
        let (cols, mut rows) = grid_params(p);
        if cols == 1 && rows == 1 {
            rows = 2;
            d.warn("One compartment needs no dividers; made two.");
        }
        let g = Grid {
            len: p.f("length"),
            wid: p.f("width"),
            h: p.f("height"),
            cols,
            rows,
            t: p.f("thickness"),
        };
        let max_w = (g.len.max(g.wid) * 4.0).max(300.0);
        add_dividers(&mut d, &g, pt(0.0, g.wid + 30.0), max_w, pt(0.0, 0.0), 0);
        d
    }
}

/// Tray with a grid of slotted dividers.
pub struct DividedTray;

impl Template for DividedTray {
    fn info(&self) -> TemplateInfo {
        TemplateInfo {
            id: "compartment-tray",
            name: "Compartment Tray",
            category: CAT_SLEEVE,
            description:
                "Locking tray plus slotted dividers that lock into a grid of compartments. No glue.",
            tags: &[
                "tray",
                "dividers",
                "compartments",
                "organizer",
                "insert",
                "no glue",
            ],
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let mut v = mailer::Mailer { lid: false }.params();
        v.push(number(
            "cols",
            "Compartments along the length",
            G_OPT,
            3.0,
            1.0,
            12.0,
            1.0,
        ));
        v.push(number(
            "rows",
            "Compartments across the width",
            G_OPT,
            2.0,
            1.0,
            12.0,
            1.0,
        ));
        v
    }

    fn build(&self, p: &Params) -> Dieline {
        let BoxDims { l, w, h, t } = BoxDims::from(p);
        let mut d = mailer::Mailer { lid: false }.build(p);
        let (cols, mut rows) = grid_params(p);
        if cols == 1 && rows == 1 {
            rows = 2;
            d.warn("One compartment needs no dividers; made two.");
        }
        let base = d
            .panels
            .iter()
            .find(|q| q.name == "Base")
            .map(|q| q.outline.clone())
            .expect("tray has a base");
        let (x0, y0) = (base[0].x, base[0].y);
        let (inner_l, inner_w) = (l - t, w - t);
        let g = Grid {
            len: inner_l,
            wid: inner_w,
            h: ((h - t) * 0.9).max(8.0),
            cols,
            rows,
            t,
        };
        let bb = d.bbox();
        let stage = d.panels.iter().map(|q| q.stage).max().unwrap_or(0) + 1;
        let max_w = (g.len.max(g.wid) * 3.0).max(300.0);
        add_dividers(
            &mut d,
            &g,
            pt(bb.max.x + 20.0, bb.min.y),
            max_w,
            pt(x0 + t / 2.0, y0 + t / 2.0),
            stage,
        );
        d
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::templates::testutil::*;
    use serde_json::json;

    #[test]
    fn divider_counts_match_the_grid() {
        for (cols, rows) in [(3, 2), (2, 1), (1, 4), (6, 6)] {
            let g = Grid {
                len: 100.0,
                wid: 80.0,
                h: 30.0,
                cols,
                rows,
                t: 0.5,
            };
            let d = check_parts(&Dividers, json!({"cols": cols, "rows": rows}), g.parts());
            assert_eq!(d.panels.len(), g.parts());
            assert!(d.panels.iter().all(|q| q.assembly.len() >= 2));
        }
    }

    #[test]
    fn single_compartment_still_makes_a_divider() {
        let d = check_parts(&Dividers, json!({"cols": 1, "rows": 1}), 1);
        assert!(!d.warnings.is_empty());
    }

    #[test]
    fn slots_are_half_height_and_as_wide_as_the_board() {
        let d = check_parts(
            &Dividers,
            json!({"length": 120, "width": 80, "height": 40, "cols": 2, "rows": 2, "thickness": 1.0}),
            2,
        );
        // the long divider has one notch from the top: its outline touches y = top + 20
        let long = &d.paths[0];
        let b = long.bbox();
        assert!(approx(b.height(), 40.0));
        let pts = long.flatten(0.05);
        let notch_bottom = pts.iter().map(|q| q.y).fold(f64::MIN, f64::max);
        assert!(approx(notch_bottom, b.min.y + 40.0));
        let deep: Vec<_> = pts.iter().filter(|q| approx(q.y, b.min.y + 20.0)).collect();
        assert_eq!(deep.len(), 2);
        assert!(approx((deep[1].x - deep[0].x).abs(), slit_width(1.0)));
    }

    #[test]
    fn compartment_tray_has_tray_and_dividers() {
        let d = check_parts(
            &DividedTray,
            json!({"length": 150, "width": 100, "height": 40, "cols": 3, "rows": 2}),
            1 + 2 + 1,
        );
        assert!(d.panels.iter().any(|q| q.name == "Base"));
        check_parts(
            &DividedTray,
            json!({"length": 40, "width": 40, "height": 15, "cols": 1, "rows": 1}),
            2,
        );
    }
}
