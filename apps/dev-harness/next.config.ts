import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@flowmarkdev/node", "@flowmarkdev/core", "@flowmark/ui"],
}

export default nextConfig
