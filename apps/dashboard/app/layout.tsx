import type { Metadata } from "next"
import { Providers } from "../features/platform/providers"
import "./globals.css"

export const metadata: Metadata = {
  title: "Flowmark Studio",
  description:
    "Explore your application's processes, outcomes and execution evidence.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body className="m-0 bg-background font-sans text-foreground antialiased motion-reduce:[&_*]:animate-none motion-reduce:[&_*]:transition-none [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-ring">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
