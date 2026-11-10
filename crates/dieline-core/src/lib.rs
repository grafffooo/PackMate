//! # dieline-core
//!
//! Parametric packaging dieline generator. Templates turn a few dimensions into vector cut and
//! crease lines plus a fold model for 3D preview; exporters write SVG, PDF and DXF laid out for
//! hobby cutting machines (Brother ScanNCut, Cricut, Silhouette) or print-shop sheets.
//!
//! All units are millimetres.

pub mod api;
pub mod catalog;
pub mod dieline;
pub mod export;
pub mod geom;
pub mod params;
pub mod templates;
