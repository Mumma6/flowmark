import { RootProvider } from "fumadocs-ui/provider/next"
import "./globals.css"
import type { ReactNode } from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: { default: "Flowmark documentation", template: "%s | Flowmark Docs" },
  description:
    "Connect your coding agent to recorded runtime evidence and learn how to capture application behavior with Flowmark.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
