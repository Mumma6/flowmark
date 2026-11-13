import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async headers() {
    return [
      ...["/invitations/:path*", "/sign-in", "/sign-up"].map((source) => ({
        source,
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      })),
      {
        source: "/reset-password",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ]
  },
  transpilePackages: ["@flowmark/ui"],
}

export default nextConfig
