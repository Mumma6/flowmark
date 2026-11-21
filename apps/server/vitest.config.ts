import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globalSetup: ["./test/setup.ts"],
    // Integration files share one disposable database; bound aggregate pools.
    maxWorkers: 4,
    // Give database-backed fixtures headroom under shared runner load.
    testTimeout: process.env.TEST_DATABASE_URL ? 15_000 : 5_000,
  },
})
