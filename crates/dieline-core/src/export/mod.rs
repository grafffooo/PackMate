//! File writers. Every writer takes laid-out [`layout::Page`]s.

pub mod dxf;
pub mod layout;
pub mod pdf;
pub mod svg;

use crate::geom::LineKind;

/// Display colours (hex RGB) for each line type. Red cut / blue score is the de-facto convention
/// for print-shop dielines and is easy to re-map in Cricut Design Space or CanvasWorkspace.
pub fn color(kind: LineKind) -> (u8, u8, u8) {
    match kind {
        LineKind::Cut => (0xE5, 0x1A, 0x1A),
        LineKind::Crease => (0x1A, 0x5F, 0xE5),
        LineKind::Perforation => (0xD0, 0x1A, 0xC8),
    }
}

pub fn hex(kind: LineKind) -> String {
    let (r, g, b) = color(kind);
    format!("#{r:02x}{g:02x}{b:02x}")
}

pub fn base64(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for ch in data.chunks(3) {
        let b = [ch[0], *ch.get(1).unwrap_or(&0), *ch.get(2).unwrap_or(&0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        out.push(T[(n >> 18) as usize & 63] as char);
        out.push(T[(n >> 12) as usize & 63] as char);
        out.push(if ch.len() > 1 {
            T[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        out.push(if ch.len() > 2 {
            T[n as usize & 63] as char
        } else {
            '='
        });
    }
    out
}

#[cfg(test)]
mod tests {
    #[test]
    fn b64() {
        assert_eq!(super::base64(b"Man"), "TWFu");
        assert_eq!(super::base64(b"Ma"), "TWE=");
        assert_eq!(super::base64(b"M"), "TQ==");
    }
}
