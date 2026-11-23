import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@flowmark/ui"],
  experimental: {
    agentUpgrade: "security",
  },
}

export default nextConfig
