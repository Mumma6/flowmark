import type { Metadata } from "next"
import "./globals.css"

const title = "Flowmark — Understand what your software actually does"
const description =
  "AI-native process intelligence for people and agents. Discover application processes, investigate changing outcomes, and keep instrumentation current as code evolves."

export const metadata: Metadata = {
  metadataBase: new URL("https://flowmark.dev"),
  title,
  description,
  applicationName: "Flowmark",
  alternates: { canonical: "/" },
  keywords: [
    "process intelligence",
    "workflow observability",
    "TypeScript",
    "SDK",
    "open source",
    "AI agents",
    "MCP",
    "Flowmark Studio",
  ],
  openGraph: {
    title,
    description,
    siteName: "Flowmark",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  )
}
