use super::{operations::SummaryInput, response};
use crate::{
    comparisons::{self, Peer, RunStatus},
    operations::model::OperationStatus,
};
use serde::Deserialize;
use serde_json::json;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::wasm_bindgen;

#[derive(Deserialize)]
enum Status {
    Completed,
    Failed,
    Running,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PeerInput {
    run_id: String,
    status: Status,
    duration_ms: Option<f64>,
    operations: Vec<SummaryInput>,
}

#[derive(Deserialize)]
struct Input {
    current: Vec<SummaryInput>,
    peers: Vec<PeerInput>,
    names: Vec<String>,
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub fn compare_summaries_json(input: &str) -> String {
    let input = match serde_json::from_str::<Input>(input) {
        Ok(input) => input,
        Err(error) => return response::<()>(Err(error.to_string())),
    };
    let current: Vec<_> = input.current.iter().map(SummaryInput::domain).collect();
    let peers: Vec<_> = input
        .peers
        .iter()
        .map(|peer| Peer {
            run_id: &peer.run_id,
            status: match peer.status {
                Status::Completed => RunStatus::Completed,
                Status::Failed => RunStatus::Failed,
                Status::Running => RunStatus::Running,
            },
            duration_ms: peer.duration_ms,
            operations: peer.operations.iter().map(SummaryInput::domain).collect(),
        })
        .collect();
    let names: Vec<_> = input.names.iter().map(String::as_str).collect();
    response(comparisons::compare_summaries(&current, &peers, &names).map(|result| {
        let operations: Vec<_> = result.operations.iter().map(|row| json!({
            "name": row.name,
            "currentDurationMs": row.current_duration_ms,
            "currentOccurrenceCount": row.current_occurrence_count,
            "currentOpenCount": row.current_open_count,
            "currentFailedCount": row.current_failed_count,
            "currentMedianOccurrenceDurationMs": row.current_median_occurrence_duration_ms,
            "currentTotalRecordedDurationMs": row.current_total_recorded_duration_ms,
            "currentStatus": match row.current_status { Some(OperationStatus::Open) => "open", Some(OperationStatus::Completed) => "completed", Some(OperationStatus::Failed) => "failed", None => "absent" },
            "peerMedianDurationMs": row.peer_median_duration_ms,
            "peerMedianOccurrenceDurationMs": row.peer_median_occurrence_duration_ms,
            "peerMedianTotalRecordedDurationMs": row.peer_median_total_recorded_duration_ms,
            "peerOpenRunCount": row.peer_open_run_count,
            "peerFailedRunCount": row.peer_failed_run_count,
            "peerPresentCount": row.peer_present_count,
            "peerRunIds": row.peer_run_ids,
        })).collect();
        json!({"peerSuccessRate": result.peer_success_rate, "peerMedianDurationMs": result.peer_median_duration_ms, "peerP95DurationMs": result.peer_p95_duration_ms, "operations": operations})
    }).map_err(|error| error.to_string()))
}
