/** Own one browser async subscription. Cleanup suppresses work and both late outcomes. */
export const observePromise = <A>(
  load: () => Promise<A>,
  success: (value: A) => void,
  failure: () => void,
): (() => void) => {
  let active = true
  void Promise.resolve().then(async () => {
    if (!active) {
      return
    }
    try {
      const value = await load()
      if (active) {
        success(value)
      }
    } catch {
      if (active) {
        failure()
      }
    }
  })
  return () => {
    active = false
  }
}
