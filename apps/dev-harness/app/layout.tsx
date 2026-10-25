import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Flowmark Local Dev Harness",
  description:
    "A local-only Flowmark development harness for exercising SDK telemetry.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="m-0 bg-background font-sans text-foreground antialiased [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-ring">
        {children}
      </body>
    </html>
  )
}
