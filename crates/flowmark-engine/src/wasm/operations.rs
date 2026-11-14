use super::response;
use crate::{operations, operations::model};
use serde::{Deserialize, Serialize};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::wasm_bindgen;

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
pub(super) struct Summary<'a> {
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SummaryInput {
    name: String,
    occurrence_count: usize,
    open_count: usize,
    failed_count: usize,
    median_duration_ms: Option<f64>,
    total_recorded_duration_ms: Option<f64>,
    duration_ms: Option<f64>,
    status: Status,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum Status {
    Open,
    Completed,
    Failed,
}

impl SummaryInput {
    pub(super) fn domain(&self) -> model::OperationSummary<'_> {
        model::OperationSummary {
            name: &self.name,
            occurrence_count: self.occurrence_count,
            open_count: self.open_count,
            failed_count: self.failed_count,
            median_duration_ms: self.median_duration_ms,
            total_recorded_duration_ms: self.total_recorded_duration_ms,
            duration_ms: self.duration_ms,
            status: match self.status {
                Status::Open => model::OperationStatus::Open,
                Status::Completed => model::OperationStatus::Completed,
                Status::Failed => model::OperationStatus::Failed,
            },
        }
    }
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
