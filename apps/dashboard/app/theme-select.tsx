"use client"

import { useSyncExternalStore } from "react"
import { Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@flowmark/ui"

const appearanceItems = {
  system: "System",
  light: "Light",
  dark: "Dark",
}

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export function ThemeSelect() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  )

  return (
    <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
      <Monitor size={15} aria-hidden="true" className="hidden sm:block" />
      <label htmlFor="appearance" className="sr-only">
        Appearance
      </label>
      <Select
        items={appearanceItems}
        value={mounted ? (theme ?? "system") : "system"}
        onValueChange={setTheme}
      >
        <SelectTrigger
          id="appearance"
          className="w-[85px] text-xs sm:w-[100px]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">System</SelectItem>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
