import { createRequire } from "node:module"
import { defineConfig } from "vitest/config"

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      // Next implements this marker at build time. Unit tests execute the
      // server graph directly, using Next's own empty server implementation.
      "server-only": createRequire(import.meta.url).resolve(
        "next/dist/compiled/server-only/empty.js",
      ),
    },
  },
})
