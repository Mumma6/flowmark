import { createFlowmark } from "@flowmarkdev/node"

// Reuse one Node client. Set FLOWMARK_API_KEY; hosted delivery is the default.
// The process owns shutdown(). Next entry points use @flowmarkdev/node/next.
export const flowmark = createFlowmark()
