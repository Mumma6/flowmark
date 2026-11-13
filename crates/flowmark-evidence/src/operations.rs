use std::collections::HashMap;

use crate::model::{EventKind, EvidenceError, OperationEvent, OperationStatus, OperationSummary};

fn finite(value: f64) -> Result<f64, EvidenceError> {
    value
        .is_finite()
        .then_some(value)
        .ok_or(EvidenceError::NonFiniteCalculation)
}

/// Linear interpolation, matching the existing JavaScript calculation.
pub fn percentile(values: &[f64], p: f64) -> Result<Option<f64>, EvidenceError> {
    if !p.is_finite() || !(0.0..=1.0).contains(&p) {
        return Err(EvidenceError::InvalidPercentile);
    }
    if values.iter().any(|value| !value.is_finite()) {
        return Err(EvidenceError::NonFiniteDuration);
    }
    if values.is_empty() {
        return Ok(None);
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(f64::total_cmp);
    let index = (sorted.len() - 1) as f64 * p;
    let low = index.floor() as usize;
    let high = index.ceil() as usize;
    let lower = sorted[low];
    let value = if low == high {
        lower
    } else {
        lower + (sorted[high] - lower) * (index - low as f64)
    };
    finite(value).map(Some)
}

struct Occurrence<'a> {
    name: &'a str,
    duration: Option<f64>,
    status: OperationStatus,
}

/// Input order is authoritative; timestamps are deliberately not interpreted.
/// Local indexes accelerate lookup; vectors preserve first-seen output and sum order.
pub fn summarize_operations<'a>(
    events: &[OperationEvent<'a>],
) -> Result<Vec<OperationSummary<'a>>, EvidenceError> {
    let mut positions: HashMap<&str, usize> = HashMap::new();
    let mut occurrences: Vec<Occurrence<'a>> = Vec::new();
    for event in events {
        let Some(id) = event.operation_id.filter(|id| !id.is_empty()) else {
            continue;
        };
        let status = match event.kind {
            EventKind::Other => continue,
            EventKind::Started if positions.contains_key(id) => continue,
            EventKind::Started => OperationStatus::Open,
            EventKind::Completed => OperationStatus::Completed,
            EventKind::Failed => OperationStatus::Failed,
        };
        let duration = match status {
            OperationStatus::Open => None,
            _ => event.duration_ms,
        };
        if duration.is_some_and(|value| !value.is_finite()) {
            return Err(EvidenceError::NonFiniteDuration);
        }
        match positions.get(id) {
            Some(&position) => {
                occurrences[position].status = status;
                occurrences[position].duration = duration;
            }
            None => {
                positions.insert(id, occurrences.len());
                occurrences.push(Occurrence {
                    name: event.operation_name.unwrap_or("Operation"),
                    duration,
                    status,
                });
            }
        }
    }

    let mut names: HashMap<&str, usize> = HashMap::new();
    let mut groups: Vec<(&str, Vec<&Occurrence<'_>>)> = Vec::new();
    for occurrence in &occurrences {
        let position = *names.entry(occurrence.name).or_insert_with(|| {
            groups.push((occurrence.name, Vec::new()));
            groups.len() - 1
        });
        groups[position].1.push(occurrence);
    }
    groups
        .into_iter()
        .map(|(name, occurrences)| {
            let durations: Vec<_> = occurrences
                .iter()
                .filter_map(|item| item.duration)
                .collect();
            let open_count = occurrences
                .iter()
                .filter(|item| item.status == OperationStatus::Open)
                .count();
            let failed_count = occurrences
                .iter()
                .filter(|item| item.status == OperationStatus::Failed)
                .count();
            let status = match (failed_count, open_count) {
                (1.., _) => OperationStatus::Failed,
                (_, 1..) => OperationStatus::Open,
                _ => OperationStatus::Completed,
            };
            let (total, longest) = if durations.is_empty() {
                (None, None)
            } else {
                (
                    Some(finite(
                        durations.iter().fold(0.0, |sum, value| sum + value),
                    )?),
                    Some(durations.iter().copied().fold(0.0, f64::max)),
                )
            };
            Ok(OperationSummary {
                name,
                occurrence_count: occurrences.len(),
                open_count,
                failed_count,
                median_duration_ms: percentile(&durations, 0.5)?,
                total_recorded_duration_ms: total,
                duration_ms: longest,
                status,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::percentile;
    #[test]
    fn percentile_edges() {
        assert_eq!(percentile(&[], 0.5), Ok(None));
        assert_eq!(percentile(&[7.0], 0.95), Ok(Some(7.0)));
        assert_eq!(percentile(&[4.0, 1.0, 3.0, 2.0], 0.5), Ok(Some(2.5)));
        assert_eq!(percentile(&[0.0, 10.0], 0.95), Ok(Some(9.5)));
        assert_eq!(percentile(&[3.0, 1.0], 0.0), Ok(Some(1.0)));
        assert_eq!(percentile(&[3.0, 1.0], 1.0), Ok(Some(3.0)));
    }
}
