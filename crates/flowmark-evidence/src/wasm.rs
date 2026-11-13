//! Versioned JSON boundary. The calculation modules know nothing about Serde or WASM.
use serde::{Deserialize, Serialize};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::wasm_bindgen;

use crate::{model, operations};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Event {
    r#type: String,
    operation_id: Option<String>,
    operation_name: Option<String>,
    duration_ms: Option<f64>,
}

impl Event {
    fn evidence(&self) -> model::OperationEvent<'_> {
        model::OperationEvent {
            kind: match self.r#type.as_str() {
                "operation_started" => model::EventKind::Started,
                "operation_completed" => model::EventKind::Completed,
                "operation_failed" => model::EventKind::Failed,
                _ => model::EventKind::Other,
            },
            operation_id: self.operation_id.as_deref(),
            operation_name: self.operation_name.as_deref(),
            duration_ms: self.duration_ms,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Summary<'a> {
    name: &'a str,
    occurrence_count: usize,
    open_count: usize,
    failed_count: usize,
    median_duration_ms: Option<f64>,
    total_recorded_duration_ms: Option<f64>,
    duration_ms: Option<f64>,
    status: &'static str,
}

impl<'a> From<model::OperationSummary<'a>> for Summary<'a> {
    fn from(value: model::OperationSummary<'a>) -> Self {
        Self {
            name: value.name,
            occurrence_count: value.occurrence_count,
            open_count: value.open_count,
            failed_count: value.failed_count,
            median_duration_ms: value.median_duration_ms,
            total_recorded_duration_ms: value.total_recorded_duration_ms,
            duration_ms: value.duration_ms,
            status: match value.status {
                model::OperationStatus::Open => "open",
                model::OperationStatus::Completed => "completed",
                model::OperationStatus::Failed => "failed",
            },
        }
    }
}

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
    serde_json::to_string(&response).expect("JSON-safe evidence response")
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub fn summarize_operations_json(input: &str) -> String {
    let events = match serde_json::from_str::<Vec<Event>>(input) {
        Ok(events) => events,
        Err(error) => return response::<()>(Err(error.to_string())),
    };
    let evidence: Vec<_> = events.iter().map(Event::evidence).collect();
    response(
        operations::summarize_operations(&evidence)
            .map(|summaries| summaries.into_iter().map(Summary::from).collect::<Vec<_>>())
            .map_err(|error| error.to_string()),
    )
}

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
                operations::percentile(&input.values, input.p).map_err(|error| error.to_string())
            }),
    )
}
