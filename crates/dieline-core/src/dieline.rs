//! The generated artwork: strokes for the machine plus a fold model for the 3D preview.

use crate::geom::{pt, BBox, LineKind, Path, Pt};
use serde::Serialize;

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
}

#[derive(Clone, Debug, Default)]
pub struct Dieline {
    pub paths: Vec<Path>,
    pub panels: Vec<Panel>,
    /// Areas that receive glue (preview only).
    pub glue: Vec<Vec<Pt>>,
    pub warnings: Vec<String>,
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
        });
        self.panels.len() - 1
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
