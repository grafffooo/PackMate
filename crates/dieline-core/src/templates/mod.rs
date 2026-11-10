//! Parametric packaging templates.

mod bag;
mod envelope;
mod gable;
mod mailer;
mod pillow;
mod tuck;

use crate::dieline::Dieline;
use crate::geom::{push_profile, rect, Contour, Edge, Prof};
use crate::params::{ParamDef, Params};
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct TemplateInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub category: &'static str,
    pub description: &'static str,
    pub tags: &'static [&'static str],
}

pub trait Template: Sync {
    fn info(&self) -> TemplateInfo;
    fn params(&self) -> Vec<ParamDef>;
    /// Build the dieline. Coordinates may be anywhere; the caller normalises them.
    fn build(&self, p: &Params) -> Dieline;
}

pub const CAT_BOX: &str = "Boxes";
pub const CAT_MAILER: &str = "Mailers & Trays";
pub const CAT_ENV: &str = "Envelopes";
pub const CAT_BAG: &str = "Bags";
pub const CAT_SPECIAL: &str = "Gift & Specialty";

static ALL: &[&dyn Template] = &[
    &tuck::TuckEnd { reverse: true },
    &tuck::TuckEnd { reverse: false },
    &mailer::Mailer { lid: true },
    &mailer::Mailer { lid: false },
    &pillow::Pillow,
    &gable::Gable,
    &envelope::Envelope,
    &bag::Bag,
];

pub fn all() -> &'static [&'static dyn Template] {
    ALL
}

pub fn find(id: &str) -> Option<&'static dyn Template> {
    ALL.iter().copied().find(|t| t.info().id == id)
}

/// Generate a normalised dieline for a template from raw JSON parameters.
pub fn generate(t: &dyn Template, input: &serde_json::Value) -> (Params, Dieline) {
    let p = Params::resolve(&t.params(), input);
    let mut d = t.build(&p);
    d.normalize();
    (p, d)
}

// ---------------------------------------------------------------------------------------------
// Shared flap builders. All take an edge travelled clockwise; the flap grows outward from it and
// the contour ends at the edge's end point.

/// Closing lid of depth `lid` with a rounded tuck flap of depth `tuck`, inset by `inset` per side.
pub(crate) fn lid_with_tuck(
    c: &mut Contour,
    d: &mut Dieline,
    e: Edge,
    lid: f64,
    tuck: f64,
    inset: f64,
) {
    let l = e.len;
    let r = (tuck * 0.45).min(8.0);
    push_profile(
        c,
        &e,
        &[
            Prof::P(0.0, lid, 0.0),
            Prof::P(inset, lid, 0.0),
            Prof::P(inset, lid + tuck, r),
            Prof::P(l - inset, lid + tuck, r),
            Prof::P(l - inset, lid, 0.0),
            Prof::P(l, lid, 0.0),
            Prof::P(l, 0.0, 0.0),
        ],
    );
    d.crease(e.at(0.0, 0.0), e.at(l, 0.0));
    d.crease(e.at(inset, lid), e.at(l - inset, lid));
}

/// Fold model for [`lid_with_tuck`]; returns the lid panel index.
#[allow(clippy::too_many_arguments)]
pub(crate) fn lid_panels(
    d: &mut Dieline,
    parent: usize,
    e: Edge,
    lid: f64,
    tuck: f64,
    inset: f64,
    stage: u32,
    name: &str,
) -> usize {
    let l = e.len;
    let lid_i = d.fold(
        name,
        vec![e.at(0.0, 0.0), e.at(l, 0.0), e.at(l, lid), e.at(0.0, lid)],
        parent,
        e.at(0.0, 0.0),
        e.at(l, 0.0),
        90.0,
        stage,
    );
    d.fold(
        "Tuck flap",
        vec![
            e.at(inset, lid),
            e.at(l - inset, lid),
            e.at(l - inset, lid + tuck),
            e.at(inset, lid + tuck),
        ],
        lid_i,
        e.at(inset, lid),
        e.at(l - inset, lid),
        90.0,
        stage,
    );
    d.quiet();
    lid_i
}

/// Tapered dust flap of depth `h`.
pub(crate) fn dust_flap(
    c: &mut Contour,
    d: &mut Dieline,
    e: Edge,
    h: f64,
    parent: usize,
    stage: u32,
) {
    let l = e.len;
    let ins = (h * 0.3).min(l * 0.2);
    let r = (h * 0.25).min(4.0);
    push_profile(
        c,
        &e,
        &[
            Prof::P(ins, h, r),
            Prof::P(l - ins, h, r),
            Prof::P(l, 0.0, 0.0),
        ],
    );
    d.crease(e.at(0.0, 0.0), e.at(l, 0.0));
    d.fold(
        "Dust flap",
        vec![e.at(0.0, 0.0), e.at(ins, h), e.at(l - ins, h), e.at(l, 0.0)],
        parent,
        e.at(0.0, 0.0),
        e.at(l, 0.0),
        90.0,
        stage,
    );
    d.quiet();
}

/// Tapered glue flap of width `g`.
pub(crate) fn glue_flap(c: &mut Contour, d: &mut Dieline, e: Edge, g: f64, parent: usize) {
    let l = e.len;
    let ch = g.min(l * 0.2);
    push_profile(
        c,
        &e,
        &[
            Prof::P(ch, g, 0.0),
            Prof::P(l - ch, g, 0.0),
            Prof::P(l, 0.0, 0.0),
        ],
    );
    d.crease(e.at(0.0, 0.0), e.at(l, 0.0));
    let outline = vec![e.at(0.0, 0.0), e.at(ch, g), e.at(l - ch, g), e.at(l, 0.0)];
    d.glue.push(outline.clone());
    d.fold(
        "Glue flap",
        outline,
        parent,
        e.at(0.0, 0.0),
        e.at(l, 0.0),
        90.0,
        0,
    );
    d.quiet();
}

/// Four-panel tube `[L | W | L | W]` from x = 0, height `h`; returns panel indices.
pub(crate) fn tube_panels(d: &mut Dieline, l: f64, w: f64, h: f64, names: [&str; 4]) -> [usize; 4] {
    use crate::geom::pt;
    let xs = [0.0, l, l + w, 2.0 * l + w, 2.0 * l + 2.0 * w];
    let p0 = d.root(names[0], rect(xs[0], 0.0, xs[1], h));
    let p1 = d.fold(
        names[1],
        rect(xs[1], 0.0, xs[2], h),
        p0,
        pt(xs[1], 0.0),
        pt(xs[1], h),
        90.0,
        0,
    );
    let p2 = d.fold(
        names[2],
        rect(xs[2], 0.0, xs[3], h),
        p1,
        pt(xs[2], 0.0),
        pt(xs[2], h),
        90.0,
        0,
    );
    let p3 = d.fold(
        names[3],
        rect(xs[3], 0.0, xs[4], h),
        p2,
        pt(xs[3], 0.0),
        pt(xs[3], h),
        90.0,
        0,
    );
    for x in &xs[1..4] {
        d.crease(pt(*x, 0.0), pt(*x, h));
    }
    [p0, p1, p2, p3]
}

#[cfg(test)]
pub(crate) mod testutil {
    use super::*;
    use crate::geom::{LineKind, Pt};

    /// Structural checks every template must pass.
    pub fn check(t: &dyn Template, input: serde_json::Value) -> Dieline {
        let (_p, d) = generate(t, &input);
        let id = t.info().id;
        let cuts: Vec<_> = d.paths.iter().filter(|p| p.kind == LineKind::Cut).collect();
        assert!(!cuts.is_empty(), "{id}: no cut lines");
        for c in &cuts {
            assert!(c.closed, "{id}: open cut path");
        }
        // exactly one outline encloses all other artwork
        let bb = d.bbox();
        let outer: Vec<_> = cuts
            .iter()
            .filter(|c| {
                let b = c.bbox();
                (b.width() - bb.width()).abs() < 1e-6 && (b.height() - bb.height()).abs() < 1e-6
            })
            .collect();
        assert_eq!(outer.len(), 1, "{id}: expected one outer outline");
        // outline must not self-intersect
        let poly = outer[0].flatten(0.05);
        assert!(!self_intersects(&poly), "{id}: outline self-intersects");
        // creases may touch, but never run along, cut lines
        let cut_lines: Vec<(Pt, Pt)> = cuts
            .iter()
            .flat_map(|c| {
                let f = c.flatten(0.05);
                f.windows(2).map(|w| (w[0], w[1])).collect::<Vec<_>>()
            })
            .collect();
        for cr in d.paths.iter().filter(|p| p.kind == LineKind::Crease) {
            let f = cr.flatten(0.05);
            for w in f.windows(2) {
                for &(a, b) in &cut_lines {
                    assert!(
                        overlap_len(w[0], w[1], a, b) < 0.05,
                        "{id}: crease {:?}-{:?} overlaps cut {:?}-{:?}",
                        w[0],
                        w[1],
                        a,
                        b
                    );
                }
            }
            // every crease lies inside the outline
            let mid = w_mid(&f);
            assert!(
                point_in_poly(mid, &poly),
                "{id}: crease outside outline at {mid:?}"
            );
        }
        // fold tree is consistent
        for (i, p) in d.panels.iter().enumerate() {
            if let Some(par) = p.parent {
                assert!(par < i, "{id}: panel parent must come first");
                assert!(p.hinge.is_some());
            }
        }
        d
    }

    fn w_mid(f: &[Pt]) -> Pt {
        let total: f64 = f.windows(2).map(|w| w[0].dist(w[1])).sum();
        let mut acc = 0.0;
        for w in f.windows(2) {
            let l = w[0].dist(w[1]);
            if acc + l >= total / 2.0 {
                return w[0].lerp(w[1], (total / 2.0 - acc) / l.max(1e-12));
            }
            acc += l;
        }
        f[0]
    }

    pub fn point_in_poly(p: Pt, poly: &[Pt]) -> bool {
        let mut inside = false;
        let n = poly.len();
        let mut j = n - 1;
        for i in 0..n {
            let (a, b) = (poly[i], poly[j]);
            if (a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x {
                inside = !inside;
            }
            j = i;
        }
        inside
    }

    /// Length of the collinear overlap of two segments.
    fn overlap_len(a: Pt, b: Pt, c: Pt, d: Pt) -> f64 {
        let u = b - a;
        let l = u.len();
        if l < 1e-9 {
            return 0.0;
        }
        let u = u * (1.0 / l);
        let dist = |p: Pt| (p - a).cross(u).abs();
        if dist(c) > 0.01 || dist(d) > 0.01 {
            return 0.0;
        }
        let (s0, s1) = ((c - a).dot(u), (d - a).dot(u));
        let (lo, hi) = (s0.min(s1).max(0.0), s0.max(s1).min(l));
        (hi - lo).max(0.0)
    }

    fn seg_cross(a: Pt, b: Pt, c: Pt, d: Pt) -> bool {
        let d1 = (b - a).cross(c - a);
        let d2 = (b - a).cross(d - a);
        let d3 = (d - c).cross(a - c);
        let d4 = (d - c).cross(b - c);
        d1 * d2 < -1e-9 && d3 * d4 < -1e-9
    }

    fn self_intersects(poly: &[Pt]) -> bool {
        let n = poly.len() - 1;
        for i in 0..n {
            for j in i + 2..n {
                if i == 0 && j == n - 1 {
                    continue;
                }
                if seg_cross(poly[i], poly[i + 1], poly[j], poly[j + 1]) {
                    return true;
                }
            }
        }
        false
    }

    pub fn approx(a: f64, b: f64) -> bool {
        (a - b).abs() < 0.01
    }
}
