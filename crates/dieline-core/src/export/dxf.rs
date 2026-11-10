//! DXF R12 (AC1009) writer — the lowest common denominator for cutting plotters, laser cutters
//! and CAD. Curves are flattened to polylines; one layer per line type.

use super::layout::Page;
use crate::geom::{fmt, LineKind};

pub fn write(page: &Page) -> String {
    let mut s = String::new();
    let mut g = |code: i32, v: &str| {
        s.push_str(&format!("{code}\n{v}\n"));
    };
    g(0, "SECTION");
    g(2, "HEADER");
    g(9, "$ACADVER");
    g(1, "AC1009");
    g(9, "$INSUNITS");
    g(70, "4"); // millimetres
    g(9, "$EXTMIN");
    g(10, "0");
    g(20, "0");
    g(9, "$EXTMAX");
    g(10, &fmt(page.w));
    g(20, &fmt(page.h));
    g(0, "ENDSEC");

    g(0, "SECTION");
    g(2, "TABLES");
    g(0, "TABLE");
    g(2, "LTYPE");
    g(70, "1");
    g(0, "LTYPE");
    g(2, "CONTINUOUS");
    g(70, "0");
    g(3, "Solid line");
    g(72, "65");
    g(73, "0");
    g(40, "0.0");
    g(0, "ENDTAB");
    g(0, "TABLE");
    g(2, "LAYER");
    g(70, &LineKind::ALL.len().to_string());
    for k in LineKind::ALL {
        g(0, "LAYER");
        g(2, &k.id().to_uppercase());
        g(70, "0");
        g(62, aci(k));
        g(6, "CONTINUOUS");
    }
    g(0, "ENDTAB");
    g(0, "ENDSEC");

    g(0, "SECTION");
    g(2, "ENTITIES");
    for p in &page.paths {
        let pts = p.flatten(0.05);
        let layer = p.kind.id().to_uppercase();
        let y = |v: f64| fmt(page.h - v);
        if pts.len() == 2 {
            g(0, "LINE");
            g(8, &layer);
            g(10, &fmt(pts[0].x));
            g(20, &y(pts[0].y));
            g(11, &fmt(pts[1].x));
            g(21, &y(pts[1].y));
            continue;
        }
        g(0, "POLYLINE");
        g(8, &layer);
        g(66, "1");
        g(10, "0");
        g(20, "0");
        g(70, if p.closed { "1" } else { "0" });
        let n = if p.closed { pts.len() - 1 } else { pts.len() };
        for q in &pts[..n] {
            g(0, "VERTEX");
            g(8, &layer);
            g(10, &fmt(q.x));
            g(20, &y(q.y));
        }
        g(0, "SEQEND");
        g(8, &layer);
    }
    g(0, "ENDSEC");
    g(0, "EOF");
    s
}

/// AutoCAD colour index: red cut, blue crease, magenta perforation.
fn aci(k: LineKind) -> &'static str {
    match k {
        LineKind::Cut => "1",
        LineKind::Crease => "5",
        LineKind::Perforation => "6",
    }
}
