use super::*;
use crate::geom::{pt, LineKind, Pt};
use crate::params::*;
use std::f64::consts::PI;

/// Corners of a regular `n`-gon with its first edge `v0 -> v1` horizontal at the top, travelling
/// clockwise on screen. `c` is the centre, `r_out` the circumradius.
fn polygon(c: Pt, n: usize, r_out: f64) -> Vec<Pt> {
    (0..n)
        .map(|k| {
            let a = -PI / 2.0 - PI / n as f64 + 2.0 * PI * k as f64 / n as f64;
            c + Pt::polar(a) * r_out
        })
        .collect()
}

fn sides(p: &Params, max: usize) -> usize {
    (p.f("sides").round() as usize).clamp(3, max)
}

/// Prism box on a regular polygon: a strip of wall panels, a base polygon and a lid polygon with a
/// tuck flap. The seam locks with a tongue and slit.
pub struct PolygonBox;

impl Template for PolygonBox {
    fn info(&self) -> TemplateInfo {
        TemplateInfo {
            id: "polygon-box",
            name: "Hexagon / Polygon Box",
            category: CAT_SHAPE,
            description: "Gift box on a regular polygon: three to eight sides, hexagon by default. Hinged lid with a tuck flap, locking seam, no glue.",
            tags: &["hexagon", "octagon", "polygon", "gift", "no glue"],
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let mut v = vec![
            number("sides", "Number of sides", G_DIM, 6.0, 3.0, 8.0, 1.0),
            length("side", "Side length", G_DIM, 40.0, 10.0, 600.0),
            length("height", "Height", G_DIM, 50.0, 10.0, 600.0),
        ];
        v.extend(material_params(true));
        v.push(length("tuck", "Lid tuck depth", G_OPT, 12.0, 4.0, 60.0));
        v.push(length("flap", "Lock flap width", G_OPT, 14.0, 8.0, 50.0));
        v
    }

    fn build(&self, p: &Params) -> Dieline {
        let n = sides(p, 8);
        let nf = n as f64;
        let t = p.f("thickness");
        let k = if p.s("dims") == "outer" { -t } else { t };
        let tan = (PI / nf).tan();
        // panel widths follow the board's centre line
        let a = (p.f("side") + k * tan).max(5.0);
        let h = p.f("height") + k;
        let r = a / (2.0 * tan);
        let big_r = a / (2.0 * (PI / nf).sin());
        let fold = 360.0 / nf;
        let mut d = Dieline::new();
        let mut tuck = p.f("tuck");
        if tuck > 0.45 * r {
            tuck = 0.45 * r;
            d.warn("Tuck flap shortened to fit the lid.");
        }
        let g = p.f("flap").min(a * 0.9);

        // walls
        let mut walls = vec![d.root("Wall 1", rect(0.0, 0.0, a, h))];
        for i in 1..n {
            let x = i as f64 * a;
            let w = d.fold(
                &format!("Wall {}", i + 1),
                rect(x, 0.0, x + a, h),
                walls[i - 1],
                pt(x, 0.0),
                pt(x, h),
                fold,
                0,
            );
            walls.push(w);
            d.crease(pt(x, 0.0), pt(x, h));
        }

        // base below wall 1, lid above wall `kk`
        let base_v = polygon(pt(a / 2.0, h + r), n, big_r);
        let kk = n / 2;
        let lid_c = pt((kk as f64 + 0.5) * a, -r);
        let lid_v: Vec<Pt> = (0..n)
            .map(|j| {
                let ang = PI / 2.0 + PI / nf + 2.0 * PI * j as f64 / nf;
                lid_c + Pt::polar(ang) * big_r
            })
            .collect();
        d.crease(pt(0.0, h), pt(a, h));
        d.fold(
            "Base",
            base_v.clone(),
            walls[0],
            pt(0.0, h),
            pt(a, h),
            90.0,
            1,
        );
        d.crease(pt(kk as f64 * a, 0.0), pt((kk as f64 + 1.0) * a, 0.0));
        let lid = d.fold(
            "Lid",
            lid_v.clone(),
            walls[kk],
            pt(kk as f64 * a, 0.0),
            pt((kk as f64 + 1.0) * a, 0.0),
            90.0,
            2,
        );

        // outline, clockwise from the top-left corner
        let mut c = Contour::new(pt(0.0, 0.0));
        c.to(pt(kk as f64 * a, 0.0));
        let tuck_edge = (n - 1 + n / 2) % n;
        for j in 0..n {
            c.to(lid_v[j]);
            if j == tuck_edge {
                let e = Edge::new(lid_v[j], lid_v[(j + 1) % n]);
                let l = e.len;
                let ins = (tuck * 0.35).min(l * 0.2);
                push_profile(
                    &mut c,
                    &e,
                    &[
                        Prof::P(ins, tuck, (tuck * 0.4).min(6.0)),
                        Prof::P(l - ins, tuck, (tuck * 0.4).min(6.0)),
                        Prof::P(l, 0.0, 0.0),
                    ],
                );
                d.crease(e.at(0.0, 0.0), e.at(l, 0.0));
                d.fold(
                    "Tuck flap",
                    vec![
                        e.at(0.0, 0.0),
                        e.at(ins, tuck),
                        e.at(l - ins, tuck),
                        e.at(l, 0.0),
                    ],
                    lid,
                    e.at(0.0, 0.0),
                    e.at(l, 0.0),
                    90.0,
                    3,
                );
                d.quiet();
            }
        }
        c.to(pt((kk as f64 + 1.0) * a, 0.0));
        c.to(pt(nf * a, 0.0));
        let e = Edge::new(pt(nf * a, 0.0), pt(nf * a, h));
        let span = lock_flap(
            &mut c,
            &mut d,
            e,
            g,
            (h * 0.5).min(40.0),
            t,
            walls[n - 1],
            fold,
            1,
            None,
        );
        c.to(pt(nf * a, h));
        c.to(pt(a, h));
        for v in base_v.iter().skip(2) {
            c.to(*v);
        }
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

/// Regular pyramid on a polygon base, folded from a star-shaped development. Every slant seam
/// locks with a tongue and slit.
pub struct Pyramid;

impl Template for Pyramid {
    fn info(&self) -> TemplateInfo {
        TemplateInfo {
            id: "pyramid",
            name: "Pyramid",
            category: CAT_SHAPE,
            description: "Pyramid on a three to eight sided base for favours, ornaments and display. Each seam locks with a tongue and slit, no glue.",
            tags: &["pyramid", "triangle", "ornament", "favour", "no glue"],
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let mut v = vec![
            number("sides", "Number of sides", G_DIM, 4.0, 3.0, 8.0, 1.0),
            length("side", "Base side length", G_DIM, 60.0, 15.0, 600.0),
            length("height", "Height", G_DIM, 80.0, 15.0, 800.0),
        ];
        v.extend(material_params(false));
        v.push(length("flap", "Lock flap width", G_OPT, 10.0, 6.0, 40.0));
        v
    }

    fn build(&self, p: &Params) -> Dieline {
        let n = sides(p, 8);
        let nf = n as f64;
        let t = p.f("thickness");
        let a = p.f("side");
        let hgt = p.f("height");
        let r = a / (2.0 * (PI / nf).tan());
        let big_r = a / (2.0 * (PI / nf).sin());
        let slant = hgt.hypot(r);
        let lateral = hgt.hypot(big_r);
        // face lean from the horizontal, and the angle between neighbouring faces
        let alpha = hgt.atan2(r);
        let cos_psi = alpha.sin().powi(2) * (2.0 * PI / nf).cos() + alpha.cos().powi(2);
        let psi = cos_psi.clamp(-1.0, 1.0).acos().to_degrees();
        let tilt = 180.0 - alpha.to_degrees();
        // wedge left between neighbouring triangles at a base corner: it limits how wide the flaps can be
        let corner = (PI - 2.0 * PI / nf).to_degrees();
        let base_ang = (a / (2.0 * lateral)).acos().to_degrees();
        let gap = (360.0 - corner - 2.0 * base_ang).max(10.0);
        let g = p.f("flap").min(lateral * 0.3);
        let taper = g / (gap * 0.5).to_radians().tan().max(0.2);

        let mut d = Dieline::new();
        let v = polygon(pt(0.0, 0.0), n, big_r);
        let base = d.root("Base", v.clone());
        let apex: Vec<Pt> = (0..n)
            .map(|k| {
                let e = Edge::new(v[k], v[(k + 1) % n]);
                e.at(a / 2.0, slant)
            })
            .collect();

        let mut c = Contour::new(v[0]);
        for k in 0..n {
            let (v0, v1) = (v[k], v[(k + 1) % n]);
            d.crease(v0, v1);
            let tri = d.fold(
                &format!("Face {}", k + 1),
                vec![v0, v1, apex[k]],
                base,
                v0,
                v1,
                tilt,
                0,
            );
            c.to(apex[k]);
            let e = Edge::new(apex[k], v1);
            let span = lock_flap(
                &mut c,
                &mut d,
                e,
                g,
                (lateral * 0.45).min(40.0),
                t,
                tri,
                psi,
                1,
                Some(taper),
            );
            // the receiving slit sits in the next face, along its edge from this corner
            let next = (k + 1) % n;
            let en = Edge::new(v1, apex[next]);
            lock_slit(&mut d, &en, g, span, t, true);
        }
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
    fn hexagon_default() {
        let d = check(&PolygonBox, json!({}));
        assert!(d.glue.is_empty());
        // 6 walls of ~40 mm
        assert!(d.bbox().width() > 6.0 * 40.0, "{}", d.bbox().width());
    }

    #[test]
    fn polygon_every_side_count_and_extremes() {
        for n in 3..=8 {
            check(&PolygonBox, json!({"sides": n}));
            check(
                &PolygonBox,
                json!({"sides": n, "side": 10, "height": 10, "tuck": 60}),
            );
            check(
                &PolygonBox,
                json!({"sides": n, "side": 500, "height": 300, "thickness": 3, "dims": "outer"}),
            );
        }
    }

    #[test]
    fn polygon_wall_width_follows_side_length() {
        let d = check(
            &PolygonBox,
            json!({"sides": 6, "side": 40, "thickness": 0.05}),
        );
        let w = &d.panels[0].outline;
        let width = w[1].x - w[0].x;
        assert!(approx(width, 40.0 + 0.05 * (PI / 6.0).tan()), "{width}");
    }

    #[test]
    fn pyramid_every_side_count_and_extremes() {
        for n in 3..=8 {
            check(&Pyramid, json!({"sides": n}));
            check(&Pyramid, json!({"sides": n, "side": 15, "height": 800}));
            check(
                &Pyramid,
                json!({"sides": n, "side": 600, "height": 15, "flap": 40}),
            );
        }
    }

    #[test]
    fn pyramid_faces_share_the_apex_height() {
        let d = check(&Pyramid, json!({"sides": 4, "side": 60, "height": 80}));
        // slant height sqrt(80^2 + 30^2) is the face's apex distance from the base edge
        let tri = &d.panels[1].outline;
        let mid = tri[0].lerp(tri[1], 0.5);
        assert!(
            approx(mid.dist(tri[2]), 80f64.hypot(30.0)),
            "{}",
            mid.dist(tri[2])
        );
    }
}
