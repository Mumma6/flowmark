import type { Metadata } from "next"
import { Providers } from "./providers"
import "./globals.css"

export const metadata: Metadata = {
  title: "Flowmark Dashboard",
  description: "Workflow observability for application code",
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
