use super::*;
use crate::geom::{pt, LineKind, Path};
use crate::params::*;

/// Gusseted paper gift bag with folded bottom.
pub struct Bag;

impl Template for Bag {
    fn info(&self) -> TemplateInfo {
        TemplateInfo {
            id: "gusset-bag",
            name: "Gusseted Paper Bag",
            category: CAT_BAG,
            description: "Gift / shopping bag with side gussets, reinforced top hem, folded bottom and rope-handle holes.",
            tags: &["bag", "gift bag", "shopping", "gusset", "needs glue"],
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let mut v = vec![
            length("width", "Width", G_DIM, 120.0, 30.0, 800.0),
            length("depth", "Gusset depth", G_DIM, 60.0, 15.0, 400.0),
            length("height", "Height", G_DIM, 160.0, 30.0, 1000.0),
        ];
        v.extend(material_params(false));
        v[3].kind = ParamKind::Length {
            default: 0.2,
            min: 0.05,
            max: 3.0,
        };
        v.push(
            length("hem", "Top hem", G_OPT, 30.0, 0.0, 100.0)
                .help("Fold-over reinforcement at the top. 0 = none."),
        );
        v.push(length("glue", "Glue flap width", G_OPT, 15.0, 5.0, 40.0));
        v.push(boolean("holes", "Handle holes", true));
        v
    }

    fn build(&self, p: &Params) -> Dieline {
        let mut d = Dieline::new();
        let t = p.f("thickness");
        let w = p.f("width") + t;
        let gd = p.f("depth") + t;
        let h = p.f("height");
        let mut hem = p.f("hem");
        if hem > h * 0.4 {
            hem = h * 0.4;
            d.warn("Top hem limited to 40% of the height.");
        }
        let glue = p.f("glue").min(w * 0.4);
        let gb = gd / 2.0; // gusset bottom flap
        let ov = (gd * 0.3).min(15.0);
        let fb = gd / 2.0 + ov; // front/back bottom flap
        let notch = 1.5f64.min(gd * 0.05);
        let xs = [0.0, w, w + gd, 2.0 * w + gd, 2.0 * w + 2.0 * gd];

        let mut c = Contour::new(pt(0.0, -hem));
        c.to(pt(xs[4], -hem));
        c.to(pt(xs[4], h));
        // bottom flaps right to left: gusset, back, gusset, front
        for i in (0..4).rev() {
            let e = Edge::new(pt(xs[i + 1], h), pt(xs[i], h));
            let depth = if i % 2 == 1 { gb } else { fb };
            push_profile(
                &mut c,
                &e,
                &[
                    Prof::P(notch, depth, 0.0),
                    Prof::P(e.len - notch, depth, 0.0),
                    Prof::P(e.len, 0.0, 0.0),
                ],
            );
        }
        glue_flap(&mut c, &mut d, Edge::new(pt(0.0, h), pt(0.0, 0.0)), glue, 0);
        // glue_flap registered a panel already; fix its parent after the root exists (see below)
        let glue_panel = d.panels.pop().unwrap();
        d.add(c.close(LineKind::Cut));

        // creases
        if hem > 0.0 {
            d.crease(pt(0.0, 0.0), pt(xs[4], 0.0));
        }
        d.crease(pt(0.0, h), pt(xs[4], h));
        for &x in &xs[1..4] {
            d.crease(pt(x, -hem), pt(x, h));
        }
        let mids = [w + gd / 2.0, 2.0 * w + 1.5 * gd];
        for (gi, &m) in mids.iter().enumerate() {
            let x0 = xs[1 + 2 * gi];
            let dz = (gd / 2.0).min(h * 0.45);
            d.crease(pt(m, -hem), pt(m, h - dz));
            d.crease(pt(m, h - dz), pt(m, h));
            d.crease(pt(x0, h), pt(m, h - dz));
            d.crease(pt(x0 + gd, h), pt(m, h - dz));
        }
        if p.b("holes") && hem > 8.0 {
            let r = 3.0;
            let yh = hem / 2.0;
            for x0 in [0.0, w + gd] {
                for fx in [0.3, 0.7] {
                    let x = x0 + w * fx;
                    d.add(Path::circle(LineKind::Cut, pt(x, yh), r));
                    d.add(Path::circle(LineKind::Cut, pt(x, -yh), r));
                }
            }
        }

        // fold model
        let front = d.root("Front", rect(0.0, 0.0, w, h));
        let g1a = d.fold(
            "Gusset",
            rect(xs[1], 0.0, mids[0], h),
            front,
            pt(xs[1], 0.0),
            pt(xs[1], h),
            90.0,
            1,
        );
        d.quiet();
        let g1b = d.fold(
            "Gusset",
            rect(mids[0], 0.0, xs[2], h),
            g1a,
            pt(mids[0], 0.0),
            pt(mids[0], h),
            0.0,
            1,
        );
        let back = d.fold(
            "Back",
            rect(xs[2], 0.0, xs[3], h),
            g1b,
            pt(xs[2], 0.0),
            pt(xs[2], h),
            90.0,
            1,
        );
        let g2a = d.fold(
            "Gusset",
            rect(xs[3], 0.0, mids[1], h),
            back,
            pt(xs[3], 0.0),
            pt(xs[3], h),
            90.0,
            1,
        );
        d.quiet();
        let g2b = d.fold(
            "Gusset",
            rect(mids[1], 0.0, xs[4], h),
            g2a,
            pt(mids[1], 0.0),
            pt(mids[1], h),
            0.0,
            1,
        );
        let mut gp = glue_panel;
        gp.parent = Some(front);
        gp.stage = 1;
        d.panels.push(gp);
        let body = [
            (front, 0usize),
            (g1a, 1),
            (g1b, 1),
            (back, 2),
            (g2a, 3),
            (g2b, 3),
        ];
        let spans = [
            (xs[0], xs[1]),
            (xs[1], mids[0]),
            (mids[0], xs[2]),
            (xs[2], xs[3]),
            (xs[3], mids[1]),
            (mids[1], xs[4]),
        ];
        if hem > 0.0 {
            for (k, &(pi, _)) in body.iter().enumerate() {
                let (a, b) = spans[k];
                d.fold(
                    "Hem",
                    rect(a, -hem, b, 0.0),
                    pi,
                    pt(a, 0.0),
                    pt(b, 0.0),
                    179.4,
                    0,
                );
                d.quiet();
            }
        }
        // bottom: gussets first, then front, then back
        for (i, (pi, stage, ang)) in [
            (front, 3, 89.6),
            (g1a, 2, 90.0),
            (back, 4, 89.0),
            (g2a, 2, 90.0),
        ]
        .iter()
        .enumerate()
        {
            let e = Edge::new(pt(xs[i], h), pt(xs[i + 1], h));
            let depth = if i % 2 == 1 { gb } else { fb };
            // outward is +y here, so mirror v
            let o = vec![
                e.at(0.0, 0.0),
                e.at(e.len, 0.0),
                e.at(e.len - notch, -depth),
                e.at(notch, -depth),
            ];
            d.fold(
                "Bottom",
                o,
                *pi,
                e.at(0.0, 0.0),
                e.at(e.len, 0.0),
                *ang,
                *stage,
            );
            d.quiet();
        }
        d
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::templates::testutil::*;
    use serde_json::json;

    #[test]
    fn bag_ok() {
        let d = check(&Bag, json!({"thickness": 0}));
        let b = d.bbox();
        let t = 0.05;
        assert!(
            approx(b.width(), 15.0 + 2.0 * (120.0 + t) + 2.0 * (60.0 + t)),
            "{}",
            b.width()
        );
        assert!(
            approx(b.height(), 30.0 + 160.0 + (60.0 + t) / 2.0 + 15.0),
            "{}",
            b.height()
        );
        check(&Bag, json!({"hem": 0, "holes": true}));
        check(&Bag, json!({"width": 30, "depth": 15, "height": 30}));
    }
}
