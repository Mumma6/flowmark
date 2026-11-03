"use client"

import { Button } from "@flowmark/ui"
import { RefreshCw } from "lucide-react"

export function Refresh({
  fetching,
  onClick,
}: {
  fetching: boolean
  onClick: () => void
}) {
  return (
    <Button variant="outline" size="sm" disabled={fetching} onClick={onClick}>
      <RefreshCw aria-hidden="true" />
      Refresh
    </Button>
  )
}
