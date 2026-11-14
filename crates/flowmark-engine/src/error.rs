use std::fmt;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EngineError {
    NonFiniteInput,
    InvalidPercentile,
    NonFiniteCalculation,
}

impl fmt::Display for EngineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::NonFiniteInput => "Numeric inputs must be finite numbers",
            Self::InvalidPercentile => "Percentile must be between zero and one",
            Self::NonFiniteCalculation => "Calculation exceeds finite numeric range",
        })
    }
}

impl std::error::Error for EngineError {}
