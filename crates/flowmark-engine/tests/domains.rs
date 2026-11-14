mod support;
use flowmark_engine::{
    comparisons::{Peer, RunStatus, compare_summaries},
    graphs::{DirectedEdge, has_cycle},
    wasm::{compare_summaries_json, has_cycle_json},
};
use proptest::prelude::*;
use support::js_numbers;

fn fixtures(json: &str, evaluate: fn(&str) -> String) {
    let fixtures: Vec<serde_json::Value> = serde_json::from_str(json).unwrap();
    for fixture in fixtures {
        let output: serde_json::Value =
            serde_json::from_str(&evaluate(&fixture["input"].to_string())).unwrap();
        assert_eq!(output["tag"], "Ok", "{}", fixture["name"]);
        assert_eq!(
            js_numbers(output["value"].clone()),
            js_numbers(fixture["expected"].clone()),
            "{}",
            fixture["name"]
        );
    }
}

#[test]
fn comparisons_preserve_legacy_results() {
    fixtures(
        include_str!("fixtures/comparisons.json"),
        compare_summaries_json,
    );
}
#[test]
fn graph_membership_and_cycles_preserve_legacy_results() {
    fixtures(include_str!("fixtures/graphs.json"), has_cycle_json);
}
#[test]
fn malformed_domain_inputs_fail_explicitly() {
    for evaluate in [compare_summaries_json, has_cycle_json] {
        let output: serde_json::Value = serde_json::from_str(&evaluate("{}")).unwrap();
        assert_eq!(output["tag"], "Error");
    }
}

proptest! {
    #[test]
    fn graph_cycles_ignore_order_and_duplicate_edges(n in 0usize..12, links in prop::collection::vec((0usize..16, 0usize..16),0..40)) {
        let labels: Vec<_> = (0..16).map(|id| id.to_string()).collect();
        let nodes: Vec<_> = labels.iter().take(n).map(String::as_str).collect();
        let edges: Vec<_> = links.iter().map(|(from,to)| DirectedEdge{from: &labels[*from],to: &labels[*to]}).collect();
        let reversed: Vec<_> = edges.iter().rev().map(|edge| DirectedEdge {from: edge.to,to: edge.from}).collect();
        let repeated: Vec<_> = edges.iter().chain(&edges).copied().collect();
        let expected = has_cycle(&nodes, &edges);
        prop_assert_eq!(expected, has_cycle(&nodes, &reversed));
        prop_assert_eq!(expected, has_cycle(&nodes, &repeated));
        let extended: Vec<_> = nodes.iter().copied().chain(std::iter::once("isolated")).collect();
        prop_assert_eq!(expected, has_cycle(&extended, &edges));
    }
    #[test]
    fn ordered_forward_edges_are_acyclic(n in 1usize..30) {
        let labels: Vec<_> = (0..n).map(|id| id.to_string()).collect();
        let nodes: Vec<_> = labels.iter().map(String::as_str).collect();
        let edges: Vec<_> = labels.windows(2).map(|pair| DirectedEdge{from: &pair[0],to: &pair[1]}).collect();
        prop_assert!(!has_cycle(&nodes,&edges));
    }
    #[test]
    fn an_unobserved_open_peer_changes_neither_terminal_rate_nor_duration_statistics(samples in prop::collection::vec((any::<bool>(), 0u32..1_000_000),0..100)) {
        let mut peers: Vec<_> = samples.iter().map(|(completed,duration)| Peer{run_id:"peer",status: if *completed {RunStatus::Completed} else {RunStatus::Failed},duration_ms:Some(f64::from(*duration)),operations:vec![]}).collect();
        let before = compare_summaries(&[],&peers,&[]).unwrap();
        peers.push(Peer{run_id:"open",status:RunStatus::Running,duration_ms:None,operations:vec![]});
        let after = compare_summaries(&[],&peers,&[]).unwrap();
        prop_assert_eq!(before.peer_success_rate,after.peer_success_rate);
        prop_assert_eq!(before.peer_median_duration_ms,after.peer_median_duration_ms);
        prop_assert_eq!(before.peer_p95_duration_ms,after.peer_p95_duration_ms);
    }
}
