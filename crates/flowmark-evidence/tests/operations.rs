use flowmark_evidence::{
    model::{EventKind, EvidenceError, OperationEvent, OperationStatus},
    operations::{percentile, summarize_operations},
    wasm::{percentile_json, summarize_operations_json},
};
use proptest::prelude::*;
use serde::Deserialize;

#[derive(Deserialize)]
struct Fixture {
    name: String,
    events: serde_json::Value,
    expected: serde_json::Value,
}

// JavaScript has one numeric type; JSON's integer/float spelling is not a contract.
fn js_numbers(value: serde_json::Value) -> serde_json::Value {
    use serde_json::Value;
    match value {
        Value::Number(number) => Value::from(number.as_f64().unwrap()),
        Value::Array(items) => Value::Array(items.into_iter().map(js_numbers).collect()),
        Value::Object(fields) => Value::Object(
            fields
                .into_iter()
                .map(|(key, value)| (key, js_numbers(value)))
                .collect(),
        ),
        value => value,
    }
}

#[test]
fn legacy_fixtures_match_the_serialization_boundary() {
    let fixtures: Vec<Fixture> =
        serde_json::from_str(include_str!("fixtures/operations.json")).unwrap();
    for fixture in fixtures {
        let result: serde_json::Value =
            serde_json::from_str(&summarize_operations_json(&fixture.events.to_string())).unwrap();
        assert_eq!(result["tag"], "Ok", "{}", fixture.name);
        assert_eq!(result["version"], 1);
        assert_eq!(
            js_numbers(result["value"].clone()),
            js_numbers(fixture.expected),
            "{}",
            fixture.name
        );
    }
}

#[test]
fn invalid_numbers_are_explicit_failures() {
    assert_eq!(
        percentile(&[f64::NAN], 0.5),
        Err(EvidenceError::NonFiniteDuration)
    );
    assert_eq!(
        percentile(&[f64::INFINITY], 0.5),
        Err(EvidenceError::NonFiniteDuration)
    );
    assert_eq!(percentile(&[], -0.1), Err(EvidenceError::InvalidPercentile));
    assert_eq!(
        percentile(&[], f64::NAN),
        Err(EvidenceError::InvalidPercentile)
    );
    assert_eq!(
        percentile(&[-f64::MAX, f64::MAX], 0.5),
        Err(EvidenceError::NonFiniteCalculation)
    );
    let event = OperationEvent {
        kind: EventKind::Completed,
        operation_id: Some("a"),
        operation_name: None,
        duration_ms: Some(f64::NAN),
    };
    assert_eq!(
        summarize_operations(&[event]),
        Err(EvidenceError::NonFiniteDuration)
    );
    for input in [
        "not json",
        r#"[{"type":"operation_completed","durationMs":"bad"}]"#,
    ] {
        let result: serde_json::Value =
            serde_json::from_str(&summarize_operations_json(input)).unwrap();
        assert_eq!(result["tag"], "Error");
    }
    let result: serde_json::Value =
        serde_json::from_str(&percentile_json(r#"{"values":[],"p":2}"#)).unwrap();
    assert_eq!(result["tag"], "Error");
}

#[test]
fn percentile_edges_and_overflow() {
    assert_eq!(percentile(&[], 0.5), Ok(None));
    assert_eq!(percentile(&[7.0], 0.95), Ok(Some(7.0)));
    assert_eq!(percentile(&[4.0, 1.0, 3.0, 2.0], 0.5), Ok(Some(2.5)));
    assert_eq!(percentile(&[0.0, 10.0], 0.95), Ok(Some(9.5)));
    assert_eq!(percentile(&[3.0, 1.0], 0.0), Ok(Some(1.0)));
    assert_eq!(percentile(&[3.0, 1.0], 1.0), Ok(Some(3.0)));
}

proptest! {
    #[test]
    fn terminal_evidence_is_not_reopened(duration in 0u32..1_000_000, failed in any::<bool>()) {
        let terminal = OperationEvent {
            kind: if failed { EventKind::Failed } else { EventKind::Completed },
            operation_id: Some("a"), operation_name: Some("work"), duration_ms: Some(f64::from(duration)),
        };
        let start = OperationEvent { kind: EventKind::Started, duration_ms: None, ..terminal.clone() };
        let before = summarize_operations(std::slice::from_ref(&terminal));
        prop_assert_eq!(before, summarize_operations(&[terminal, start]));
    }

    #[test]
    fn independent_occurrences_conserve_evidence(durations in prop::collection::vec(0u32..1_000_000, 1..100)) {
        let ids: Vec<_> = (0..durations.len()).map(|id| id.to_string()).collect();
        let events: Vec<_> = ids.iter().zip(&durations).map(|(id, duration)| OperationEvent {
            kind: EventKind::Completed, operation_id: Some(id), operation_name: Some("work"), duration_ms: Some(f64::from(*duration)),
        }).collect();
        let summaries = summarize_operations(&events).unwrap();
        prop_assert_eq!(summaries.len(), 1);
        prop_assert_eq!(summaries[0].occurrence_count, durations.len());
        prop_assert_eq!(summaries[0].total_recorded_duration_ms, Some(durations.iter().map(|n| f64::from(*n)).sum()));
        prop_assert_eq!(summaries[0].status, OperationStatus::Completed);
    }

    #[test]
    fn percentile_is_permutation_invariant_and_bounded(values in prop::collection::vec(-1_000_000i32..1_000_000, 1..100), p in 0u16..=1000) {
        let values: Vec<_> = values.into_iter().map(f64::from).collect();
        let reversed: Vec<_> = values.iter().copied().rev().collect();
        let result = percentile(&values, f64::from(p) / 1000.0).unwrap().unwrap();
        prop_assert_eq!(Some(result), percentile(&reversed, f64::from(p) / 1000.0).unwrap());
        prop_assert!(result >= values.iter().copied().fold(f64::INFINITY, f64::min));
        prop_assert!(result <= values.iter().copied().fold(f64::NEG_INFINITY, f64::max));
    }
}
