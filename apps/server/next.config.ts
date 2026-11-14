import type { NextConfig } from "next"
import path from "node:path"

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  outputFileTracingIncludes: {
    "/*": ["../../packages/engine/wasm/**/*"],
  },
}

export default nextConfig
