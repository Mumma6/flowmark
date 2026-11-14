use super::response;
use crate::statistics;
use serde::Deserialize;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::wasm_bindgen;

#[derive(Deserialize)]
struct Percentile {
    values: Vec<f64>,
    p: f64,
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub fn percentile_json(input: &str) -> String {
    response(
        serde_json::from_str::<Percentile>(input)
            .map_err(|error| error.to_string())
            .and_then(|input| {
                statistics::percentile(&input.values, input.p).map_err(|error| error.to_string())
            }),
    )
}
