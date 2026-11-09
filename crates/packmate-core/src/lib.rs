//! PackMate core: generates paper box dielines as SVG.
//!
//! All dimensions are in millimetres. This crate has no platform-specific
//! dependencies so it can be used from the web (WASM), Tauri desktop/mobile
//! apps and any other Rust host.

use std::fmt::Write;

/// Inner dimensions of a box, in millimetres.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BoxSpec {
    pub length: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SpecError {
    NonPositive(&'static str),
}

impl std::fmt::Display for SpecError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SpecError::NonPositive(field) => write!(f, "{field} must be a positive number"),
        }
    }
}

impl std::error::Error for SpecError {}

impl BoxSpec {
    pub fn validate(&self) -> Result<(), SpecError> {
        for (name, v) in [
            ("length", self.length),
            ("width", self.width),
            ("height", self.height),
        ] {
            if !(v.is_finite() && v > 0.0) {
                return Err(SpecError::NonPositive(name));
            }
        }
        Ok(())
    }
}

/// Generates the dieline of a simple open tray (base plus four walls) as SVG.
///
/// Cut lines are solid red, fold lines dashed blue. This is a starting point;
/// more box styles will be added as separate generators.
pub fn open_tray_svg(spec: &BoxSpec) -> Result<String, SpecError> {
    spec.validate()?;
    let BoxSpec {
        length: l,
        width: w,
        height: h,
    } = *spec;
    let (total_w, total_h) = (l + 2.0 * h, w + 2.0 * h);

    // Outline of the cross-shaped flat net, clockwise from top-left of the top wall.
    let outline = [
        (h, 0.0),
        (h + l, 0.0),
        (h + l, h),
        (total_w, h),
        (total_w, h + w),
        (h + l, h + w),
        (h + l, total_h),
        (h, total_h),
        (h, h + w),
        (0.0, h + w),
        (0.0, h),
        (h, h),
    ];
    let points = outline
        .iter()
        .map(|(x, y)| format!("{},{}", fmt(*x), fmt(*y)))
        .collect::<Vec<_>>()
        .join(" ");

    let mut svg = String::new();
    let _ = write!(
        svg,
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{tw}mm" height="{th}mm" viewBox="0 0 {tw} {th}">"#,
        tw = fmt(total_w),
        th = fmt(total_h)
    );
    let _ = write!(
        svg,
        r##"<polygon id="cut" points="{points}" fill="none" stroke="#e00" stroke-width="0.3"/>"##
    );
    let _ = write!(
        svg,
        r##"<rect id="fold" x="{h}" y="{h}" width="{l}" height="{w}" fill="none" stroke="#06c" stroke-width="0.3" stroke-dasharray="2 1"/>"##,
        h = fmt(h),
        l = fmt(l),
        w = fmt(w)
    );
    svg.push_str("</svg>");
    Ok(svg)
}

fn fmt(v: f64) -> String {
    let s = format!("{v:.3}");
    s.trim_end_matches('0').trim_end_matches('.').to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_has_expected_size() {
        let svg = open_tray_svg(&BoxSpec {
            length: 100.0,
            width: 50.0,
            height: 20.0,
        })
        .unwrap();
        assert!(svg.contains(r#"viewBox="0 0 140 90""#));
        assert!(svg.contains(r#"id="cut""#));
        assert!(svg.contains(r#"id="fold""#));
    }

    #[test]
    fn rejects_invalid_dimensions() {
        let err = open_tray_svg(&BoxSpec {
            length: 0.0,
            width: 50.0,
            height: 20.0,
        })
        .unwrap_err();
        assert_eq!(err, SpecError::NonPositive("length"));
        assert!(
            open_tray_svg(&BoxSpec {
                length: 1.0,
                width: f64::NAN,
                height: 1.0
            })
            .is_err()
        );
    }
}
