"use client"

import { Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { NativeSelect } from "@flowmark/ui"

export function ThemeSelect() {
  const { theme, setTheme } = useTheme()

  return (
    <label className="flex shrink-0 items-center gap-2 text-muted-foreground">
      <Monitor size={15} aria-hidden="true" className="hidden sm:block" />
      <span className="sr-only">Appearance</span>
      <NativeSelect
        className="w-[85px] text-xs sm:w-[100px]"
        aria-label="Appearance"
        value={theme ?? "system"}
        onChange={(event) => setTheme(event.target.value)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </NativeSelect>
    </label>
  )
}
