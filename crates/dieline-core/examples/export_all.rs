//! Writes every template with default parameters as an SVG into the given directory.
//! `cargo run -p dieline-core --example export_all -- out/`
use dieline_core::api;

fn main() {
    let dir = std::env::args().nth(1).unwrap_or_else(|| "out".into());
    std::fs::create_dir_all(&dir).unwrap();
    for t in dieline_core::templates::all() {
        let id = t.info().id;
        for f in api::export_files(id, "{}", r#"{"format":"svg"}"#).unwrap() {
            let path = format!("{dir}/{}", f.name);
            std::fs::write(&path, f.text.unwrap()).unwrap();
            println!("{path}");
        }
    }
}
