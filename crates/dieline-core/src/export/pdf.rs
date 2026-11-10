//! Minimal vector PDF writer with optional-content layers (Cut / Crease / Perforation),
//! the format most print shops and Illustrator-based workflows expect.

use super::layout::Page;
use super::{color, LineKind};
use crate::geom::{fmt, Seg};

const PT: f64 = 72.0 / 25.4;

pub fn write(pages: &[Page], title: &str) -> Vec<u8> {
    let kinds = LineKind::ALL;
    // object numbering: 1 catalog, 2 pages, 3 info, 4.. OCGs, then (page, content) pairs
    let ocg0 = 4;
    let first_page = ocg0 + kinds.len();
    let mut objs: Vec<String> = Vec::new();
    let ocg_refs: Vec<String> = (0..kinds.len())
        .map(|i| format!("{} 0 R", ocg0 + i))
        .collect();
    let page_ids: Vec<usize> = (0..pages.len()).map(|i| first_page + 2 * i).collect();

    objs.push(format!(
        "<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [{all}] /D << /Order [{all}] /ON [{all}] >> >> >>",
        all = ocg_refs.join(" ")
    ));
    objs.push(format!(
        "<< /Type /Pages /Kids [{}] /Count {} >>",
        page_ids
            .iter()
            .map(|i| format!("{i} 0 R"))
            .collect::<Vec<_>>()
            .join(" "),
        pages.len()
    ));
    objs.push(format!(
        "<< /Title ({}) /Creator (PackMate) >>",
        pdf_str(title)
    ));
    for k in kinds {
        objs.push(format!("<< /Type /OCG /Name ({}) >>", k.label()));
    }
    let props: String = kinds
        .iter()
        .enumerate()
        .map(|(i, k)| format!("/{} {} 0 R", k.id(), ocg0 + i))
        .collect::<Vec<_>>()
        .join(" ");

    for (pi, page) in pages.iter().enumerate() {
        let (w, h) = (page.w * PT, page.h * PT);
        let mut c = String::new();
        for k in kinds {
            let paths: Vec<_> = page.paths.iter().filter(|p| p.kind == k).collect();
            if paths.is_empty() {
                continue;
            }
            let (r, g, b) = color(k);
            c.push_str(&format!(
                "/OC /{} BDC q {} {} {} RG 0.5 w 1 J 1 j {} d\n",
                k.id(),
                fmt(r as f64 / 255.0),
                fmt(g as f64 / 255.0),
                fmt(b as f64 / 255.0),
                if k == LineKind::Crease {
                    "[6 3] 0"
                } else {
                    "[] 0"
                }
            ));
            let tx = |x: f64| fmt(x * PT);
            let ty = |y: f64| fmt(h - y * PT);
            for p in paths {
                c.push_str(&format!("{} {} m\n", tx(p.start.x), ty(p.start.y)));
                for s in &p.segs {
                    match *s {
                        Seg::Line(q) => c.push_str(&format!("{} {} l\n", tx(q.x), ty(q.y))),
                        Seg::Cubic(a, b2, q) => c.push_str(&format!(
                            "{} {} {} {} {} {} c\n",
                            tx(a.x),
                            ty(a.y),
                            tx(b2.x),
                            ty(b2.y),
                            tx(q.x),
                            ty(q.y)
                        )),
                    }
                }
                c.push_str(if p.closed { "s\n" } else { "S\n" });
            }
            c.push_str("Q EMC\n");
        }
        let _ = pi;
        objs.push(format!(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {} {}] /Resources << /Properties << {} >> >> /Contents {} 0 R >>",
            fmt(w),
            fmt(h),
            props,
            page_ids[pi] + 1
        ));
        objs.push(format!("<< /Length {} >>\nstream\n{}endstream", c.len(), c));
    }

    let mut out: Vec<u8> = b"%PDF-1.5\n%\xE2\xE3\xCF\xD3\n".to_vec();
    let mut offsets = Vec::with_capacity(objs.len());
    for (i, o) in objs.iter().enumerate() {
        offsets.push(out.len());
        out.extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", i + 1, o).as_bytes());
    }
    let xref = out.len();
    out.extend_from_slice(format!("xref\n0 {}\n0000000000 65535 f \n", objs.len() + 1).as_bytes());
    for off in offsets {
        out.extend_from_slice(format!("{off:010} 00000 n \n").as_bytes());
    }
    out.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R /Info 3 0 R >>\nstartxref\n{}\n%%EOF\n",
            objs.len() + 1,
            xref
        )
        .as_bytes(),
    );
    out
}

fn pdf_str(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_ascii() && !c.is_ascii_control())
        .map(|c| match c {
            '(' | ')' | '\\' => format!("\\{c}"),
            _ => c.to_string(),
        })
        .collect()
}
