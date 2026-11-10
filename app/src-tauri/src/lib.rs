// The whole dieline engine runs as WebAssembly inside the webview, so the native shell only
// provides a window plus file dialogs for saving exports.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running PackMate");
}
