import type { Metadata } from "next"
import "./globals.css"

const title = "Flowmark — Know what your workflows actually accomplish"
const description =
  "Workflow observability for TypeScript. Understand what your processes accomplish, explore reported business outcomes, and investigate the runs behind them."

export const metadata: Metadata = {
  metadataBase: new URL("https://flowmark.dev"),
  title,
  description,
  applicationName: "Flowmark",
  alternates: { canonical: "/" },
  keywords: [
    "workflow observability",
    "TypeScript",
    "SDK",
    "open source",
    "dashboard",
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
