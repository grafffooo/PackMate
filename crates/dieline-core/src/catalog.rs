//! Material presets and cutting-machine / sheet profiles.

use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct Material {
    pub id: &'static str,
    pub name: &'static str,
    pub thickness: f64,
    pub note: &'static str,
}

pub fn materials() -> Vec<Material> {
    vec![
        Material {
            id: "paper-120",
            name: "Paper 120 gsm",
            thickness: 0.15,
            note: "Envelopes, liners",
        },
        Material {
            id: "card-200",
            name: "Cardstock 200 gsm",
            thickness: 0.25,
            note: "Small favour boxes",
        },
        Material {
            id: "card-250",
            name: "Cardstock 250 gsm",
            thickness: 0.3,
            note: "Most hobby boxes",
        },
        Material {
            id: "card-300",
            name: "Cardstock 300 gsm",
            thickness: 0.4,
            note: "Sturdy gift boxes",
        },
        Material {
            id: "kraft-350",
            name: "Kraft board 350 gsm",
            thickness: 0.5,
            note: "Retail cartons",
        },
        Material {
            id: "sbs-18pt",
            name: "SBS / folding carton 18pt",
            thickness: 0.46,
            note: "Print-shop cartons",
        },
        Material {
            id: "chipboard-1",
            name: "Chipboard 1 mm",
            thickness: 1.0,
            note: "Rigid trays (score deeply)",
        },
        Material {
            id: "e-flute",
            name: "Corrugated E-flute",
            thickness: 1.6,
            note: "Mailers — large machines",
        },
        Material {
            id: "b-flute",
            name: "Corrugated B-flute",
            thickness: 3.0,
            note: "Shipping — plotters/CNC",
        },
    ]
}

#[derive(Clone, Debug, Serialize)]
pub struct Machine {
    pub id: &'static str,
    pub name: &'static str,
    pub group: &'static str,
    /// Usable cutting area in mm (None = artwork-sized page).
    pub w: Option<f64>,
    pub h: Option<f64>,
    pub margin: f64,
    /// Recommended crease handling: "layer" (scoring tool / pen) or "dashed".
    pub crease: &'static str,
    pub tip: &'static str,
}

pub fn machines() -> Vec<Machine> {
    const SNC: &str = "Import the SVG into CanvasWorkspace. Set the crease layer to Draw (pen) or Emboss/score, or export with dashed creases to cut perforated fold lines.";
    const CRI: &str = "Upload the SVG to Design Space. Select the crease layer, set Operation to Score (scoring wheel or stylus), then Attach it to the cut layer.";
    const SIL: &str = "Open the SVG/DXF in Silhouette Studio. Use Cut by Line Color: red = cut, blue = score or perforate.";
    vec![
        Machine {
            id: "actual",
            name: "Actual size (single page)",
            group: "General",
            w: None,
            h: None,
            margin: 5.0,
            crease: "layer",
            tip: "One page sized to the design — for plotters, laser cutters and print shops.",
        },
        Machine {
            id: "scanncut-12x12",
            name: "Brother ScanNCut — 12×12\" mat",
            group: "Brother ScanNCut",
            w: Some(296.0),
            h: Some(296.0),
            margin: 0.0,
            crease: "dashed",
            tip: SNC,
        },
        Machine {
            id: "scanncut-12x24",
            name: "Brother ScanNCut — 12×24\" mat",
            group: "Brother ScanNCut",
            w: Some(296.0),
            h: Some(602.0),
            margin: 0.0,
            crease: "dashed",
            tip: SNC,
        },
        Machine {
            id: "cricut-12x12",
            name: "Cricut Maker / Explore — 12×12\" mat",
            group: "Cricut",
            w: Some(292.1),
            h: Some(292.1),
            margin: 0.0,
            crease: "layer",
            tip: CRI,
        },
        Machine {
            id: "cricut-12x24",
            name: "Cricut Maker / Explore — 12×24\" mat",
            group: "Cricut",
            w: Some(292.1),
            h: Some(596.9),
            margin: 0.0,
            crease: "layer",
            tip: CRI,
        },
        Machine {
            id: "cricut-joy-xtra",
            name: "Cricut Joy Xtra — 8.5×12\" mat",
            group: "Cricut",
            w: Some(203.2),
            h: Some(292.1),
            margin: 0.0,
            crease: "dashed",
            tip: CRI,
        },
        Machine {
            id: "silhouette-12x12",
            name: "Silhouette Cameo — 12×12\" mat",
            group: "Silhouette",
            w: Some(295.0),
            h: Some(295.0),
            margin: 0.0,
            crease: "layer",
            tip: SIL,
        },
        Machine {
            id: "silhouette-12x24",
            name: "Silhouette Cameo — 12×24\" mat",
            group: "Silhouette",
            w: Some(295.0),
            h: Some(600.0),
            margin: 0.0,
            crease: "layer",
            tip: SIL,
        },
        Machine {
            id: "a4",
            name: "A4 sheet (210×297)",
            group: "Paper / print-then-cut",
            w: Some(210.0),
            h: Some(297.0),
            margin: 6.0,
            crease: "layer",
            tip: "Print and cut by hand, or use print-then-cut.",
        },
        Machine {
            id: "letter",
            name: "US Letter (8.5×11\")",
            group: "Paper / print-then-cut",
            w: Some(215.9),
            h: Some(279.4),
            margin: 6.0,
            crease: "layer",
            tip: "Print and cut by hand, or use print-then-cut.",
        },
        Machine {
            id: "a3",
            name: "A3 sheet (297×420)",
            group: "Paper / print-then-cut",
            w: Some(297.0),
            h: Some(420.0),
            margin: 6.0,
            crease: "layer",
            tip: "Print and cut by hand, or use print-then-cut.",
        },
        Machine {
            id: "sra3",
            name: "SRA3 sheet (320×450)",
            group: "Print shop",
            w: Some(320.0),
            h: Some(450.0),
            margin: 5.0,
            crease: "layer",
            tip: "Digital press sheet; pair with a sheet-fed cutter.",
        },
        Machine {
            id: "b2",
            name: "B2 sheet (500×707)",
            group: "Print shop",
            w: Some(500.0),
            h: Some(707.0),
            margin: 10.0,
            crease: "layer",
            tip: "Flatbed cutting tables (Zünd, Esko Kongsberg, etc.).",
        },
        Machine {
            id: "b1",
            name: "B1 sheet (707×1000)",
            group: "Print shop",
            w: Some(707.0),
            h: Some(1000.0),
            margin: 10.0,
            crease: "layer",
            tip: "Flatbed cutting tables (Zünd, Esko Kongsberg, etc.).",
        },
    ]
}
