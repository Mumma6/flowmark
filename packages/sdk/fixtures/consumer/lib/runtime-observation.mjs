export const observationPolicy = {
  key: "SYNTHETIC_REFERENCE_KEY_NOT_FOR_DELIVERY",
  namespaces: [{ kind: "entity", namespace: "booking" }],
}

export const observationValues = {
  entity: {
    booking: "SYNTHETIC_RAW_BOOKING_REFERENCE",
    secret: "SYNTHETIC_UNDECLARED_REFERENCE",
  },
}
