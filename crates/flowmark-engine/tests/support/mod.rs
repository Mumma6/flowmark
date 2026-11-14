// JavaScript has one numeric type; JSON's integer/float spelling is not a contract.
pub fn js_numbers(value: serde_json::Value) -> serde_json::Value {
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
