import { createMDX } from "fumadocs-mdx/next"
import process from "node:process"

const withMDX = createMDX()
export default withMDX({
  distDir: process.env.FLOWMARK_DOCS_DIST_DIR ?? ".next",
})
