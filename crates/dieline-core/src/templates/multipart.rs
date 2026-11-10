use super::*;
use crate::dieline::AsmStep;
use crate::geom::{pt, Pt};
use crate::params::*;
use serde_json::json;

/// Clearance between a lid or sleeve and the part it slides over, in mm.
const CLEARANCE: f64 = 0.6;

fn bbox_of(outline: &[Pt]) -> (Pt, Pt) {
    let min = pt(
        outline.iter().map(|q| q.x).fold(f64::MAX, f64::min),
        outline.iter().map(|q| q.y).fold(f64::MAX, f64::min),
    );
    let max = pt(
        outline.iter().map(|q| q.x).fold(f64::MIN, f64::max),
        outline.iter().map(|q| q.y).fold(f64::MIN, f64::max),
    );
    (min, max)
}

fn centre(outline: &[Pt]) -> Pt {
    let (a, b) = bbox_of(outline);
    pt((a.x + b.x) / 2.0, (a.y + b.y) / 2.0)
}

fn next_stage(d: &Dieline) -> u32 {
    d.panels.iter().map(|q| q.stage).max().unwrap_or(0) + 1
}

/// Two-piece box: a locking tray and a telescoping lid that slips over it.
pub struct LidAndBase;

impl Template for LidAndBase {
    fn info(&self) -> TemplateInfo {
        TemplateInfo {
            id: "lid-and-base",
            name: "Lid and Base Box",
            category: CAT_BOX,
            description: "Classic two-piece gift box: a locking tray and a lid that slips over it. Two parts, no glue.",
            tags: &["gift", "two-piece", "lid", "shoe box", "no glue"],
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let mut v = vec![
            length("length", "Length", G_DIM, 150.0, 30.0, 1200.0),
            length("width", "Width (front to back)", G_DIM, 100.0, 30.0, 1200.0),
            length("height", "Base height", G_DIM, 50.0, 15.0, 600.0),
            length("lid", "Lid depth", G_DIM, 25.0, 10.0, 300.0),
        ];
        v.extend(material_params(true));
        v.push(boolean("locks", "Lock tabs & slots", true));
        v
    }

    fn build(&self, p: &Params) -> Dieline {
        let BoxDims { l, w, h, t } = BoxDims::from(p);
        let tray = mailer::Mailer { lid: false };
        let base_in = json!({
            "length": p.f("length"), "width": p.f("width"), "height": p.f("height"),
            "thickness": t, "dims": p.s("dims"), "locks": p.b("locks"), "notch": false,
        });
        // the lid's inside is the base's outside plus a little play
        let lid_in = json!({
            "length": l + t + CLEARANCE, "width": w + t + CLEARANCE, "height": p.f("lid"),
            "thickness": t, "dims": "inner", "locks": p.b("locks"), "notch": false,
        });
        let (_, mut d) = generate(&tray, &base_in);
        let (_, lid) = generate(&tray, &lid_in);
        let ox = d.bbox().width() + 20.0;
        let at = d.absorb(lid, ox, 0.0);
        let stage = next_stage(&d);

        // flip the lid over its floor and set it on the base's rim
        let (bc, lc) = (centre(&d.panels[0].outline), centre(&d.panels[at].outline));
        d.assemble(
            at,
            vec![
                AsmStep::rot(lc, [1.0, 0.0, 0.0], 180.0),
                AsmStep::mv(bc.x - lc.x, bc.y - lc.y, h),
            ],
            stage,
        );
        d
    }
}

/// Matchbox-style drawer that slides in a sleeve.
pub struct DrawerBox;

impl Template for DrawerBox {
    fn info(&self) -> TemplateInfo {
        TemplateInfo {
            id: "drawer-box",
            name: "Drawer Box (matchbox)",
            category: CAT_MAILER,
            description: "A drawer with a thumb notch that slides in a sleeve, like a matchbox. Two parts, no glue.",
            tags: &["drawer", "matchbox", "sleeve", "slide", "jewellery", "no glue"],
        }
    }

    fn params(&self) -> Vec<ParamDef> {
        let mut v = vec![
            length("length", "Drawer length", G_DIM, 100.0, 30.0, 1000.0),
            length(
                "width",
                "Drawer depth (slide direction)",
                G_DIM,
                70.0,
                30.0,
                1000.0,
            ),
            length("height", "Drawer height", G_DIM, 30.0, 12.0, 500.0),
        ];
        v.extend(material_params(true));
        v.push(length(
            "flap",
            "Sleeve lock flap width",
            G_OPT,
            15.0,
            8.0,
            50.0,
        ));
        v.push(boolean("notch", "Thumb notch", true));
        v
    }

    fn build(&self, p: &Params) -> Dieline {
        let BoxDims { l, w, h, t } = BoxDims::from(p);
        let drawer_in = json!({
            "length": p.f("length"), "width": p.f("width"), "height": p.f("height"),
            "thickness": t, "dims": p.s("dims"), "locks": true, "notch": p.b("notch"),
        });
        // sleeve: inside = drawer's outside + play; its length is the drawer's depth
        let sleeve_in = json!({
            "length": l + t + CLEARANCE, "width": h + t + CLEARANCE, "height": w + t,
            "thickness": t, "dims": "inner", "flap": p.f("flap"),
        });
        let (sp, mut d) = generate(&sleeve::Sleeve, &sleeve_in);
        let (_, drawer) = generate(&mailer::Mailer { lid: false }, &drawer_in);
        let ox = d.bbox().width() + 20.0;
        let at = d.absorb(drawer, ox, 0.0);
        let stage = next_stage(&d);

        // the drawer sits in the middle of the folded sleeve, resting on its floor
        let s = BoxDims::from(&sp);
        let target = pt(s.l / 2.0, s.h / 2.0);
        let dc = centre(&d.panels[at].outline);
        d.assemble(
            at,
            vec![AsmStep::mv(target.x - dc.x, target.y - dc.y, t + CLEARANCE)],
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
    fn lid_is_wider_than_the_base_by_board_and_play() {
        let t = 0.5;
        let d = check_parts(
            &LidAndBase,
            json!({"length": 150, "width": 100, "height": 50, "lid": 25, "thickness": t}),
            2,
        );
        let base = bbox_of(&d.panels[0].outline);
        let lid_root = d
            .panels
            .iter()
            .position(|q| !q.assembly.is_empty())
            .unwrap();
        let lid = bbox_of(&d.panels[lid_root].outline);
        let dw = (lid.1.x - lid.0.x) - (base.1.x - base.0.x);
        assert!(approx(dw, 2.0 * t + CLEARANCE), "{dw}");
    }

    #[test]
    fn lid_and_base_extremes() {
        for q in [
            json!({"length": 30, "width": 30, "height": 15, "lid": 10}),
            json!({"length": 800, "width": 500, "height": 300, "lid": 200, "thickness": 3, "dims": "outer"}),
        ] {
            check_parts(&LidAndBase, q, 2);
        }
    }

    #[test]
    fn drawer_fits_its_sleeve() {
        let t = 0.5;
        let d = check_parts(
            &DrawerBox,
            json!({"length": 100, "width": 70, "height": 30, "thickness": t}),
            2,
        );
        // sleeve floor panel (first) is wider than the drawer's floor by play + board
        let sleeve = bbox_of(&d.panels[0].outline);
        let drawer_root = d
            .panels
            .iter()
            .position(|q| !q.assembly.is_empty())
            .unwrap();
        let drawer = bbox_of(&d.panels[drawer_root].outline);
        let dw = (sleeve.1.x - sleeve.0.x) - (drawer.1.x - drawer.0.x);
        assert!(dw > 0.5 && dw < 4.0, "{dw}");
    }

    #[test]
    fn drawer_extremes() {
        for q in [
            json!({"length": 30, "width": 30, "height": 12}),
            json!({"length": 600, "width": 400, "height": 200, "thickness": 3}),
        ] {
            check_parts(&DrawerBox, q, 2);
        }
    }
}
