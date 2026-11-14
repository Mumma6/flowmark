use crate::error::EngineError;

pub(crate) fn finite(value: f64) -> Result<f64, EngineError> {
    value
        .is_finite()
        .then_some(value)
        .ok_or(EngineError::NonFiniteCalculation)
}

/// Linear interpolation, matching the existing JavaScript calculation.
pub fn percentile(values: &[f64], p: f64) -> Result<Option<f64>, EngineError> {
    if !p.is_finite() || !(0.0..=1.0).contains(&p) {
        return Err(EngineError::InvalidPercentile);
    }
    if values.iter().any(|value| !value.is_finite()) {
        return Err(EngineError::NonFiniteInput);
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
