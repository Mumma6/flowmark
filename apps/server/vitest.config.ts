import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globalSetup: ["./test/setup.ts"],
    // Integration files share one disposable database; bound aggregate pools.
    maxWorkers: 4,
  },
})
