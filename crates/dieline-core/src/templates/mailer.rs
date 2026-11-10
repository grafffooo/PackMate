use super::*;
use crate::geom::{pt, LineKind, Path, Pt};
use crate::params::*;

/// Roll-end tuck-front mailer (`lid = true`) and the matching open tray (`lid = false`).
/// Glue-free: double side walls lock with tabs into slots in the base.
pub struct Mailer {
    pub lid: bool,
}

impl Template for Mailer {
    fn info(&self) -> TemplateInfo {
        if self.lid {
            TemplateInfo {
                id: "mailer-box",
                name: "Mailer Box (flip-top)",
                category: CAT_MAILER,
                description: "Roll-end tuck-front mailer with double side walls. No glue needed — ideal for subscription and shipping boxes.",
                tags: &["mailer", "shipping", "subscription", "e-commerce", "no glue"],
            }
        } else {
            TemplateInfo {
                id: "tray",
                name: "Locking Tray",
                category: CAT_MAILER,
                description: "Open tray with double side walls and lock tabs. Great as a drawer, insert or display tray.",
                tags: &["tray", "insert", "display", "no glue"],
            }
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let (l, w, h) = if self.lid {
            (200.0, 150.0, 50.0)
        } else {
            (150.0, 100.0, 40.0)
        };
        let mut v = vec![
            length("length", "Length", G_DIM, l, 30.0, 1500.0),
            length("width", "Width (front to back)", G_DIM, w, 30.0, 1500.0),
            length("height", "Height", G_DIM, h, 10.0, 600.0),
        ];
        v.extend(material_params(true));
        if self.lid {
            v.push(length("tuck", "Lid tuck depth", G_OPT, 20.0, 5.0, 100.0));
        }
        v.push(boolean("locks", "Lock tabs & slots", true));
        v.push(boolean("notch", "Thumb notch in front wall", !self.lid));
        v
    }

    fn build(&self, p: &Params) -> Dieline {
        let BoxDims {
            l: bl,
            w: bw,
            h: hd,
            t,
        } = BoxDims::from(p);
        let mut d = Dieline::new();
        let id = hd - t; // inner (rolled) side wall
        let el = (bw * 0.5 - t).min(hd * 1.5); // ear length
        let c = (hd * 0.15).min(el * 0.2).min(3.0); // chamfer
        let tab_d = (2.0 * t + 1.0).max(3.0);
        let tch = (tab_d * 0.5).min(1.5);
        let tabs = [(0.15, 0.4), (0.6, 0.85)];
        let locks = p.b("locks");

        // lid
        let lw = bw + t;
        let fh = hd + t;
        let mut tuck = p.f("tuck");
        if self.lid && tuck > hd - 2.0 * t {
            tuck = (hd - 2.0 * t).max(3.0);
            d.warn("Lid tuck shortened to fit the wall height.");
        }
        let dd = (hd - 2.0 * t).max(2.0);
        let g1 = 2.0 * t + 0.5;
        let taper = (dd * 0.3).min(lw * 0.1);
        let ytop = -hd - lw - fh;

        // ---- outline (clockwise) ----
        let mut k = if self.lid {
            let mut k = Contour::new(pt(-t, ytop));
            let e = Edge::new(pt(-t, ytop), pt(bl + t, ytop));
            let r = (tuck * 0.4).min(8.0);
            push_profile(
                &mut k,
                &e,
                &[
                    Prof::P(2.0 * t, 0.0, 0.0),
                    Prof::P(2.0 * t, tuck, r),
                    Prof::P(bl, tuck, r),
                    Prof::P(bl, 0.0, 0.0),
                    Prof::P(bl + 2.0 * t, 0.0, 0.0),
                ],
            );
            // right side of lid with dust flap
            k.to(pt(bl + t, -hd - lw + g1));
            k.to(pt(bl + t + dd, -hd - lw + g1 + taper));
            k.to(pt(bl + t + dd, -hd - g1 - taper));
            k.to(pt(bl + t, -hd - g1));
            k.to(pt(bl + t, -hd));
            k.to(pt(bl, -hd));
            k
        } else {
            let mut k = Contour::new(pt(0.0, -hd));
            k.to(pt(bl, -hd));
            k
        };
        // right back ear
        k.to(pt(bl, -hd + t));
        k.to(pt(bl + el - c, -hd + t));
        k.to(pt(bl + el, -hd + t + c));
        k.to(pt(bl + el, -c));
        k.to(pt(bl, 0.0));
        // right side walls with lock tabs
        let xo = bl + hd + id;
        k.to(pt(bl + hd, 0.0));
        k.to(pt(xo, 0.0));
        if locks {
            for (a, b) in tabs {
                k.to(pt(xo, bw * a));
                k.to(pt(xo + tab_d, bw * a + tch));
                k.to(pt(xo + tab_d, bw * b - tch));
                k.to(pt(xo, bw * b));
            }
        }
        k.to(pt(xo, bw));
        k.to(pt(bl + hd, bw));
        k.to(pt(bl, bw));
        // right front ear
        k.to(pt(bl + el, bw + c));
        k.to(pt(bl + el, bw + hd - t - c));
        k.to(pt(bl + el - c, bw + hd - t));
        k.to(pt(bl, bw + hd - t));
        k.to(pt(bl, bw + hd));
        // front wall rim with optional thumb notch
        if p.b("notch") {
            let rn = (bl * 0.12).min(hd * 0.4).min(12.0);
            k.to(pt(bl / 2.0 + rn, bw + hd));
            k.arc(pt(bl / 2.0 - rn, bw + hd), -rn);
        }
        k.to(pt(0.0, bw + hd));
        // left front ear
        k.to(pt(0.0, bw + hd - t));
        k.to(pt(-el + c, bw + hd - t));
        k.to(pt(-el, bw + hd - t - c));
        k.to(pt(-el, bw + c));
        k.to(pt(0.0, bw));
        // left side walls
        let xo = -hd - id;
        k.to(pt(-hd, bw));
        k.to(pt(xo, bw));
        if locks {
            for (a, b) in tabs.iter().rev() {
                k.to(pt(xo, bw * b));
                k.to(pt(xo - tab_d, bw * b - tch));
                k.to(pt(xo - tab_d, bw * a + tch));
                k.to(pt(xo, bw * a));
            }
        }
        k.to(pt(xo, 0.0));
        k.to(pt(-hd, 0.0));
        k.to(pt(0.0, 0.0));
        // left back ear
        k.to(pt(-el, -c));
        k.to(pt(-el, -hd + t + c));
        k.to(pt(-el + c, -hd + t));
        k.to(pt(0.0, -hd + t));
        k.to(pt(0.0, -hd));
        if self.lid {
            k.to(pt(-t, -hd));
            k.to(pt(-t, -hd - g1));
            k.to(pt(-t - dd, -hd - g1 - taper));
            k.to(pt(-t - dd, -hd - lw + g1 + taper));
            k.to(pt(-t, -hd - lw + g1));
        }
        d.add(k.close(LineKind::Cut));

        // ---- slots ----
        if locks {
            let sw = (2.0 * t).max(1.2);
            for (a, b) in tabs {
                let (y0, y1) = (bw * a - 0.3, bw * b + 0.3);
                for x0 in [0.5 * t, bl - 0.5 * t - sw] {
                    d.add(Path::polyline(
                        LineKind::Cut,
                        &rect(x0, y0, x0 + sw, y1),
                        true,
                    ));
                }
            }
        }

        // ---- creases ----
        let cr = |d: &mut Dieline, a: Pt, b: Pt| d.crease(a, b);
        cr(&mut d, pt(0.0, 0.0), pt(bl, 0.0));
        cr(&mut d, pt(0.0, bw), pt(bl, bw));
        cr(&mut d, pt(0.0, 0.0), pt(0.0, bw));
        cr(&mut d, pt(bl, 0.0), pt(bl, bw));
        cr(&mut d, pt(-hd, 0.0), pt(-hd, bw));
        cr(&mut d, pt(bl + hd, 0.0), pt(bl + hd, bw));
        cr(&mut d, pt(0.0, bw), pt(0.0, bw + hd - t));
        cr(&mut d, pt(bl, bw), pt(bl, bw + hd - t));
        cr(&mut d, pt(0.0, -hd + t), pt(0.0, 0.0));
        cr(&mut d, pt(bl, -hd + t), pt(bl, 0.0));
        if self.lid {
            cr(&mut d, pt(0.0, -hd), pt(bl, -hd));
            cr(&mut d, pt(-t, -hd - lw), pt(bl + t, -hd - lw));
            cr(&mut d, pt(t, ytop), pt(bl - t, ytop));
            cr(&mut d, pt(-t, -hd - lw + g1), pt(-t, -hd - g1));
            cr(&mut d, pt(bl + t, -hd - lw + g1), pt(bl + t, -hd - g1));
        }

        // ---- fold model ----
        let base = d.root("Base", rect(0.0, 0.0, bl, bw));
        let back = d.fold(
            "Back",
            rect(0.0, -hd, bl, 0.0),
            base,
            pt(0.0, 0.0),
            pt(bl, 0.0),
            90.0,
            0,
        );
        let front = d.fold(
            "Front",
            rect(0.0, bw, bl, bw + hd),
            base,
            pt(0.0, bw),
            pt(bl, bw),
            90.0,
            0,
        );
        let ear = |x: f64, y0: f64, y1: f64, s: f64| -> Vec<Pt> {
            // s: +1 ear to the right, -1 to the left; y0 = base side, y1 = rim side
            let dir = if y1 > y0 { 1.0 } else { -1.0 };
            vec![
                pt(x, y0),
                pt(x + s * el, y0 + dir * c),
                pt(x + s * el, y1 - dir * c),
                pt(x + s * (el - c), y1),
                pt(x, y1),
            ]
        };
        for (x, s) in [(0.0, -1.0), (bl, 1.0)] {
            d.fold(
                "Ear",
                ear(x, bw, bw + hd - t, s),
                front,
                pt(x, bw),
                pt(x, bw + hd - t),
                90.0,
                1,
            );
            d.quiet();
            d.fold(
                "Ear",
                ear(x, 0.0, -hd + t, s),
                back,
                pt(x, 0.0),
                pt(x, -hd + t),
                90.0,
                1,
            );
            d.quiet();
        }
        let lo = d.fold(
            "Side",
            rect(-hd, 0.0, 0.0, bw),
            base,
            pt(0.0, 0.0),
            pt(0.0, bw),
            90.0,
            2,
        );
        let ro = d.fold(
            "Side",
            rect(bl, 0.0, bl + hd, bw),
            base,
            pt(bl, 0.0),
            pt(bl, bw),
            90.0,
            2,
        );
        d.fold(
            "Inner side",
            rect(-hd - id, 0.0, -hd, bw),
            lo,
            pt(-hd, 0.0),
            pt(-hd, bw),
            179.0,
            3,
        );
        d.quiet();
        d.fold(
            "Inner side",
            rect(bl + hd, 0.0, bl + hd + id, bw),
            ro,
            pt(bl + hd, 0.0),
            pt(bl + hd, bw),
            179.0,
            3,
        );
        d.quiet();
        if self.lid {
            let lid = d.fold(
                "Lid",
                rect(-t, -hd - lw, bl + t, -hd),
                back,
                pt(0.0, -hd),
                pt(bl, -hd),
                90.0,
                4,
            );
            for (x, s) in [(-t, -1.0), (bl + t, 1.0)] {
                d.fold(
                    "Dust flap",
                    vec![
                        pt(x, -hd - g1),
                        pt(x + s * dd, -hd - g1 - taper),
                        pt(x + s * dd, -hd - lw + g1 + taper),
                        pt(x, -hd - lw + g1),
                    ],
                    lid,
                    pt(x, -hd - g1),
                    pt(x, -hd - lw + g1),
                    90.0,
                    4,
                );
                d.quiet();
            }
            let lf = d.fold(
                "Lid front",
                rect(-t, ytop, bl + t, -hd - lw),
                lid,
                pt(-t, -hd - lw),
                pt(bl + t, -hd - lw),
                90.0,
                4,
            );
            d.quiet();
            d.fold(
                "Tuck",
                rect(t, ytop - tuck, bl - t, ytop),
                lf,
                pt(t, ytop),
                pt(bl - t, ytop),
                90.0,
                4,
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
    fn mailer_flat_size() {
        let m = Mailer { lid: true };
        let d = check(
            &m,
            json!({"length": 200, "width": 150, "height": 50, "thickness": 1}),
        );
        let b = d.bbox();
        let (bl, bw, hd, t) = (201.0, 151.0, 51.0, 1.0);
        let tab = 3.0;
        assert!(
            approx(b.width(), bl + 2.0 * (hd + hd - t + tab)),
            "{}",
            b.width()
        );
        // tuck + lid front + lid + back + base + front
        assert!(
            approx(b.height(), 20.0 + (hd + t) + (bw + t) + hd + bw + hd),
            "{}",
            b.height()
        );
    }

    #[test]
    fn tray_and_options() {
        let m = Mailer { lid: false };
        check(&m, json!({}));
        check(&m, json!({"locks": false, "notch": false}));
        check(
            &Mailer { lid: true },
            json!({"notch": true, "length": 40, "width": 30, "height": 10}),
        );
        check(&Mailer { lid: true }, json!({"thickness": 3, "height": 15}));
    }
}
