"use client"

import { useEffect, useState } from "react"
import { observePromise } from "../lifecycle/observe-promise"

type Resource<K, A> =
  | { readonly key: K; readonly kind: "ready"; readonly value: A }
  | { readonly key: K; readonly kind: "failed" }

/** Identity hides previous content immediately, before the replacement effect runs. */
export const useAsyncResource = <K, A>(
  key: K,
  load: (key: K) => Promise<A>,
) => {
  const [resource, setResource] = useState<Resource<K, A>>()
  useEffect(
    () =>
      observePromise(
        () => load(key),
        (value) => setResource({ key, kind: "ready", value }),
        () => setResource({ key, kind: "failed" }),
      ),
    [key, load],
  )
  return resource?.key === key ? resource : undefined
}
