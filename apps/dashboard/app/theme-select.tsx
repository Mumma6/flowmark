"use client"

import { Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@flowmark/ui"

export function ThemeSelect() {
  const { theme, setTheme } = useTheme()

  return (
    <label className="flex shrink-0 items-center gap-2 text-muted-foreground">
      <Monitor size={15} aria-hidden="true" className="hidden sm:block" />
      <span className="sr-only">Appearance</span>
      <Select
        aria-label="Appearance"
        value={theme ?? "system"}
        onValueChange={setTheme}
      >
        <SelectTrigger
          className="w-[85px] text-xs sm:w-[100px]"
          aria-label="Appearance"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">System</SelectItem>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
        </SelectContent>
      </Select>
    </label>
  )
}
