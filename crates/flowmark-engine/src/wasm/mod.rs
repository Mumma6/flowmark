//! Serialization and runtime bindings; domain modules have no Serde/WASM dependency.
use serde::Serialize;
mod comparisons;
mod graphs;
mod operations;
mod statistics;
pub use comparisons::compare_summaries_json;
pub use graphs::has_cycle_json;
pub use operations::summarize_operations_json;
pub use statistics::percentile_json;

#[derive(Serialize)]
#[serde(tag = "tag")]
enum Response<T> {
    Ok { version: u8, value: T },
    Error { version: u8, message: String },
}

fn response<T: Serialize>(value: Result<T, String>) -> String {
    let response = match value {
        Ok(value) => Response::Ok { version: 1, value },
        Err(message) => Response::Error {
            version: 1,
            message,
        },
    };
    // All domain numbers are finite; response fields and messages are JSON-safe.
    serde_json::to_string(&response).expect("JSON-safe engine response")
}
