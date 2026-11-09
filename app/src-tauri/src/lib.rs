use packmate_core::{BoxSpec, open_tray_svg};

/// Native entry point to the core generator (the web UI uses the WASM build,
/// this is for native-only features such as saving files).
#[tauri::command]
fn generate_open_tray(length: f64, width: f64, height: f64) -> Result<String, String> {
    open_tray_svg(&BoxSpec {
        length,
        width,
        height,
    })
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![generate_open_tray])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
