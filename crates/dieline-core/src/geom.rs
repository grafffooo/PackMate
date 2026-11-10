//! 2D geometry primitives. All units are millimetres, y axis points down (SVG convention).

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use std::ops::{Add, Mul, Neg, Sub};

#[derive(Clone, Copy, Debug, PartialEq, Default, Serialize, Deserialize)]
pub struct Pt {
    pub x: f64,
    pub y: f64,
}

pub const fn pt(x: f64, y: f64) -> Pt {
    Pt { x, y }
}

impl Add for Pt {
    type Output = Pt;
    fn add(self, o: Pt) -> Pt {
        pt(self.x + o.x, self.y + o.y)
    }
}
impl Sub for Pt {
    type Output = Pt;
    fn sub(self, o: Pt) -> Pt {
        pt(self.x - o.x, self.y - o.y)
    }
}
impl Mul<f64> for Pt {
    type Output = Pt;
    fn mul(self, k: f64) -> Pt {
        pt(self.x * k, self.y * k)
    }
}
impl Neg for Pt {
    type Output = Pt;
    fn neg(self) -> Pt {
        pt(-self.x, -self.y)
    }
}

impl Pt {
    pub fn len(self) -> f64 {
        self.x.hypot(self.y)
    }
    pub fn norm(self) -> Pt {
        let l = self.len();
        if l < 1e-12 {
            self
        } else {
            self * (1.0 / l)
        }
    }
    pub fn dot(self, o: Pt) -> f64 {
        self.x * o.x + self.y * o.y
    }
    pub fn cross(self, o: Pt) -> f64 {
        self.x * o.y - self.y * o.x
    }
    pub fn dist(self, o: Pt) -> f64 {
        (self - o).len()
    }
    pub fn lerp(self, o: Pt, t: f64) -> Pt {
        self + (o - self) * t
    }
    pub fn angle(self) -> f64 {
        self.y.atan2(self.x)
    }
    pub fn polar(a: f64) -> Pt {
        pt(a.cos(), a.sin())
    }
    pub fn near(self, o: Pt, eps: f64) -> bool {
        self.dist(o) <= eps
    }
}

/// What a line does on the cutting machine.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LineKind {
    /// Through-cut.
    Cut,
    /// Fold / score line.
    Crease,
    /// Dashed through-cut (tear line, or a crease converted for machines without a scoring tool).
    Perforation,
}

impl LineKind {
    pub fn id(self) -> &'static str {
        match self {
            LineKind::Cut => "cut",
            LineKind::Crease => "crease",
            LineKind::Perforation => "perforation",
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            LineKind::Cut => "Cut",
            LineKind::Crease => "Crease / Score",
            LineKind::Perforation => "Perforation",
        }
    }
    pub const ALL: [LineKind; 3] = [LineKind::Crease, LineKind::Perforation, LineKind::Cut];
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Seg {
    Line(Pt),
    Cubic(Pt, Pt, Pt),
}

impl Seg {
    pub fn end(&self) -> Pt {
        match *self {
            Seg::Line(p) => p,
            Seg::Cubic(_, _, p) => p,
        }
    }
    fn map(&self, f: &impl Fn(Pt) -> Pt) -> Seg {
        match *self {
            Seg::Line(p) => Seg::Line(f(p)),
            Seg::Cubic(a, b, c) => Seg::Cubic(f(a), f(b), f(c)),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct BBox {
    pub min: Pt,
    pub max: Pt,
}

impl BBox {
    pub fn empty() -> BBox {
        BBox {
            min: pt(f64::INFINITY, f64::INFINITY),
            max: pt(f64::NEG_INFINITY, f64::NEG_INFINITY),
        }
    }
    pub fn is_empty(&self) -> bool {
        self.min.x > self.max.x
    }
    pub fn add(&mut self, p: Pt) {
        self.min.x = self.min.x.min(p.x);
        self.min.y = self.min.y.min(p.y);
        self.max.x = self.max.x.max(p.x);
        self.max.y = self.max.y.max(p.y);
    }
    pub fn union(&mut self, o: &BBox) {
        if !o.is_empty() {
            self.add(o.min);
            self.add(o.max);
        }
    }
    pub fn width(&self) -> f64 {
        if self.is_empty() {
            0.0
        } else {
            self.max.x - self.min.x
        }
    }
    pub fn height(&self) -> f64 {
        if self.is_empty() {
            0.0
        } else {
            self.max.y - self.min.y
        }
    }
    pub fn area(&self) -> f64 {
        self.width() * self.height()
    }
    pub fn contains_box(&self, o: &BBox, eps: f64) -> bool {
        o.min.x >= self.min.x - eps
            && o.min.y >= self.min.y - eps
            && o.max.x <= self.max.x + eps
            && o.max.y <= self.max.y + eps
    }
}

/// A single stroke: polyline/bezier path tagged with what the machine should do with it.
#[derive(Clone, Debug, PartialEq)]
pub struct Path {
    pub kind: LineKind,
    pub start: Pt,
    pub segs: Vec<Seg>,
    pub closed: bool,
}

impl Path {
    pub fn new(kind: LineKind, start: Pt) -> Path {
        Path {
            kind,
            start,
            segs: Vec::new(),
            closed: false,
        }
    }
    pub fn line(kind: LineKind, a: Pt, b: Pt) -> Path {
        Path {
            kind,
            start: a,
            segs: vec![Seg::Line(b)],
            closed: false,
        }
    }
    pub fn polyline(kind: LineKind, pts: &[Pt], closed: bool) -> Path {
        let mut p = Path::new(kind, pts[0]);
        for &q in &pts[1..] {
            p.segs.push(Seg::Line(q));
        }
        p.closed = closed;
        p
    }
    pub fn circle(kind: LineKind, c: Pt, r: f64) -> Path {
        let start = c + pt(r, 0.0);
        let mut p = Path::new(kind, start);
        p.segs = arc_segs(c, r, 0.0, 2.0 * PI);
        // snap the end exactly onto the start
        if let Some(Seg::Cubic(_, _, e)) = p.segs.last_mut() {
            *e = start;
        }
        p.closed = true;
        p
    }
    pub fn end(&self) -> Pt {
        self.segs.last().map(|s| s.end()).unwrap_or(self.start)
    }
    pub fn map(&self, f: impl Fn(Pt) -> Pt) -> Path {
        Path {
            kind: self.kind,
            start: f(self.start),
            segs: self.segs.iter().map(|s| s.map(&f)).collect(),
            closed: self.closed,
        }
    }
    pub fn with_kind(mut self, kind: LineKind) -> Path {
        self.kind = kind;
        self
    }

    /// Approximate the path by a polyline. The returned list starts at `start` and, for a closed
    /// path, ends with a copy of the start point.
    pub fn flatten(&self, tol: f64) -> Vec<Pt> {
        let mut out = vec![self.start];
        let mut cur = self.start;
        for s in &self.segs {
            match *s {
                Seg::Line(p) => out.push(p),
                Seg::Cubic(c1, c2, p) => {
                    let ctrl = cur.dist(c1) + c1.dist(c2) + c2.dist(p);
                    let n = ((ctrl / tol.max(1e-4)).sqrt().ceil() as usize).clamp(2, 256);
                    for i in 1..=n {
                        out.push(cubic_at(cur, c1, c2, p, i as f64 / n as f64));
                    }
                }
            }
            cur = s.end();
        }
        if self.closed && !cur.near(self.start, 1e-9) {
            out.push(self.start);
        }
        out
    }

    pub fn bbox(&self) -> BBox {
        let mut b = BBox::empty();
        for p in self.flatten(0.1) {
            b.add(p);
        }
        b
    }

    pub fn length(&self) -> f64 {
        self.flatten(0.02).windows(2).map(|w| w[0].dist(w[1])).sum()
    }

    /// SVG path data (absolute coordinates).
    pub fn svg_d(&self) -> String {
        let mut d = format!("M{} {}", fmt(self.start.x), fmt(self.start.y));
        for s in &self.segs {
            match *s {
                Seg::Line(p) => d.push_str(&format!("L{} {}", fmt(p.x), fmt(p.y))),
                Seg::Cubic(a, b, p) => d.push_str(&format!(
                    "C{} {} {} {} {} {}",
                    fmt(a.x),
                    fmt(a.y),
                    fmt(b.x),
                    fmt(b.y),
                    fmt(p.x),
                    fmt(p.y)
                )),
            }
        }
        if self.closed {
            d.push('Z');
        }
        d
    }
}

pub fn cubic_at(p0: Pt, c1: Pt, c2: Pt, p1: Pt, t: f64) -> Pt {
    let u = 1.0 - t;
    p0 * (u * u * u) + c1 * (3.0 * u * u * t) + c2 * (3.0 * u * t * t) + p1 * (t * t * t)
}

/// Format a coordinate with at most 3 decimals and no trailing zeros.
pub fn fmt(v: f64) -> String {
    let mut s = format!("{:.3}", v);
    if s.contains('.') {
        while s.ends_with('0') {
            s.pop();
        }
        if s.ends_with('.') {
            s.pop();
        }
    }
    if s == "-0" {
        s = "0".into();
    }
    s
}

/// Normalise an angle to (-PI, PI].
pub fn norm_angle(a: f64) -> f64 {
    let mut a = a % (2.0 * PI);
    if a <= -PI {
        a += 2.0 * PI;
    } else if a > PI {
        a -= 2.0 * PI;
    }
    a
}

/// Cubic bezier approximation of a circular arc around `c` starting at angle `a0` and sweeping
/// `sweep` radians (signed). Split into pieces of at most 90 degrees.
pub fn arc_segs(c: Pt, r: f64, a0: f64, sweep: f64) -> Vec<Seg> {
    let n = ((sweep.abs() / (PI / 2.0)).ceil() as usize).max(1);
    let step = sweep / n as f64;
    let k = 4.0 / 3.0 * (step / 4.0).tan();
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let a = a0 + step * i as f64;
        let b = a + step;
        let p0 = c + Pt::polar(a) * r;
        let p1 = c + Pt::polar(b) * r;
        let c1 = p0 + pt(-a.sin(), a.cos()) * (k * r);
        let c2 = p1 - pt(-b.sin(), b.cos()) * (k * r);
        out.push(Seg::Cubic(c1, c2, p1));
    }
    out
}

/// Circular arc from `p0` to `p1` whose midpoint is displaced by the signed sagitta `s` from the
/// chord. Positive `s` bulges to the left of the travel direction in screen space, i.e. towards
/// `(dy, -dx)` (for a clockwise contour this is outwards).
pub fn arc_sagitta(p0: Pt, p1: Pt, s: f64) -> Vec<Seg> {
    let d = p1 - p0;
    let c = d.len();
    if s.abs() < 1e-9 || c < 1e-9 {
        return vec![Seg::Line(p1)];
    }
    let n = pt(d.y, -d.x) * (1.0 / c);
    let r = (c * c / 4.0 + s * s) / (2.0 * s.abs());
    let apex = p0.lerp(p1, 0.5) + n * s;
    let center = apex - n * (s.signum() * r);
    let a0 = (p0 - center).angle();
    let a1 = (p1 - center).angle();
    let am = (apex - center).angle();
    let mut sweep = norm_angle(a1 - a0);
    let half = norm_angle(am - a0);
    if sweep.signum() != half.signum() || half.abs() > sweep.abs() {
        sweep -= sweep.signum() * 2.0 * PI;
    }
    let mut segs = arc_segs(center, r, a0, sweep);
    if let Some(Seg::Cubic(_, _, e)) = segs.last_mut() {
        *e = p1;
    }
    segs
}

#[derive(Clone, Copy, Debug)]
enum CItem {
    P { p: Pt, r: f64 },
    Arc { p: Pt, sag: f64 },
}

impl CItem {
    fn p(&self) -> Pt {
        match *self {
            CItem::P { p, .. } | CItem::Arc { p, .. } => p,
        }
    }
}

/// Turtle-style outline builder with optional corner fillets and sagitta arcs.
#[derive(Clone, Debug)]
pub struct Contour {
    items: Vec<CItem>,
}

impl Contour {
    pub fn new(start: Pt) -> Contour {
        Contour {
            items: vec![CItem::P { p: start, r: 0.0 }],
        }
    }
    pub fn last(&self) -> Pt {
        self.items.last().unwrap().p()
    }
    /// Straight line to `p`.
    pub fn to(&mut self, p: Pt) -> &mut Self {
        self.to_r(p, 0.0)
    }
    /// Straight line to `p`; the corner at `p` is rounded with radius `r` (if both neighbours are lines).
    pub fn to_r(&mut self, p: Pt, r: f64) -> &mut Self {
        if self.last().near(p, 1e-9) {
            if let Some(CItem::P { r: lr, .. }) = self.items.last_mut() {
                *lr = lr.max(r);
            }
            return self;
        }
        self.items.push(CItem::P { p, r: r.max(0.0) });
        self
    }
    /// Circular arc to `p` with signed sagitta (see [`arc_sagitta`]).
    pub fn arc(&mut self, p: Pt, sag: f64) -> &mut Self {
        if self.last().near(p, 1e-9) {
            return self;
        }
        self.items.push(CItem::Arc { p, sag });
        self
    }

    fn build(mut self, kind: LineKind, closed: bool) -> Path {
        if closed && self.items.len() > 1 && self.last().near(self.items[0].p(), 1e-9) {
            // explicit return to start: merge
            let last = self.items.pop().unwrap();
            if let CItem::Arc { .. } = last {
                // keep arc closing: re-add and treat as open-closed path
                self.items.push(last);
                return self.build_plain(kind, true);
            }
        }
        self.build_plain(kind, closed)
    }

    fn build_plain(&self, kind: LineKind, closed: bool) -> Path {
        let n = self.items.len();
        let pts: Vec<Pt> = self.items.iter().map(|i| i.p()).collect();
        // segment i goes from vertex i-1 to vertex i; it is a line unless item i is an arc.
        // For a closed contour the closing segment (n-1 -> 0) is a line.
        let is_line_into = |i: usize| -> bool {
            if i == 0 {
                closed
            } else {
                matches!(self.items[i], CItem::P { .. })
            }
        };
        let is_line_out = |i: usize| -> bool {
            if i + 1 < n {
                matches!(self.items[i + 1], CItem::P { .. })
            } else {
                closed
            }
        };
        // fillet geometry per vertex: (in_point, out_point, arc)
        let mut fil: Vec<Option<(Pt, Pt, Vec<Seg>)>> = vec![None; n];
        for i in 0..n {
            let r = match self.items[i] {
                CItem::P { r, .. } => r,
                _ => 0.0,
            };
            if r <= 0.0 || !is_line_into(i) || !is_line_out(i) {
                continue;
            }
            if !closed && (i == 0 || i == n - 1) {
                continue;
            }
            let p = pts[i];
            let a = pts[(i + n - 1) % n];
            let b = pts[(i + 1) % n];
            if let Some(f) = fillet(a, p, b, r) {
                fil[i] = Some(f);
            }
        }
        let out_pt = |i: usize| fil[i].as_ref().map(|f| f.1).unwrap_or(pts[i]);
        let mut path = Path::new(kind, out_pt(0));
        for i in 1..n {
            match self.items[i] {
                CItem::P { p, .. } => {
                    let inp = fil[i].as_ref().map(|f| f.0).unwrap_or(p);
                    path.segs.push(Seg::Line(inp));
                    if let Some(f) = &fil[i] {
                        path.segs.extend(f.2.iter().copied());
                    }
                }
                CItem::Arc { p, sag } => {
                    let from = pts[i - 1];
                    path.segs.extend(arc_sagitta(from, p, sag));
                }
            }
        }
        if closed {
            if let Some(f) = &fil[0] {
                path.segs.push(Seg::Line(f.0));
                path.segs.extend(f.2.iter().copied());
            } else if !path.end().near(path.start, 1e-9) {
                path.segs.push(Seg::Line(path.start));
            }
            // Drop a redundant final segment landing on the start (Z closes it).
            if let Some(Seg::Line(p)) = path.segs.last() {
                if p.near(path.start, 1e-9) {
                    path.segs.pop();
                }
            }
            path.closed = true;
        }
        path
    }

    pub fn close(self, kind: LineKind) -> Path {
        self.build(kind, true)
    }
    pub fn open(self, kind: LineKind) -> Path {
        self.build(kind, false)
    }
}

/// Round the corner `a-p-b` with radius `r`. Returns (tangent point on pa, tangent point on pb, arc).
fn fillet(a: Pt, p: Pt, b: Pt, r: f64) -> Option<(Pt, Pt, Vec<Seg>)> {
    let u1 = (a - p).norm();
    let u2 = (b - p).norm();
    let theta = u1.dot(u2).clamp(-1.0, 1.0).acos();
    if theta < 1e-3 || PI - theta < 1e-3 {
        return None;
    }
    let half = theta / 2.0;
    let mut t = r / half.tan();
    let maxt = (a.dist(p) / 2.0).min(b.dist(p) / 2.0);
    if t > maxt {
        t = maxt;
    }
    let r = t * half.tan();
    if r < 1e-6 {
        return None;
    }
    let t1 = p + u1 * t;
    let t2 = p + u2 * t;
    let c = p + (u1 + u2).norm() * (r / half.sin());
    let a0 = (t1 - c).angle();
    let a1 = (t2 - c).angle();
    let sweep = norm_angle(a1 - a0);
    let mut segs = arc_segs(c, r, a0, sweep);
    if let Some(Seg::Cubic(_, _, e)) = segs.last_mut() {
        *e = t2;
    }
    Some((t1, t2, segs))
}

/// Local frame along an edge travelled from `a` to `b`: `s` runs along the edge, `v` outward
/// (to the left of travel in screen space — outward for a clockwise contour).
#[derive(Clone, Copy, Debug)]
pub struct Edge {
    pub a: Pt,
    pub u: Pt,
    pub n: Pt,
    pub len: f64,
}

impl Edge {
    pub fn new(a: Pt, b: Pt) -> Edge {
        let d = b - a;
        let len = d.len();
        let u = d.norm();
        Edge {
            a,
            u,
            n: pt(u.y, -u.x),
            len,
        }
    }
    pub fn at(&self, s: f64, v: f64) -> Pt {
        self.a + self.u * s + self.n * v
    }
    pub fn end(&self) -> Pt {
        self.at(self.len, 0.0)
    }
}

/// One point of a flap profile in an [`Edge`] frame.
#[derive(Clone, Copy, Debug)]
pub enum Prof {
    /// Corner at (s, v) rounded with radius r.
    P(f64, f64, f64),
    /// Arc to (s, v) with sagitta.
    A(f64, f64, f64),
}

/// Append a flap profile to a contour (points are in the edge's local frame).
pub fn push_profile(c: &mut Contour, e: &Edge, prof: &[Prof]) {
    for p in prof {
        match *p {
            Prof::P(s, v, r) => {
                c.to_r(e.at(s, v), r);
            }
            Prof::A(s, v, sag) => {
                c.arc(e.at(s, v), sag);
            }
        }
    }
}

pub fn rect(x0: f64, y0: f64, x1: f64, y1: f64) -> Vec<Pt> {
    let (ax, bx) = (x0.min(x1), x0.max(x1));
    let (ay, by) = (y0.min(y1), y0.max(y1));
    vec![pt(ax, ay), pt(bx, ay), pt(bx, by), pt(ax, by)]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sagitta_arc_midpoint() {
        let segs = arc_sagitta(pt(0.0, 0.0), pt(10.0, 0.0), 3.0);
        let mut p = Path::new(LineKind::Cut, pt(0.0, 0.0));
        p.segs = segs;
        let pts = p.flatten(0.01);
        let top = pts.iter().map(|q| q.y).fold(f64::INFINITY, f64::min);
        assert!((top + 3.0).abs() < 0.02, "apex {top}");
        assert!(p.end().near(pt(10.0, 0.0), 1e-9));
    }

    #[test]
    fn large_sagitta_goes_long_way() {
        let mut p = Path::new(LineKind::Cut, pt(0.0, 0.0));
        p.segs = arc_sagitta(pt(0.0, 0.0), pt(10.0, 0.0), 8.0);
        let b = p.bbox();
        assert!((b.min.y + 8.0).abs() < 0.05);
        assert!(b.width() > 10.0);
    }

    #[test]
    fn fillet_rect_keeps_bbox() {
        let mut c = Contour::new(pt(0.0, 0.0));
        c.to_r(pt(10.0, 0.0), 2.0)
            .to_r(pt(10.0, 10.0), 2.0)
            .to(pt(0.0, 10.0));
        let p = c.close(LineKind::Cut);
        let b = p.bbox();
        assert!((b.width() - 10.0).abs() < 1e-6 && (b.height() - 10.0).abs() < 1e-6);
        assert!(p.closed);
        // perimeter is shortened by the two fillets: 2*(2r - pi r/2)
        let expect = 40.0 - 2.0 * (4.0 - PI);
        assert!((p.length() - expect).abs() < 0.01, "{}", p.length());
    }

    #[test]
    fn circle_length() {
        let c = Path::circle(LineKind::Cut, pt(0.0, 0.0), 5.0);
        assert!((c.length() - 2.0 * PI * 5.0).abs() < 0.01);
    }

    #[test]
    fn fmt_trims() {
        assert_eq!(fmt(1.5), "1.5");
        assert_eq!(fmt(2.0), "2");
        assert_eq!(fmt(-0.0001), "0");
    }
}
