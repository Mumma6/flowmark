import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@flowmark/node", "@flowmark/core", "@flowmark/ui"],
}

export default nextConfig
