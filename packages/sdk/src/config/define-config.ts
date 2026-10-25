import type { FlowmarkConfig } from "../types/index.js"

/**
 * Defines server configuration with autocomplete and preserved literal types.
 * Returns the same object without reading environment variables, validating credentials,
 * creating a client, or starting delivery. Validation happens at the client boundary.
 * Export from flowmark.config.ts and pass to createFlowmark(); the file is not auto-loaded.
 * Keep this configuration server-only. Use @flowmark/node/browser for public browser keys.
 * @example
 * export default defineConfig({ apiUrl: "http://localhost:3003" })
 */
export function defineConfig<const T extends FlowmarkConfig>(
  config: T & Record<Exclude<keyof T, keyof FlowmarkConfig>, never>,
): T {
  return config
}
