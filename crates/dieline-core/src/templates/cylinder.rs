use super::*;
use crate::dieline::AsmStep;
use crate::geom::{pt, LineKind, Pt};
use crate::params::*;
use std::f64::consts::PI;

/// Facets used for the folded wall in the 3D preview (the cut and crease lines stay smooth).
const FACETS: usize = 24;

/// Round box: a wall that rolls into a cylinder with a locking seam, and two discs whose tabs press
/// against the inside of the wall.
pub struct Cylinder;

impl Template for Cylinder {
    fn info(&self) -> TemplateInfo {
        TemplateInfo {
            id: "cylinder",
            name: "Cylinder Box",
            category: CAT_SHAPE,
            description: "Round tube box: a wall that rolls into a cylinder with a locking seam, plus two discs with tabs that press-fit inside. No glue.",
            tags: &["round", "cylinder", "tube", "tin", "press-fit", "no glue"],
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let mut v = vec![
            length("diameter", "Inside diameter", G_DIM, 60.0, 20.0, 400.0),
            length("height", "Height", G_DIM, 80.0, 15.0, 600.0),
        ];
        v.extend(material_params(false));
        v.push(length("tab", "Disc tab depth", G_OPT, 10.0, 4.0, 40.0));
        v.push(length("flap", "Lock flap width", G_OPT, 12.0, 8.0, 40.0));
        v
    }

    fn build(&self, p: &Params) -> Dieline {
        let t = p.f("thickness");
        let h = p.f("height");
        let d_in = p.f("diameter");
        let mut d = Dieline::new();
        d.upright = true;
        let tab = p.f("tab").min(h * 0.4);
        let circ = PI * (d_in + t);
        let a = circ / FACETS as f64;
        let fold = 360.0 / FACETS as f64;
        let g = p.f("flap").min(circ * 0.2);

        // ---- wall: a strip of narrow facets, no creases drawn
        let mut facets = vec![d.root("Wall", rect(0.0, 0.0, a, h))];
        d.quiet();
        for i in 1..FACETS {
            let x = i as f64 * a;
            let f = d.fold(
                "Wall",
                rect(x, 0.0, x + a, h),
                facets[i - 1],
                pt(x, 0.0),
                pt(x, h),
                fold,
                0,
            );
            d.quiet();
            facets.push(f);
        }
        let mut c = Contour::new(pt(0.0, 0.0));
        c.to(pt(circ, 0.0));
        let e = Edge::new(pt(circ, 0.0), pt(circ, h));
        let span = lock_flap(
            &mut c,
            &mut d,
            e,
            g,
            (h * 0.5).min(40.0),
            t,
            facets[FACETS - 1],
            fold,
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

        // ---- two discs below the wall
        let r = d_in / 2.0 - 0.3;
        let n = ((PI * d_in / 22.0).round() as usize).clamp(6, 20);
        let gap_arc = 2.0 * PI * r / n as f64;
        let tw = (gap_arc * 0.55).min(18.0);
        let delta = (tw / 2.0 / r).asin();
        let dc = (r * r - tw * tw / 4.0).sqrt();
        let rc = a / (2.0 * (PI / FACETS as f64).tan()); // wall's apothem: where its axis sits in z
        let y0 = h + 20.0 + r + tab;
        let mut x0 = r + tab;
        for k in 0..2 {
            let centre = pt(x0, y0);
            let tab_pt = |i: usize, side: f64, out: f64| -> Pt {
                let phi = 2.0 * PI * i as f64 / n as f64;
                let u = Pt::polar(phi);
                let tangent = pt(-phi.sin(), phi.cos());
                centre + u * (dc + out) + tangent * (side * tw / 2.0)
            };
            let sag = r * (1.0 - (PI / n as f64 - delta).cos());
            let mut o = Contour::new(tab_pt(0, -1.0, 0.0));
            let mut tabs = Vec::new();
            for i in 0..n {
                if i > 0 {
                    o.arc(tab_pt(i, -1.0, 0.0), sag);
                }
                o.to(tab_pt(i, -1.0, tab))
                    .to(tab_pt(i, 1.0, tab))
                    .to(tab_pt(i, 1.0, 0.0));
                tabs.push(i);
            }
            o.arc(tab_pt(0, -1.0, 0.0), sag);
            d.add(o.close(LineKind::Cut));

            let ring: Vec<Pt> = (0..48)
                .map(|i| centre + Pt::polar(2.0 * PI * i as f64 / 48.0) * r)
                .collect();
            let disc = d.root(if k == 0 { "Bottom disc" } else { "Top disc" }, ring);
            for &i in &tabs {
                let (pa, pb) = (tab_pt(i, -1.0, 0.0), tab_pt(i, 1.0, 0.0));
                d.crease(pa, pb);
                d.fold(
                    "Tab",
                    vec![pa, tab_pt(i, -1.0, tab), tab_pt(i, 1.0, tab), pb],
                    disc,
                    pa,
                    pb,
                    90.0,
                    1,
                );
                d.quiet();
            }
            // stand the disc up under/over the wall: bottom tabs point up, top tabs point down
            let (rot, target_y) = if k == 0 { (-90.0, h) } else { (90.0, 0.0) };
            d.assemble(
                disc,
                vec![
                    AsmStep::rot(centre, [1.0, 0.0, 0.0], rot),
                    AsmStep::mv(a / 2.0 - centre.x, target_y - centre.y, rc),
                ],
                3,
            );
            x0 += 2.0 * (r + tab) + 12.0;
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
    fn wall_is_one_circumference_long() {
        let d = check_parts(
            &Cylinder,
            json!({"diameter": 60, "height": 80, "thickness": 0.5}),
            3,
        );
        let wall = d.panels[..FACETS]
            .iter()
            .map(|q| q.outline[1].x - q.outline[0].x)
            .sum::<f64>();
        assert!(approx(wall, PI * 60.5), "{wall}");
        assert!(d.upright);
        assert!(d.glue.is_empty());
    }

    #[test]
    fn extremes() {
        for q in [
            json!({"diameter": 20, "height": 15, "tab": 4}),
            json!({"diameter": 400, "height": 600, "thickness": 3, "tab": 40}),
        ] {
            check_parts(&Cylinder, q, 3);
        }
    }

    #[test]
    fn discs_fit_inside_the_wall() {
        let d = check_parts(
            &Cylinder,
            json!({"diameter": 60, "height": 80, "thickness": 0.5}),
            3,
        );
        let disc = d.panels.iter().find(|q| q.name == "Bottom disc").unwrap();
        let (min, max) = disc
            .outline
            .iter()
            .fold((f64::MAX, f64::MIN), |(lo, hi), q| {
                (lo.min(q.x), hi.max(q.x))
            });
        assert!(max - min < 60.0 && max - min > 58.0, "{}", max - min);
    }
}
