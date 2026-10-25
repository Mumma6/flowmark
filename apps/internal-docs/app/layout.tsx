import { RootProvider } from "fumadocs-ui/provider/next"
import type { Metadata } from "next"
import "./globals.css"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: {
    default: "Flowmark internal docs",
    template: "%s | Flowmark internal docs",
  },
  robots: {
    index: false,
    follow: false,
  },
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
