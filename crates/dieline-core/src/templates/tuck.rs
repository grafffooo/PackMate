use super::*;
use crate::geom::{pt, LineKind};
use crate::params::*;

/// Reverse / straight tuck end folding carton.
pub struct TuckEnd {
    pub reverse: bool,
}

impl Template for TuckEnd {
    fn info(&self) -> TemplateInfo {
        if self.reverse {
            TemplateInfo {
                id: "reverse-tuck-end",
                name: "Reverse Tuck End Box",
                category: CAT_BOX,
                description: "The classic retail carton: tuck lids close from opposite sides. Glued side seam.",
                tags: &["carton", "retail", "cosmetics", "rte"],
            }
        } else {
            TemplateInfo {
                id: "straight-tuck-end",
                name: "Straight Tuck End Box",
                category: CAT_BOX,
                description: "Both tuck lids hinge on the back panel, so the front panel stays clean for artwork.",
                tags: &["carton", "retail", "ste"],
            }
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let mut v = vec![
            length("length", "Length", G_DIM, 70.0, 10.0, 1500.0),
            length("width", "Width (depth)", G_DIM, 40.0, 10.0, 1500.0),
            length("height", "Height", G_DIM, 110.0, 10.0, 1500.0),
        ];
        v.extend(material_params(true));
        v.push(length("tuck", "Tuck flap depth", G_OPT, 15.0, 4.0, 80.0));
        v.push(length("glue", "Glue flap width", G_OPT, 12.0, 5.0, 50.0));
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
        let glue = p.f("glue").min(w * 0.9);
        let dust = (l * 0.45).min(w * 0.9);
        let (x1, x2, x3, x4) = (l, l + w, 2.0 * l + w, 2.0 * l + 2.0 * w);

        let panels = tube_panels(&mut d, l, w, h, ["Back", "Side", "Front", "Side"]);
        let mut c = Contour::new(pt(0.0, 0.0));

        // top edge, left to right: lid on the back panel
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
        c.to(pt(x4, h));

        // bottom edge, right to left
        dust_flap(
            &mut c,
            &mut d,
            Edge::new(pt(x4, h), pt(x3, h)),
            dust,
            panels[3],
            1,
        );
        if self.reverse {
            let e = Edge::new(pt(x3, h), pt(x2, h));
            lid_with_tuck(&mut c, &mut d, e, w, tuck, t);
            lid_panels(&mut d, panels[2], e, w, tuck, t, 2, "Bottom lid");
        } else {
            c.to(pt(x2, h));
        }
        dust_flap(
            &mut c,
            &mut d,
            Edge::new(pt(x2, h), pt(x1, h)),
            dust,
            panels[1],
            1,
        );
        if self.reverse {
            c.to(pt(0.0, h));
        } else {
            let e = Edge::new(pt(x1, h), pt(0.0, h));
            lid_with_tuck(&mut c, &mut d, e, w, tuck, t);
            lid_panels(&mut d, panels[0], e, w, tuck, t, 2, "Bottom lid");
        }
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::templates::testutil::*;
    use serde_json::json;

    #[test]
    fn rte_flat_size() {
        let t = TuckEnd { reverse: true };
        let d = check(
            &t,
            json!({"length": 70, "width": 40, "height": 110, "thickness": 0.5}),
        );
        let b = d.bbox();
        // glue 12 + 2*(70.5 + 40.5)
        assert!(
            approx(b.width(), 12.0 + 2.0 * (70.5 + 40.5)),
            "{}",
            b.width()
        );
        // height + 2*(lid 40.5 + tuck 15)
        assert!(
            approx(b.height(), 110.5 + 2.0 * (40.5 + 15.0)),
            "{}",
            b.height()
        );
    }

    #[test]
    fn ste_outer_dims() {
        let t = TuckEnd { reverse: false };
        let d = check(
            &t,
            json!({"length": 70, "width": 40, "height": 110, "thickness": 0.5, "dims": "outer"}),
        );
        assert!(approx(d.bbox().width(), 12.0 + 2.0 * (69.5 + 39.5)));
    }

    #[test]
    fn tiny_and_huge() {
        for t in [TuckEnd { reverse: true }, TuckEnd { reverse: false }] {
            check(&t, json!({"length": 10, "width": 10, "height": 10}));
            check(
                &t,
                json!({"length": 600, "width": 20, "height": 300, "thickness": 3}),
            );
        }
    }
}
