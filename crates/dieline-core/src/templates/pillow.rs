use super::*;
use crate::geom::{pt, LineKind};
use crate::params::*;

/// Pillow box: two panels with curved end creases.
pub struct Pillow;

impl Template for Pillow {
    fn info(&self) -> TemplateInfo {
        TemplateInfo {
            id: "pillow-box",
            name: "Pillow Box",
            category: CAT_SPECIAL,
            description: "Curved-end gift box for favours, jewellery and gift cards. Folds flat, one glue seam.",
            tags: &["gift", "favour", "wedding", "curved", "needs glue"],
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let mut v = vec![
            length("length", "Length", G_DIM, 140.0, 30.0, 1000.0),
            length("width", "Width", G_DIM, 80.0, 20.0, 600.0),
            length("curve", "End curve depth", G_DIM, 14.0, 3.0, 150.0)
                .help("How far the curved crease bulges. Deeper curves give a puffier box."),
        ];
        v.extend(material_params(false));
        v.push(length("glue", "Glue flap width", G_OPT, 12.0, 5.0, 40.0));
        v
    }

    fn build(&self, p: &Params) -> Dieline {
        let mut d = Dieline::new();
        let t = p.f("thickness");
        let w = p.f("width") + t;
        let l = p.f("length");
        let mut s = p.f("curve");
        // the cut arc (2x the crease sagitta) must stay below a semicircle
        if s > w * 0.22 {
            s = w * 0.22;
            d.warn("End curve limited to 22% of the width.");
        }
        let g = p.f("glue").min(w * 0.5);
        let cut_s = 2.0 * s;

        let mut c = Contour::new(pt(0.0, 0.0));
        c.arc(pt(w, 0.0), cut_s);
        c.arc(pt(2.0 * w, 0.0), cut_s);
        c.to(pt(2.0 * w, l));
        c.arc(pt(w, l), cut_s);
        c.arc(pt(0.0, l), cut_s);
        let root_strip = 0usize;
        glue_flap_raw(&mut c, &mut d, g, l);
        d.add(c.close(LineKind::Cut));

        for x0 in [0.0, w] {
            for (y, a, b) in [(0.0, x0, x0 + w), (l, x0 + w, x0)] {
                let mut k = Contour::new(pt(a, y));
                k.arc(pt(b, y), s);
                d.add(k.open(LineKind::Crease));
            }
        }
        d.crease(pt(0.0, 0.0), pt(0.0, l));
        d.crease(pt(w, 0.0), pt(w, l));

        // Fold model: each panel bends through `phi` using virtual strips so the preview bulges.
        let n = 6;
        let phi = 70.0f64;
        let joint = 180.0 - phi;
        let sw = w / n as f64;
        let mut prev = None;
        for panel in 0..2 {
            for i in 0..n {
                let x0 = panel as f64 * w + i as f64 * sw;
                let r = rect(x0, 0.0, x0 + sw, l);
                let idx = match prev {
                    None => d.root("Front", r),
                    Some(pi) => {
                        let ang = if i == 0 { joint } else { phi / (n - 1) as f64 };
                        d.fold(
                            if panel == 0 { "Front" } else { "Back" },
                            r,
                            pi,
                            pt(x0, 0.0),
                            pt(x0, l),
                            ang,
                            0,
                        )
                    }
                };
                if i != n / 2 {
                    d.quiet();
                }
                prev = Some(idx);
            }
        }
        // glue flap closes the loop back onto the last strip
        let ch = g.min(l * 0.2);
        d.fold(
            "Glue flap",
            vec![pt(0.0, l), pt(-g, l - ch), pt(-g, ch), pt(0.0, 0.0)],
            root_strip,
            pt(0.0, l),
            pt(0.0, 0.0),
            joint,
            0,
        );
        d.quiet();
        d
    }
}

fn glue_flap_raw(c: &mut Contour, d: &mut Dieline, g: f64, l: f64) {
    let ch = g.min(l * 0.2);
    c.to(pt(-g, l - ch));
    c.to(pt(-g, ch));
    d.glue
        .push(vec![pt(0.0, l), pt(-g, l - ch), pt(-g, ch), pt(0.0, 0.0)]);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::templates::testutil::*;
    use serde_json::json;

    #[test]
    fn pillow_ok() {
        let d = check(
            &Pillow,
            json!({"width": 80, "length": 140, "curve": 14, "thickness": 0}),
        );
        let b = d.bbox();
        assert!(approx(b.width(), 12.0 + 160.1));
        assert!(approx(b.height(), 140.0 + 4.0 * 14.0), "{}", b.height());
        check(&Pillow, json!({"curve": 500}));
    }
}
