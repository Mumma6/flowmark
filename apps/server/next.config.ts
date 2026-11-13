import type { NextConfig } from "next"
import path from "node:path"

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  outputFileTracingIncludes: {
    "/*": ["../../packages/evidence-engine/wasm/**/*"],
  },
}

export default nextConfig
