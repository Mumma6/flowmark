import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Flowmark API",
  description:
    "Flowmark API reference: event ingestion, browser security, health checks, and typed workflow queries.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
