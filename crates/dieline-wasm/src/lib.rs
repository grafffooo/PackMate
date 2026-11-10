//! WebAssembly bindings. Everything crosses the boundary as JSON strings.

use dieline_core::api;
use wasm_bindgen::prelude::*;

fn err(e: String) -> JsError {
    JsError::new(&e)
}

/// All templates with their parameter schemas.
#[wasm_bindgen]
pub fn templates() -> String {
    api::templates_json()
}

/// Material presets and machine / sheet profiles.
#[wasm_bindgen]
pub fn catalog() -> String {
    api::catalog_json()
}

/// Generate a dieline: paths (SVG path data), fold-model panels, warnings and resolved params.
#[wasm_bindgen]
pub fn generate(id: &str, params: &str) -> Result<String, JsError> {
    api::generate_json(id, params).map_err(err)
}

/// Export to SVG / PDF / DXF. Returns `{ files: [{ name, mime, text | base64 }] }`.
#[wasm_bindgen(js_name = exportFiles)]
pub fn export_files(id: &str, params: &str, options: &str) -> Result<String, JsError> {
    api::export_json(id, params, options).map_err(err)
}

/// How the design fits on a sheet: `{ fits, rotated, per_sheet, tiles }`.
#[wasm_bindgen]
pub fn fit(id: &str, params: &str, sheet: &str, spacing: f64) -> Result<String, JsError> {
    api::fit_json(id, params, sheet, spacing).map_err(err)
}
