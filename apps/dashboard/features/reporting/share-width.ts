const shareWidths = {
  0: "w-0",
  10: "w-[10%]",
  20: "w-[20%]",
  30: "w-[30%]",
  40: "w-[40%]",
  50: "w-[50%]",
  60: "w-[60%]",
  70: "w-[70%]",
  80: "w-[80%]",
  90: "w-[90%]",
  100: "w-full",
} as const

export function shareWidthClass(percent: number) {
  const bucket = Math.min(
    100,
    Math.max(0, Math.round(percent / 10) * 10),
  ) as keyof typeof shareWidths
  return shareWidths[bucket]
}
