use super::response;
use crate::graphs::{DirectedEdge, has_cycle};
use serde::Deserialize;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::wasm_bindgen;

#[derive(Deserialize)]
struct Edge {
    from: String,
    to: String,
}
#[derive(Deserialize)]
struct Input {
    nodes: Vec<String>,
    edges: Vec<Edge>,
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub fn has_cycle_json(input: &str) -> String {
    response(
        serde_json::from_str::<Input>(input)
            .map(|input| {
                let nodes: Vec<_> = input.nodes.iter().map(String::as_str).collect();
                let edges: Vec<_> = input
                    .edges
                    .iter()
                    .map(|edge| DirectedEdge {
                        from: &edge.from,
                        to: &edge.to,
                    })
                    .collect();
                has_cycle(&nodes, &edges)
            })
            .map_err(|error| error.to_string()),
    )
}
