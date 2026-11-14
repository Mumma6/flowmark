use std::collections::{BTreeMap, VecDeque};

#[derive(Clone, Copy, Debug)]
pub struct DirectedEdge<'a> {
    pub from: &'a str,
    pub to: &'a str,
}

/// Kahn elimination over the induced directed graph. Unknown endpoints do not
/// establish membership; duplicate nodes/edges do not change cycle existence.
pub fn has_cycle(nodes: &[&str], edges: &[DirectedEdge<'_>]) -> bool {
    let mut indegrees: BTreeMap<_, usize> = nodes.iter().copied().map(|id| (id, 0)).collect();
    let mut outgoing: BTreeMap<_, Vec<_>> = BTreeMap::new();
    for edge in edges
        .iter()
        .filter(|edge| indegrees.contains_key(edge.from) && indegrees.contains_key(edge.to))
    {
        outgoing.entry(edge.from).or_default().push(edge.to);
    }
    for target in outgoing.values().flatten() {
        if let Some(count) = indegrees.get_mut(target) {
            *count += 1;
        }
    }
    let mut frontier: VecDeque<_> = indegrees
        .iter()
        .filter_map(|(id, count)| (*count == 0).then_some(*id))
        .collect();
    let mut removed = 0;
    while let Some(id) = frontier.pop_front() {
        removed += 1;
        for target in outgoing.get(id).into_iter().flatten() {
            if let Some(count) = indegrees.get_mut(target) {
                *count -= 1;
                if *count == 0 {
                    frontier.push_back(*target);
                }
            }
        }
    }
    removed != indegrees.len()
}
