use super::*;
use crate::geom::{pt, LineKind};
use crate::params::*;

/// Open-ended sleeve: four panels, closed by a tongue-and-slit seam. Slides over a tray or box.
pub struct Sleeve;

impl Template for Sleeve {
    fn info(&self) -> TemplateInfo {
        TemplateInfo {
            id: "sleeve",
            name: "Sleeve",
            category: CAT_SLEEVE,
            description: "Open-ended wrap that slides over a tray, drawer or product. The seam locks with a tongue and slit, no glue.",
            tags: &["sleeve", "wrap", "belly band", "slide", "no glue"],
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let mut v = vec![
            length("length", "Length", G_DIM, 120.0, 20.0, 1500.0),
            length("width", "Width (depth)", G_DIM, 80.0, 20.0, 1500.0),
            length("height", "Sleeve length", G_DIM, 60.0, 10.0, 1500.0),
        ];
        v.extend(material_params(true));
        v.push(length("flap", "Lock flap width", G_OPT, 15.0, 8.0, 50.0));
        v
    }

    fn build(&self, p: &Params) -> Dieline {
        let BoxDims { l, w, h, t } = BoxDims::from(p);
        let g = p.f("flap").min(l * 0.8);
        let mut d = Dieline::new();
        let panels = tube_panels(&mut d, l, w, h, ["Front", "Side", "Back", "Side"]);
        let x4 = 2.0 * l + 2.0 * w;
        let mut c = Contour::new(pt(0.0, 0.0));
        c.to(pt(x4, 0.0));
        let e = Edge::new(pt(x4, 0.0), pt(x4, h));
        let span = lock_flap(
            &mut c,
            &mut d,
            e,
            g,
            (h * 0.5).min(40.0),
            t,
            panels[3],
            90.0,
            1,
            None,
        );
        c.to(pt(0.0, h));
        lock_slit(
            &mut d,
            &Edge::new(pt(0.0, h), pt(0.0, 0.0)),
            g,
            span,
            t,
            true,
        );
        d.add(c.close(LineKind::Cut));
        d
    }
}

/// Glue-free folding carton with a locking side seam, a tuck lid and an interlocking
/// "1-2-3" bottom: two small flaps, a big flap, and a flap whose tongue locks through a slit.
pub struct SnapLock;

impl Template for SnapLock {
    fn info(&self) -> TemplateInfo {
        TemplateInfo {
            id: "snap-lock-box",
            name: "Snap-Lock Bottom Box",
            category: CAT_BOX,
            description: "Folding carton with an interlocking bottom, a locking side seam and a tuck lid. Assembles without glue.",
            tags: &["carton", "retail", "no glue", "lock", "1-2-3 bottom"],
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let mut v = vec![
            length("length", "Length", G_DIM, 80.0, 30.0, 1000.0),
            length("width", "Width (depth)", G_DIM, 60.0, 30.0, 1000.0),
            length("height", "Height", G_DIM, 100.0, 20.0, 1000.0),
        ];
        v.extend(material_params(true));
        v.push(length("tuck", "Tuck flap depth", G_OPT, 15.0, 4.0, 80.0));
        v.push(length("flap", "Lock flap width", G_OPT, 15.0, 8.0, 50.0));
        v
    }

    fn build(&self, p: &Params) -> Dieline {
        let BoxDims { l, w, h, t } = BoxDims::from(p);
        let mut d = Dieline::new();
        let mut tuck = p.f("tuck");
        if tuck > h * 0.45 {
            tuck = h * 0.45;
            d.warn("Tuck flap shortened to fit the box height.");
        }
        let g = p.f("flap").min(w * 0.9);
        let dust = (l * 0.45).min(w * 0.9);
        let (x1, x2, x3, x4) = (l, l + w, 2.0 * l + w, 2.0 * l + 2.0 * w);
        let panels = tube_panels(&mut d, l, w, h, ["Back", "Side", "Front", "Side"]);

        // bottom geometry: the back flap reaches the middle, the front flap passes it by `o` and its
        // tongue goes up through a slit in the back flap
        let o = (2.0 * t + 4.0).max(6.0);
        let half = w / 2.0;
        let tw = (l * 0.4).min(40.0);
        let (ta, tb) = ((l - tw) / 2.0, (l + tw) / 2.0);
        let tl = 9.0_f64;

        let mut c = Contour::new(pt(0.0, 0.0));
        // top edge, left to right: tuck lid on the back panel, dust flaps on the sides
        let e = Edge::new(pt(0.0, 0.0), pt(x1, 0.0));
        lid_with_tuck(&mut c, &mut d, e, w, tuck, t);
        lid_panels(&mut d, panels[0], e, w, tuck, t, 2, "Top lid");
        dust_flap(
            &mut c,
            &mut d,
            Edge::new(pt(x1, 0.0), pt(x2, 0.0)),
            dust,
            panels[1],
            1,
        );
        c.to(pt(x3, 0.0));
        dust_flap(
            &mut c,
            &mut d,
            Edge::new(pt(x3, 0.0), pt(x4, 0.0)),
            dust,
            panels[3],
            1,
        );
        c.to(pt(x4, 0.0));

        // right edge: locking seam flap
        let e = Edge::new(pt(x4, 0.0), pt(x4, h));
        let span = lock_flap(
            &mut c,
            &mut d,
            e,
            g,
            (h * 0.5).min(40.0),
            t,
            panels[3],
            90.0,
            1,
            None,
        );
        c.to(pt(x4, h));

        // bottom edge, right to left
        end_flap(
            &mut c,
            &mut d,
            Edge::new(pt(x4, h), pt(x3, h)),
            half,
            panels[3],
            1,
            "Bottom flap",
        );
        // front flap with tongue
        let e = Edge::new(pt(x3, h), pt(x2, h));
        let df = half + o;
        let ins = (df * 0.15).min(l * 0.15);
        let tc = tl * 0.4;
        push_profile(
            &mut c,
            &e,
            &[
                Prof::P(ins, df, 4.0),
                Prof::P(ta, df, 0.0),
                Prof::P(ta + tc, df + tl, 0.0),
                Prof::P(tb - tc, df + tl, 0.0),
                Prof::P(tb, df, 0.0),
                Prof::P(l - ins, df, 4.0),
                Prof::P(l, 0.0, 0.0),
            ],
        );
        d.crease(e.at(0.0, 0.0), e.at(l, 0.0));
        d.crease(e.at(ta, df), e.at(tb, df));
        let front = d.fold(
            "Bottom flap",
            vec![
                e.at(0.0, 0.0),
                e.at(ins, df),
                e.at(l - ins, df),
                e.at(l, 0.0),
            ],
            panels[2],
            e.at(0.0, 0.0),
            e.at(l, 0.0),
            90.0,
            3,
        );
        d.quiet();
        d.fold(
            "Tongue",
            vec![
                e.at(ta, df),
                e.at(ta + tc, df + tl),
                e.at(tb - tc, df + tl),
                e.at(tb, df),
            ],
            front,
            e.at(ta, df),
            e.at(tb, df),
            90.0,
            4,
        );
        d.quiet();
        end_flap(
            &mut c,
            &mut d,
            Edge::new(pt(x2, h), pt(x1, h)),
            half,
            panels[1],
            1,
            "Bottom flap",
        );
        // back flap, with the slit for the front tongue
        let e = Edge::new(pt(x1, h), pt(0.0, h));
        end_flap(&mut c, &mut d, e, half, panels[0], 2, "Bottom flap");
        let sw = slit_width(t);
        slit(
            &mut d,
            &e,
            ta - 0.5,
            tb + 0.5,
            half - o - sw / 2.0,
            half - o + sw / 2.0,
        );

        // seam slit in the back panel
        lock_slit(
            &mut d,
            &Edge::new(pt(0.0, h), pt(0.0, 0.0)),
            g,
            span,
            t,
            true,
        );
        d.add(c.close(LineKind::Cut));
        d
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::templates::testutil::*;
    use serde_json::json;

    #[test]
    fn sleeve_flat_size() {
        let d = check(
            &Sleeve,
            json!({"length": 120, "width": 80, "height": 60, "thickness": 0.5}),
        );
        let b = d.bbox();
        // 2*(120.5+80.5) wall strip + 15 mm flap + 9 mm tongue (4 + 2t clamp -> 5)
        assert!(b.width() > 2.0 * (120.5 + 80.5) + 15.0, "{}", b.width());
        assert!(approx(b.height(), 60.5), "{}", b.height());
        assert!(d.glue.is_empty());
    }

    #[test]
    fn sleeve_extremes() {
        check(&Sleeve, json!({"length": 20, "width": 20, "height": 10}));
        check(
            &Sleeve,
            json!({"length": 900, "width": 600, "height": 400, "thickness": 4}),
        );
    }

    #[test]
    fn tuck_lock_has_no_glue_area() {
        let t = tuck::TuckEnd {
            reverse: true,
            lock: true,
        };
        let d = check(&t, json!({"length": 70, "width": 40, "height": 110}));
        assert!(d.glue.is_empty());
        check(&t, json!({"length": 10, "width": 10, "height": 10}));
    }

    #[test]
    fn snap_lock_sizes() {
        let d = check(
            &SnapLock,
            json!({"length": 80, "width": 60, "height": 100, "thickness": 0.5}),
        );
        let b = d.bbox();
        // height + lid (60.5+15) above + front bottom flap (30.5+o+tongue) below
        assert!(b.height() > 100.5 + 75.5, "{}", b.height());
        assert!(d.glue.is_empty());
        for q in [
            json!({"length": 30, "width": 30, "height": 20}),
            json!({"length": 600, "width": 300, "height": 400, "thickness": 3}),
        ] {
            check(&SnapLock, q);
        }
    }
}
