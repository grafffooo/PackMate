use super::*;
use crate::geom::{pt, LineKind};
use crate::params::*;

/// Four-flap envelope sized around a card.
pub struct Envelope;

impl Template for Envelope {
    fn info(&self) -> TemplateInfo {
        TemplateInfo {
            id: "envelope",
            name: "Card Envelope",
            category: CAT_ENV,
            description: "Four-flap envelope sized around your card, with pointed, rounded or straight seal flap.",
            tags: &["envelope", "card", "invitation", "wedding", "a6", "c6"],
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let mut v = vec![
            length("width", "Card width", G_DIM, 148.0, 30.0, 600.0),
            length("height", "Card height", G_DIM, 105.0, 30.0, 600.0),
            length("clearance", "Clearance around card", G_DIM, 3.0, 0.0, 20.0),
            choice(
                "flap",
                "Seal flap",
                G_OPT,
                "pointed",
                &[
                    ("pointed", "Pointed"),
                    ("rounded", "Rounded"),
                    ("straight", "Straight"),
                ],
            ),
        ];
        v.extend(material_params(false));
        v[4].kind = ParamKind::Length {
            default: 0.15,
            min: 0.05,
            max: 2.0,
        };
        v
    }

    fn build(&self, p: &Params) -> Dieline {
        let mut d = Dieline::new();
        let t = p.f("thickness");
        let w = p.f("width") + 2.0 * p.f("clearance") + 2.0 * t;
        let h = p.f("height") + 2.0 * p.f("clearance") + 2.0 * t;
        let top = h * 0.45;
        let bottom = h * 0.62;
        let side = (w * 0.22).clamp(12.0, 45.0).min(w * 0.45);

        let mut c = Contour::new(pt(0.0, 0.0));
        // seal flap
        let e = Edge::new(pt(0.0, 0.0), pt(w, 0.0));
        let top_outline = match p.s("flap") {
            "rounded" => {
                let tt = (w * 0.08).min(top * 0.4);
                push_profile(
                    &mut c,
                    &e,
                    &[
                        Prof::P(tt, top * 0.35, 0.0),
                        Prof::A(w - tt, top * 0.35, top * 0.65),
                        Prof::P(w, 0.0, 0.0),
                    ],
                );
                vec![
                    e.at(0.0, 0.0),
                    e.at(tt, top * 0.35),
                    e.at(w / 2.0, top),
                    e.at(w - tt, top * 0.35),
                    e.at(w, 0.0),
                ]
            }
            "straight" => {
                let tt = top * 0.35;
                let r = (top * 0.15).min(6.0);
                push_profile(
                    &mut c,
                    &e,
                    &[
                        Prof::P(tt, top, r),
                        Prof::P(w - tt, top, r),
                        Prof::P(w, 0.0, 0.0),
                    ],
                );
                vec![
                    e.at(0.0, 0.0),
                    e.at(tt, top),
                    e.at(w - tt, top),
                    e.at(w, 0.0),
                ]
            }
            _ => {
                let r = (top * 0.12).min(8.0);
                push_profile(
                    &mut c,
                    &e,
                    &[Prof::P(w / 2.0, top, r), Prof::P(w, 0.0, 0.0)],
                );
                vec![e.at(0.0, 0.0), e.at(w / 2.0, top), e.at(w, 0.0)]
            }
        };
        let side_prof = |len: f64| {
            let ins = (len * 0.18).min(side * 0.9);
            let r = (side * 0.3).min(6.0);
            [
                Prof::P(ins, side, r),
                Prof::P(len - ins, side, r),
                Prof::P(len, 0.0, 0.0),
            ]
        };
        let er = Edge::new(pt(w, 0.0), pt(w, h));
        push_profile(&mut c, &er, &side_prof(h));
        let eb = Edge::new(pt(w, h), pt(0.0, h));
        let bt = w * 0.12;
        let br = (bottom * 0.15).min(8.0);
        push_profile(
            &mut c,
            &eb,
            &[
                Prof::P(bt, bottom, br),
                Prof::P(w - bt, bottom, br),
                Prof::P(w, 0.0, 0.0),
            ],
        );
        let el = Edge::new(pt(0.0, h), pt(0.0, 0.0));
        push_profile(&mut c, &el, &side_prof(h));
        d.add(c.close(LineKind::Cut));

        d.crease(pt(0.0, 0.0), pt(w, 0.0));
        d.crease(pt(w, 0.0), pt(w, h));
        d.crease(pt(w, h), pt(0.0, h));
        d.crease(pt(0.0, h), pt(0.0, 0.0));

        let back = d.root("Back", rect(0.0, 0.0, w, h));
        let ins = (h * 0.18).min(side * 0.9);
        for e in [er, el] {
            d.fold(
                "Side flap",
                vec![
                    e.at(0.0, 0.0),
                    e.at(ins, side),
                    e.at(h - ins, side),
                    e.at(h, 0.0),
                ],
                back,
                e.at(0.0, 0.0),
                e.at(h, 0.0),
                179.6,
                0,
            );
            d.quiet();
        }
        let bo = vec![
            eb.at(0.0, 0.0),
            eb.at(bt, bottom),
            eb.at(w - bt, bottom),
            eb.at(w, 0.0),
        ];
        // glue strips along the bottom flap's slanted edges
        for (a, b) in [(0.0, bt), (w, w - bt)] {
            let k = 0.85;
            let g = 6.0f64.min(bt * 0.5);
            let dir = if a == 0.0 { 1.0 } else { -1.0 };
            d.glue.push(vec![
                eb.at(a + dir * 2.0, 1.0),
                eb.at(a + (b - a) * k, bottom * k),
                eb.at(a + (b - a) * k + dir * g, bottom * k),
                eb.at(a + dir * (2.0 + g), 1.0),
            ]);
        }
        d.fold(
            "Bottom flap",
            bo,
            back,
            eb.at(0.0, 0.0),
            eb.at(w, 0.0),
            179.2,
            1,
        );
        d.fold(
            "Seal flap",
            top_outline,
            back,
            pt(0.0, 0.0),
            pt(w, 0.0),
            178.5,
            2,
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
    fn envelope_styles() {
        for f in ["pointed", "rounded", "straight"] {
            let d = check(
                &Envelope,
                json!({"flap": f, "thickness": 0, "clearance": 0}),
            );
            let b = d.bbox();
            let (w, h) = (148.1f64, 105.1);
            let side = (w * 0.22).clamp(12.0, 45.0);
            assert!(approx(b.width(), w + 2.0 * side), "{f} {}", b.width());
            // the rounded tip of the seal flap trims a little height
            let full = h * (1.0 + 0.45 + 0.62);
            assert!(
                b.height() <= full + 0.01 && b.height() > full - 3.0,
                "{f} {}",
                b.height()
            );
        }
        check(&Envelope, json!({"width": 30, "height": 30}));
    }
}
