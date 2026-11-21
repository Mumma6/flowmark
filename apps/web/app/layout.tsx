import type { Metadata } from "next"
import copy from "../public/landing-page-copy.en.json"
import "./globals.css"

const { title, description, keywords } = copy.metadata

export const metadata: Metadata = {
  metadataBase: new URL("https://flowmark.dev"),
  title,
  description,
  applicationName: "Flowmark",
  alternates: { canonical: "/" },
  keywords,
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
