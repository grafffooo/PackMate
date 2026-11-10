//! The generated artwork: strokes for the machine plus a fold model for the 3D preview.

use crate::geom::{pt, BBox, LineKind, Path, Pt};
use serde::Serialize;

/// One step of a rigid motion that carries a separate part (a lid, a divider) from where it lies on
/// the flat sheet to where it sits in the assembled package. Points and directions are layout
/// coordinates (mm, y down) plus a `z` that points out of the sheet towards the viewer; angles
/// follow the right-hand rule as seen in the preview (x right, y up, z towards the viewer). The 3D
/// preview interpolates each step with the fold slider.
#[derive(Clone, Copy, Debug, Serialize)]
#[serde(tag = "t", rename_all = "lowercase")]
pub enum AsmStep {
    /// Rotate by `angle` degrees about the line through `pivot` with direction `axis`.
    Rot {
        pivot: [f64; 3],
        axis: [f64; 3],
        angle: f64,
    },
    /// Translate by `d`.
    Move { d: [f64; 3] },
}

impl AsmStep {
    pub fn rot(pivot: Pt, axis: [f64; 3], angle: f64) -> AsmStep {
        AsmStep::Rot {
            pivot: [pivot.x, pivot.y, 0.0],
            axis,
            angle,
        }
    }
    pub fn mv(x: f64, y: f64, z: f64) -> AsmStep {
        AsmStep::Move { d: [x, y, z] }
    }
    fn shifted(self, dx: f64, dy: f64) -> AsmStep {
        match self {
            AsmStep::Rot { pivot, axis, angle } => AsmStep::Rot {
                pivot: [pivot[0] + dx, pivot[1] + dy, pivot[2]],
                axis,
                angle,
            },
            m => m,
        }
    }
}

/// A rigid face of the folded package. Panels form a tree: each child rotates about its `hinge`
/// (a line in flat-layout coordinates) relative to its parent by `angle` degrees. A positive angle
/// folds the panel towards the inside of the package.
#[derive(Clone, Debug, Serialize)]
pub struct Panel {
    pub name: String,
    pub outline: Vec<Pt>,
    pub parent: Option<usize>,
    pub hinge: Option<[Pt; 2]>,
    pub angle: f64,
    /// Fold sequence step; the preview animates stage 0 first.
    pub stage: u32,
    /// Show a label for this panel in the flat preview.
    pub label: bool,
    /// Only for the root of a separate part: how it moves into place when the package is assembled.
    /// Runs at this panel's `stage`. Empty for the main part and for all non-root panels.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub assembly: Vec<AsmStep>,
}

#[derive(Clone, Debug, Default)]
pub struct Dieline {
    pub paths: Vec<Path>,
    pub panels: Vec<Panel>,
    /// Areas that receive glue (preview only).
    pub glue: Vec<Vec<Pt>>,
    pub warnings: Vec<String>,
    /// The folded package stands along the layout's y axis (tubes); otherwise parts lie on the
    /// sheet plane. Only affects how the 3D preview is oriented.
    pub upright: bool,
}

impl Dieline {
    pub fn new() -> Dieline {
        Dieline::default()
    }
    pub fn add(&mut self, p: Path) {
        self.paths.push(p);
    }
    pub fn crease(&mut self, a: Pt, b: Pt) {
        if a.dist(b) > 1e-6 {
            self.paths.push(Path::line(LineKind::Crease, a, b));
        }
    }
    pub fn warn(&mut self, msg: impl Into<String>) {
        self.warnings.push(msg.into());
    }
    pub fn root(&mut self, name: &str, outline: Vec<Pt>) -> usize {
        self.panels.push(Panel {
            name: name.into(),
            outline,
            parent: None,
            hinge: None,
            angle: 0.0,
            stage: 0,
            label: true,
            assembly: Vec::new(),
        });
        self.panels.len() - 1
    }
    #[allow(clippy::too_many_arguments)]
    pub fn fold(
        &mut self,
        name: &str,
        outline: Vec<Pt>,
        parent: usize,
        a: Pt,
        b: Pt,
        angle: f64,
        stage: u32,
    ) -> usize {
        self.panels.push(Panel {
            name: name.into(),
            outline,
            parent: Some(parent),
            hinge: Some([a, b]),
            angle,
            stage,
            label: true,
            assembly: Vec::new(),
        });
        self.panels.len() - 1
    }
    /// Say how the root panel `part` (a separate piece) moves into place; it runs at `stage`.
    pub fn assemble(&mut self, part: usize, steps: Vec<AsmStep>, stage: u32) {
        let p = &mut self.panels[part];
        p.assembly = steps;
        p.stage = stage;
    }

    /// Append another dieline, moved by (`dx`, `dy`), as a separate part of this one.
    /// Panel parents are re-indexed; returns the index its first panel now has.
    pub fn absorb(&mut self, other: Dieline, dx: f64, dy: f64) -> usize {
        let base = self.panels.len();
        let off = pt(dx, dy);
        self.paths
            .extend(other.paths.iter().map(|p| p.map(|q| q + off)));
        for mut panel in other.panels {
            for q in &mut panel.outline {
                *q = *q + off;
            }
            if let Some(h) = &mut panel.hinge {
                h[0] = h[0] + off;
                h[1] = h[1] + off;
            }
            panel.parent = panel.parent.map(|i| i + base);
            panel.assembly = panel
                .assembly
                .into_iter()
                .map(|a| a.shifted(dx, dy))
                .collect();
            self.panels.push(panel);
        }
        for mut g in other.glue {
            for q in &mut g {
                *q = *q + off;
            }
            self.glue.push(g);
        }
        self.warnings.extend(other.warnings);
        base
    }

    /// Hide the label of the most recently added panel.
    pub fn quiet(&mut self) {
        if let Some(p) = self.panels.last_mut() {
            p.label = false;
        }
    }

    pub fn bbox(&self) -> BBox {
        let mut b = BBox::empty();
        for p in &self.paths {
            b.union(&p.bbox());
        }
        b
    }

    /// Translate everything so the artwork's bounding box starts at the origin.
    pub fn normalize(&mut self) {
        let b = self.bbox();
        if b.is_empty() {
            return;
        }
        let off = pt(-b.min.x, -b.min.y);
        let f = |p: Pt| p + off;
        self.paths = self.paths.iter().map(|p| p.map(f)).collect();
        for panel in &mut self.panels {
            for q in &mut panel.outline {
                *q = f(*q);
            }
            if let Some(h) = &mut panel.hinge {
                h[0] = f(h[0]);
                h[1] = f(h[1]);
            }
            panel.assembly = panel
                .assembly
                .iter()
                .map(|a| a.shifted(off.x, off.y))
                .collect();
        }
        for g in &mut self.glue {
            for q in g.iter_mut() {
                *q = f(*q);
            }
        }
    }

    pub fn length_of(&self, kind: LineKind) -> f64 {
        self.paths
            .iter()
            .filter(|p| p.kind == kind)
            .map(|p| p.length())
            .sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::geom::rect;

    fn one_box() -> Dieline {
        let mut d = Dieline::new();
        let a = d.root("A", rect(0.0, 0.0, 10.0, 10.0));
        d.fold(
            "B",
            rect(10.0, 0.0, 20.0, 10.0),
            a,
            pt(10.0, 0.0),
            pt(10.0, 10.0),
            90.0,
            0,
        );
        d.add(Path::polyline(
            LineKind::Cut,
            &rect(0.0, 0.0, 20.0, 10.0),
            true,
        ));
        d
    }

    #[test]
    fn absorb_moves_and_reindexes() {
        let mut d = one_box();
        let first = d.absorb(one_box(), 100.0, 5.0);
        assert_eq!(first, 2);
        assert_eq!(d.panels.len(), 4);
        assert_eq!(d.panels[3].parent, Some(2));
        assert!(d.panels[2].outline[0].near(pt(100.0, 5.0), 1e-9));
        let h = d.panels[3].hinge.unwrap();
        assert!(h[0].near(pt(110.0, 5.0), 1e-9));
        assert_eq!(d.paths.len(), 2);
        assert!((d.bbox().width() - 120.0).abs() < 1e-9);
    }

    #[test]
    fn assembly_follows_its_part() {
        let mut part = one_box();
        part.assemble(
            0,
            vec![AsmStep::rot(pt(0.0, 0.0), [1.0, 0.0, 0.0], 90.0)],
            1,
        );
        let mut d = one_box();
        let at = d.absorb(part, 50.0, 0.0);
        match d.panels[at].assembly[0] {
            AsmStep::Rot { pivot, .. } => assert_eq!(pivot, [50.0, 0.0, 0.0]),
            _ => panic!("expected a rotation"),
        }
        assert_eq!(d.panels[at].stage, 1);
        let json = serde_json::to_string(&d.panels[at]).unwrap();
        assert!(json.contains("\"assembly\"") && json.contains("\"t\":\"rot\""));
        assert!(!serde_json::to_string(&d.panels[0])
            .unwrap()
            .contains("assembly"));
    }
}
