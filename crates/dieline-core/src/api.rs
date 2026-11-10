//! JSON-in / JSON-out facade used by the WebAssembly bindings (and anything else that wants a
//! language-neutral interface).

use crate::export::{self, layout};
use crate::geom::{LineKind, Pt};
use crate::templates;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Serialize)]
struct TemplateOut {
    #[serde(flatten)]
    info: templates::TemplateInfo,
    params: Vec<crate::params::ParamDef>,
}

pub fn templates_json() -> String {
    let v: Vec<TemplateOut> = templates::all()
        .iter()
        .map(|t| TemplateOut {
            info: t.info(),
            params: t.params(),
        })
        .collect();
    serde_json::to_string(&v).unwrap()
}

pub fn catalog_json() -> String {
    json!({
        "materials": crate::catalog::materials(),
        "machines": crate::catalog::machines(),
    })
    .to_string()
}

#[derive(Serialize)]
struct PathOut {
    kind: LineKind,
    d: String,
    closed: bool,
}

#[derive(Serialize)]
struct GenerateOut<'a> {
    width: f64,
    height: f64,
    paths: Vec<PathOut>,
    panels: &'a [crate::dieline::Panel],
    glue: &'a [Vec<Pt>],
    warnings: &'a [String],
    upright: bool,
    params: &'a serde_json::Map<String, Value>,
    cut_length: f64,
    crease_length: f64,
}

fn parse(s: &str) -> Result<Value, String> {
    if s.trim().is_empty() {
        return Ok(json!({}));
    }
    serde_json::from_str(s).map_err(|e| format!("invalid JSON: {e}"))
}

fn template(id: &str) -> Result<&'static dyn templates::Template, String> {
    templates::find(id).ok_or_else(|| format!("unknown template '{id}'"))
}

pub fn generate_json(id: &str, params: &str) -> Result<String, String> {
    let t = template(id)?;
    let (p, d) = templates::generate(t, &parse(params)?);
    let bb = d.bbox();
    let out = GenerateOut {
        width: bb.width(),
        height: bb.height(),
        paths: d
            .paths
            .iter()
            .map(|p| PathOut {
                kind: p.kind,
                d: p.svg_d(),
                closed: p.closed,
            })
            .collect(),
        panels: &d.panels,
        glue: &d.glue,
        warnings: &d.warnings,
        upright: d.upright,
        params: &p.0,
        cut_length: d.length_of(LineKind::Cut),
        crease_length: d.length_of(LineKind::Crease),
    };
    serde_json::to_string(&out).map_err(|e| e.to_string())
}

#[derive(Deserialize, Default, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Format {
    #[default]
    Svg,
    Pdf,
    Dxf,
}

#[derive(Deserialize, Default)]
#[serde(default)]
pub struct ExportOptions {
    pub format: Format,
    /// Base file name without extension.
    pub name: String,
    #[serde(flatten)]
    pub layout: layout::LayoutOptions,
}

#[derive(Serialize)]
pub struct FileOut {
    pub name: String,
    pub mime: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base64: Option<String>,
}

pub fn export_files(id: &str, params: &str, options: &str) -> Result<Vec<FileOut>, String> {
    let t = template(id)?;
    let (_p, d) = templates::generate(t, &parse(params)?);
    let opts: ExportOptions =
        serde_json::from_value(parse(options)?).map_err(|e| format!("invalid options: {e}"))?;
    let base = if opts.name.trim().is_empty() {
        t.info().id.to_string()
    } else {
        sanitize(&opts.name)
    };
    let pages = layout::layout(&d, &opts.layout);
    let title = t.info().name;
    let fname = |suffix: &str, ext: &str| {
        if suffix.is_empty() {
            format!("{base}.{ext}")
        } else {
            format!("{base}-{suffix}.{ext}")
        }
    };
    Ok(match opts.format {
        Format::Pdf => vec![FileOut {
            name: fname("", "pdf"),
            mime: "application/pdf",
            text: None,
            base64: Some(export::base64(&export::pdf::write(&pages, title))),
        }],
        Format::Svg => pages
            .iter()
            .map(|pg| FileOut {
                name: fname(&pg.suffix, "svg"),
                mime: "image/svg+xml",
                text: Some(export::svg::write(pg, title)),
                base64: None,
            })
            .collect(),
        Format::Dxf => pages
            .iter()
            .map(|pg| FileOut {
                name: fname(&pg.suffix, "dxf"),
                mime: "application/dxf",
                text: Some(export::dxf::write(pg)),
                base64: None,
            })
            .collect(),
    })
}

pub fn export_json(id: &str, params: &str, options: &str) -> Result<String, String> {
    let files = export_files(id, params, options)?;
    serde_json::to_string(&json!({ "files": files })).map_err(|e| e.to_string())
}

/// Sheet fit summary for the editor badge.
pub fn fit_json(id: &str, params: &str, sheet: &str, spacing: f64) -> Result<String, String> {
    let t = template(id)?;
    let (_p, d) = templates::generate(t, &parse(params)?);
    let sheet: layout::Sheet = serde_json::from_value(parse(sheet)?).map_err(|e| e.to_string())?;
    serde_json::to_string(&layout::fit(&d.bbox(), &sheet, spacing, 10.0)).map_err(|e| e.to_string())
}

fn sanitize(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_template_generates_and_exports() {
        let list: Vec<Value> = serde_json::from_str(&templates_json()).unwrap();
        assert!(list.len() >= 8);
        for t in list {
            let id = t["id"].as_str().unwrap();
            let g: Value = serde_json::from_str(&generate_json(id, "{}").unwrap()).unwrap();
            assert!(g["width"].as_f64().unwrap() > 10.0);
            assert!(!g["panels"].as_array().unwrap().is_empty());
            for fmt in ["svg", "pdf", "dxf"] {
                let files = export_files(id, "{}", &format!("{{\"format\":\"{fmt}\"}}")).unwrap();
                assert!(!files.is_empty());
            }
        }
    }

    #[test]
    fn svg_is_mm_and_layered() {
        let files = export_files(
            "reverse-tuck-end",
            "{}",
            r#"{"format":"svg","name":"my box"}"#,
        )
        .unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].name, "my-box.svg");
        let s = files[0].text.as_ref().unwrap();
        assert!(s.contains("mm\" height=\""));
        assert!(s.contains("id=\"cut\"") && s.contains("id=\"crease\""));
    }

    #[test]
    fn pdf_structure() {
        let files = export_files(
            "mailer-box",
            "{}",
            r#"{"format":"pdf","sheet":{"w":296,"h":296}}"#,
        )
        .unwrap();
        let b64 = files[0].base64.as_ref().unwrap();
        assert!(b64.starts_with("JVBERi0xLjU")); // %PDF-1.5
    }

    #[test]
    fn tiles_produce_multiple_svgs() {
        let files = export_files(
            "mailer-box",
            "{}",
            r#"{"format":"svg","sheet":{"w":296,"h":296}}"#,
        )
        .unwrap();
        assert!(files.len() > 1);
        assert!(files[0].name.contains("tile-r1-c1"));
    }

    #[test]
    fn errors() {
        assert!(generate_json("nope", "{}").is_err());
        assert!(generate_json("envelope", "{bad").is_err());
    }
}
