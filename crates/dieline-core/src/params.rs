//! Parameter schema shared by all templates; the UI renders its form from this.

use serde::Serialize;
use serde_json::{Map, Value};

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ParamKind {
    /// A length in millimetres.
    Length {
        default: f64,
        min: f64,
        max: f64,
    },
    Number {
        default: f64,
        min: f64,
        max: f64,
        step: f64,
    },
    Bool {
        default: bool,
    },
    Choice {
        default: String,
        options: Vec<(String, String)>,
    },
}

#[derive(Clone, Debug, Serialize)]
pub struct ParamDef {
    pub id: String,
    pub label: String,
    pub group: String,
    #[serde(flatten)]
    pub kind: ParamKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub help: Option<String>,
}

pub const G_DIM: &str = "Dimensions";
pub const G_MAT: &str = "Material";
pub const G_OPT: &str = "Options";

pub fn length(id: &str, label: &str, group: &str, default: f64, min: f64, max: f64) -> ParamDef {
    ParamDef {
        id: id.into(),
        label: label.into(),
        group: group.into(),
        kind: ParamKind::Length { default, min, max },
        help: None,
    }
}

pub fn boolean(id: &str, label: &str, default: bool) -> ParamDef {
    ParamDef {
        id: id.into(),
        label: label.into(),
        group: G_OPT.into(),
        kind: ParamKind::Bool { default },
        help: None,
    }
}

pub fn choice(
    id: &str,
    label: &str,
    group: &str,
    default: &str,
    opts: &[(&str, &str)],
) -> ParamDef {
    ParamDef {
        id: id.into(),
        label: label.into(),
        group: group.into(),
        kind: ParamKind::Choice {
            default: default.into(),
            options: opts
                .iter()
                .map(|(a, b)| (a.to_string(), b.to_string()))
                .collect(),
        },
        help: None,
    }
}

impl ParamDef {
    pub fn help(mut self, h: &str) -> ParamDef {
        self.help = Some(h.into());
        self
    }
}

/// Material thickness + whether the entered sizes are inside or outside measurements.
pub fn material_params(with_dims_mode: bool) -> Vec<ParamDef> {
    let mut v = vec![
        length("thickness", "Material thickness", G_MAT, 0.4, 0.05, 8.0).help(
            "Used to compensate fold allowances. Pick a material preset or measure your stock.",
        ),
    ];
    if with_dims_mode {
        v.push(
            choice(
                "dims",
                "Sizes are",
                G_DIM,
                "inner",
                &[
                    ("inner", "Inside dimensions"),
                    ("outer", "Outside dimensions"),
                ],
            )
            .help("Inside: the contents fit exactly. Outside: the finished box measures this."),
        );
    }
    v
}

/// Resolved parameter values (defaults applied, numbers clamped).
#[derive(Clone, Debug)]
pub struct Params(pub Map<String, Value>);

impl Params {
    pub fn resolve(defs: &[ParamDef], input: &Value) -> Params {
        let mut out = Map::new();
        let get = |id: &str| input.get(id);
        for d in defs {
            let v = match &d.kind {
                ParamKind::Length { default, min, max }
                | ParamKind::Number {
                    default, min, max, ..
                } => {
                    let x = get(&d.id)
                        .and_then(|v| v.as_f64().or_else(|| v.as_str()?.parse().ok()))
                        .filter(|x: &f64| x.is_finite())
                        .unwrap_or(*default);
                    Value::from(x.clamp(*min, *max))
                }
                ParamKind::Bool { default } => {
                    Value::from(get(&d.id).and_then(|v| v.as_bool()).unwrap_or(*default))
                }
                ParamKind::Choice { default, options } => {
                    let s = get(&d.id)
                        .and_then(|v| v.as_str())
                        .filter(|s| options.iter().any(|(id, _)| id == s))
                        .unwrap_or(default);
                    Value::from(s)
                }
            };
            out.insert(d.id.clone(), v);
        }
        Params(out)
    }

    pub fn f(&self, id: &str) -> f64 {
        self.0.get(id).and_then(|v| v.as_f64()).unwrap_or(0.0)
    }
    pub fn b(&self, id: &str) -> bool {
        self.0.get(id).and_then(|v| v.as_bool()).unwrap_or(false)
    }
    pub fn s(&self, id: &str) -> &str {
        self.0.get(id).and_then(|v| v.as_str()).unwrap_or("")
    }
}

/// Panel sizes for a folded box: the centre-line of the board sits half a thickness outside the
/// inner size, so each panel is `inner + t` (equivalently `outer - t`).
#[derive(Clone, Copy, Debug)]
pub struct BoxDims {
    pub l: f64,
    pub w: f64,
    pub h: f64,
    pub t: f64,
}

impl BoxDims {
    pub fn from(p: &Params) -> BoxDims {
        let t = p.f("thickness");
        let k = if p.s("dims") == "outer" { -t } else { t };
        BoxDims {
            l: p.f("length") + k,
            w: p.f("width") + k,
            h: p.f("height") + k,
            t,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn resolve_defaults_and_clamp() {
        let defs = vec![
            length("a", "A", G_DIM, 10.0, 1.0, 20.0),
            boolean("b", "B", true),
            choice("c", "C", G_OPT, "x", &[("x", "X"), ("y", "Y")]),
        ];
        let p = Params::resolve(&defs, &json!({"a": 99, "c": "zzz"}));
        assert_eq!(p.f("a"), 20.0);
        assert!(p.b("b"));
        assert_eq!(p.s("c"), "x");
        let p = Params::resolve(&defs, &json!({"a": "5.5", "c": "y", "b": false}));
        assert_eq!(p.f("a"), 5.5);
        assert!(!p.b("b"));
        assert_eq!(p.s("c"), "y");
    }
}
