use super::*;
use crate::geom::{pt, LineKind, Path, Pt};
use crate::params::*;

/// House-shaped gable box with carry handle.
pub struct Gable;

impl Template for Gable {
    fn info(&self) -> TemplateInfo {
        TemplateInfo {
            id: "gable-box",
            name: "Gable Box with Handle",
            category: CAT_SPECIAL,
            description: "House-shaped carry box with a die-cut handle: party favours, bakery treats, gift hampers.",
            tags: &["gift", "handle", "bakery", "party", "house", "needs glue"],
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let mut v = vec![
            length("length", "Length", G_DIM, 100.0, 30.0, 800.0),
            length("width", "Width (depth)", G_DIM, 60.0, 20.0, 600.0),
            length("height", "Wall height", G_DIM, 80.0, 20.0, 800.0),
            length("roof", "Roof slope length", G_DIM, 45.0, 10.0, 600.0)
                .help("Must be more than half the width; a longer roof gives a steeper gable."),
            length("handle", "Handle panel height", G_DIM, 35.0, 10.0, 200.0),
        ];
        v.extend(material_params(true));
        v.push(length("tuck", "Bottom tuck depth", G_OPT, 15.0, 4.0, 80.0));
        v.push(length("glue", "Glue flap width", G_OPT, 12.0, 5.0, 40.0));
        v.push(boolean("hole", "Handle cut-out", true));
        v
    }

    fn build(&self, p: &Params) -> Dieline {
        let BoxDims { l, w, h, t } = BoxDims::from(p);
        let mut d = Dieline::new();
        let mut roof = p.f("roof");
        let min_roof = w / 2.0 + 3.0;
        if roof < min_roof {
            roof = min_roof;
            d.warn(format!(
                "Roof lengthened to {roof:.1} mm (must exceed half the width)."
            ));
        }
        let hh = p.f("handle");
        let mut tuck = p.f("tuck");
        if tuck > h * 0.45 {
            tuck = h * 0.45;
            d.warn("Tuck flap shortened to fit the wall height.");
        }
        let glue = p.f("glue").min(w * 0.9);
        let dust = (l * 0.45).min(w * 0.9);
        let gap = 0.3; // keep the two handle panels from touching in the preview
        let sin_phi = (w / 2.0 - gap) / roof;
        let phi = sin_phi.asin();
        let rise = (roof * roof - (w / 2.0) * (w / 2.0)).sqrt();
        let (x1, x2, x3, x4) = (l, l + w, 2.0 * l + w, 2.0 * l + 2.0 * w);
        let ytop = -roof - hh;
        let gt = (w * 0.2).clamp(3.0, 10.0);

        let panels = tube_panels(&mut d, l, w, h, ["Front", "Side", "Back", "Side"]);
        let mut c = Contour::new(pt(0.0, 0.0));
        let mut tabs: Vec<(usize, Edge, f64, f64)> = Vec::new();

        for (xa, pi) in [(0.0, panels[0]), (x2, panels[2])] {
            let r = (hh * 0.2).min(4.0);
            c.to_r(pt(xa, ytop), r);
            c.to_r(pt(xa + l, ytop), r);
            c.to(pt(xa + l, 0.0));
            d.crease(pt(xa, 0.0), pt(xa + l, 0.0));
            d.crease(pt(xa, -roof), pt(xa + l, -roof));
            let rf = d.fold(
                "Roof",
                rect(xa, -roof, xa + l, 0.0),
                pi,
                pt(xa, 0.0),
                pt(xa + l, 0.0),
                phi.to_degrees(),
                1,
            );
            d.fold(
                "Handle",
                rect(xa, ytop, xa + l, -roof),
                rf,
                pt(xa, -roof),
                pt(xa + l, -roof),
                -phi.to_degrees(),
                1,
            );
            if p.b("hole") {
                let cx = xa + l / 2.0;
                let cy = -roof - hh / 2.0;
                let hw = (l * 0.5).min(90.0);
                let hht = (hh * 0.45).min(22.0).min(hw);
                d.add(stadium(pt(cx, cy), hw, hht));
            }
            // gable end on the following side panel
            let xs = xa + l;
            let apex = pt(xs + w / 2.0, -rise);
            let sp = if xa == 0.0 { panels[1] } else { panels[3] };
            for (a, b, lo, hi) in [
                (pt(xs, 0.0), apex, xs, apex.x),
                (apex, pt(xs + w, 0.0), apex.x, xs + w),
            ] {
                let e = Edge::new(a, b);
                match fit_tab(&e, gt, lo + 0.3, hi - 0.3) {
                    Some((s0, s1)) => {
                        push_profile(
                            &mut c,
                            &e,
                            &[
                                Prof::P(s0, 0.0, 0.0),
                                Prof::P(s0 + gt, gt, 0.0),
                                Prof::P(s1 - gt, gt, 0.0),
                                Prof::P(s1, 0.0, 0.0),
                                Prof::P(e.len, 0.0, 0.0),
                            ],
                        );
                        d.crease(e.at(s0, 0.0), e.at(s1, 0.0));
                        tabs.push((sp, e, s0, s1));
                    }
                    None => {
                        c.to(b);
                    }
                }
            }
            // update the side panel outline to the pentagon
            let o = &mut d.panels[sp].outline;
            *o = vec![pt(xs, h), pt(xs, 0.0), apex, pt(xs + w, 0.0), pt(xs + w, h)];
        }
        for (sp, e, s0, s1) in tabs {
            let outline = vec![
                e.at(s0, 0.0),
                e.at(s0 + gt, gt),
                e.at(s1 - gt, gt),
                e.at(s1, 0.0),
            ];
            d.glue.push(outline.clone());
            d.fold(
                "Glue tab",
                outline,
                sp,
                e.at(s0, 0.0),
                e.at(s1, 0.0),
                90.0,
                1,
            );
            d.quiet();
        }
        c.to(pt(x4, h));

        // bottom: straight tuck on the front panel
        dust_flap(
            &mut c,
            &mut d,
            Edge::new(pt(x4, h), pt(x3, h)),
            dust,
            panels[3],
            2,
        );
        c.to(pt(x2, h));
        dust_flap(
            &mut c,
            &mut d,
            Edge::new(pt(x2, h), pt(x1, h)),
            dust,
            panels[1],
            2,
        );
        let e = Edge::new(pt(x1, h), pt(0.0, h));
        lid_with_tuck(&mut c, &mut d, e, w, tuck, t);
        lid_panels(&mut d, panels[0], e, w, tuck, t, 3, "Bottom");
        glue_flap(
            &mut c,
            &mut d,
            Edge::new(pt(0.0, h), pt(0.0, 0.0)),
            glue,
            panels[0],
        );
        d.add(c.close(LineKind::Cut));
        d
    }
}

/// Find the extent [s0, s1] along `e` of a 45°-chamfered glue tab of width `gt` whose corners stay
/// within lo <= x <= hi. Returns None if no useful tab fits.
fn fit_tab(e: &Edge, gt: f64, lo: f64, hi: f64) -> Option<(f64, f64)> {
    let ok = |p: Pt| p.x >= lo - 1e-9 && p.x <= hi + 1e-9;
    let (mut s0, mut s1) = (1.0, e.len - 1.0);
    for _ in 0..400 {
        if s1 - s0 < 2.0 * gt + 3.0 {
            return None;
        }
        let a = ok(e.at(s0 + gt, gt));
        let b = ok(e.at(s1 - gt, gt));
        if a && b {
            return Some((s0, s1));
        }
        if !a {
            s0 += 0.5;
        }
        if !b {
            s1 -= 0.5;
        }
    }
    None
}

/// Rounded slot (stadium) centred on `c`.
fn stadium(c: Pt, w: f64, h: f64) -> Path {
    let a = (w - h) / 2.0;
    let r = h / 2.0;
    if a < 0.5 {
        return Path::circle(LineKind::Cut, c, r);
    }
    let mut k = Contour::new(pt(c.x, c.y - r));
    k.to(pt(c.x + a, c.y - r));
    k.arc(pt(c.x + a, c.y + r), r);
    k.to(pt(c.x - a, c.y + r));
    k.arc(pt(c.x - a, c.y - r), r);
    k.close(LineKind::Cut)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::templates::testutil::*;
    use serde_json::json;

    #[test]
    fn gable_ok() {
        let d = check(&Gable, json!({"thickness": 0}));
        let b = d.bbox();
        assert!(
            approx(b.height(), 45.0 + 35.0 + 80.05 + 60.05 + 15.0),
            "{}",
            b.height()
        );
        assert!(d.glue.len() >= 4);
        check(&Gable, json!({"roof": 10, "width": 120}));
        check(&Gable, json!({"roof": 300, "width": 30, "hole": false}));
        check(&Gable, json!({"length": 30, "width": 20, "handle": 10}));
    }
}
