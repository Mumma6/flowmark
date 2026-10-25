import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

const title = "Flowmark — Turn business processes into data-driven insight"
const description =
  "Operations insight for TypeScript. Mark a checkout, sync, or job and see volume, duration, success rate, and the reported result."

export const metadata: Metadata = {
  metadataBase: new URL("https://flowmark.dev"),
  title,
  description,
  applicationName: "Flowmark",
  keywords: [
    "workflow observability",
    "operations insight",
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
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
