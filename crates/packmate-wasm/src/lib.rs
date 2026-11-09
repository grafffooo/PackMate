use packmate_core::{BoxSpec, open_tray_svg};
use wasm_bindgen::prelude::*;

/// Generates an open tray dieline SVG. Dimensions are in millimetres.
#[wasm_bindgen(js_name = openTraySvg)]
pub fn open_tray_svg_js(length: f64, width: f64, height: f64) -> Result<String, JsError> {
    open_tray_svg(&BoxSpec {
        length,
        width,
        height,
    })
    .map_err(|e| JsError::new(&e.to_string()))
}
