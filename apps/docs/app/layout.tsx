import { RootProvider } from "fumadocs-ui/provider/next"
import "./globals.css"
import type { ReactNode } from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: { default: "Flowmark documentation", template: "%s | Flowmark Docs" },
  description:
    "Get started with Flowmark, instrument TypeScript workflows, and explore the SDK API.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <h1>Preview test 4</h1>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
