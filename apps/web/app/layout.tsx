import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Flowmark — Understand what each workflow run did",
  description:
    "An open-source TypeScript SDK and run-focused dashboard for understanding what application workflows did: their steps, errors, progress, and reported business results.",
  applicationName: "Flowmark",
  openGraph: {
    title: "Flowmark — Understand what each workflow run did",
    description:
      "Add a few TypeScript markers to existing application work. See run steps, errors, progress, and reported business results together.",
    siteName: "Flowmark",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Flowmark — Understand what each workflow run did",
    description:
      "Add a few TypeScript markers to existing application work. See run steps, errors, progress, and reported business results together.",
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
