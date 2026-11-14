use crate::{
    error::EngineError,
    operations::model::{OperationStatus, OperationSummary},
    statistics::percentile,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RunStatus {
    Completed,
    Failed,
    Running,
}

pub struct Peer<'a> {
    pub run_id: &'a str,
    pub status: RunStatus,
    pub duration_ms: Option<f64>,
    pub operations: Vec<OperationSummary<'a>>,
}

#[derive(Debug)]
pub struct OperationComparison<'a> {
    pub name: &'a str,
    pub current_duration_ms: Option<f64>,
    pub current_occurrence_count: usize,
    pub current_open_count: usize,
    pub current_failed_count: usize,
    pub current_median_occurrence_duration_ms: Option<f64>,
    pub current_total_recorded_duration_ms: Option<f64>,
    pub current_status: Option<OperationStatus>,
    pub peer_median_duration_ms: Option<f64>,
    pub peer_median_occurrence_duration_ms: Option<f64>,
    pub peer_median_total_recorded_duration_ms: Option<f64>,
    pub peer_open_run_count: usize,
    pub peer_failed_run_count: usize,
    pub peer_present_count: usize,
    pub peer_run_ids: Vec<&'a str>,
}

#[derive(Debug)]
pub struct Comparison<'a> {
    pub peer_success_rate: Option<f64>,
    pub peer_median_duration_ms: Option<f64>,
    pub peer_p95_duration_ms: Option<f64>,
    pub operations: Vec<OperationComparison<'a>>,
}

fn compare_operation<'a>(
    name: &'a str,
    current: &[OperationSummary<'a>],
    peers: &[Peer<'a>],
) -> Result<OperationComparison<'a>, EngineError> {
    let current = current.iter().find(|item| item.name == name);
    let matches: Vec<_> = peers
        .iter()
        .filter_map(|peer| {
            peer.operations
                .iter()
                .find(|item| item.name == name)
                .map(|operation| (peer.run_id, operation))
        })
        .collect();
    let median = |select: fn(&OperationSummary<'_>) -> Option<f64>| {
        percentile(
            &matches
                .iter()
                .filter_map(|(_, item)| select(item))
                .collect::<Vec<_>>(),
            0.5,
        )
    };
    Ok(OperationComparison {
        name,
        current_duration_ms: current.and_then(|item| item.duration_ms),
        current_occurrence_count: current.map_or(0, |item| item.occurrence_count),
        current_open_count: current.map_or(0, |item| item.open_count),
        current_failed_count: current.map_or(0, |item| item.failed_count),
        current_median_occurrence_duration_ms: current.and_then(|item| item.median_duration_ms),
        current_total_recorded_duration_ms: current
            .and_then(|item| item.total_recorded_duration_ms),
        current_status: current.map(|item| item.status),
        peer_median_duration_ms: median(|item| item.duration_ms)?,
        peer_median_occurrence_duration_ms: median(|item| item.median_duration_ms)?,
        peer_median_total_recorded_duration_ms: median(|item| item.total_recorded_duration_ms)?,
        peer_open_run_count: matches
            .iter()
            .filter(|(_, item)| item.open_count > 0)
            .count(),
        peer_failed_run_count: matches
            .iter()
            .filter(|(_, item)| item.failed_count > 0)
            .count(),
        peer_present_count: matches.len(),
        peer_run_ids: matches.iter().map(|(id, _)| *id).collect(),
    })
}

/// Names arrive in the caller's presentation order; no locale is hidden in Rust.
/// Finished-run rates and duration observations retain independent denominators.
pub fn compare_summaries<'a>(
    current: &[OperationSummary<'a>],
    peers: &[Peer<'a>],
    names: &[&'a str],
) -> Result<Comparison<'a>, EngineError> {
    if current
        .iter()
        .chain(peers.iter().flat_map(|peer| &peer.operations))
        .flat_map(|item| {
            [
                item.duration_ms,
                item.median_duration_ms,
                item.total_recorded_duration_ms,
            ]
        })
        .flatten()
        .any(|value| !value.is_finite())
    {
        return Err(EngineError::NonFiniteInput);
    }
    let finished = peers
        .iter()
        .filter(|peer| peer.status != RunStatus::Running)
        .count();
    let completed = peers
        .iter()
        .filter(|peer| peer.status == RunStatus::Completed)
        .count();
    let durations: Vec<_> = peers.iter().filter_map(|peer| peer.duration_ms).collect();
    Ok(Comparison {
        peer_success_rate: (finished > 0)
            .then(|| (1000.0 * completed as f64 / finished as f64).round() / 10.0),
        peer_median_duration_ms: percentile(&durations, 0.5)?,
        peer_p95_duration_ms: percentile(&durations, 0.95)?,
        operations: names
            .iter()
            .map(|name| compare_operation(name, current, peers))
            .collect::<Result<_, _>>()?,
    })
}
