use std::fmt;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EventKind {
    Started,
    Completed,
    Failed,
    Other,
}

#[derive(Clone, Debug, PartialEq)]
pub struct OperationEvent<'a> {
    pub kind: EventKind,
    pub operation_id: Option<&'a str>,
    pub operation_name: Option<&'a str>,
    pub duration_ms: Option<f64>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OperationStatus {
    Open,
    Completed,
    Failed,
}

#[derive(Clone, Debug, PartialEq)]
pub struct OperationSummary<'a> {
    pub name: &'a str,
    pub occurrence_count: usize,
    pub open_count: usize,
    pub failed_count: usize,
    pub median_duration_ms: Option<f64>,
    pub total_recorded_duration_ms: Option<f64>,
    /// Legacy longest recorded occurrence, with the original zero floor.
    pub duration_ms: Option<f64>,
    pub status: OperationStatus,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EvidenceError {
    NonFiniteDuration,
    InvalidPercentile,
    NonFiniteCalculation,
}

impl fmt::Display for EvidenceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::NonFiniteDuration => "Durations must be finite numbers",
            Self::InvalidPercentile => "Percentile must be between zero and one",
            Self::NonFiniteCalculation => "Calculation exceeds finite numeric range",
        })
    }
}

impl std::error::Error for EvidenceError {}
