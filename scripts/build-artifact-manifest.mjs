import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { readFile } from "node:fs/promises"
import { createArtifactManifest } from "../packages/core/dist/index.js"

const [artifactPath, declarationsPath, revision] = process.argv.slice(2)
if (
  process.argv.length !== 5 ||
  !artifactPath ||
  !declarationsPath ||
  !revision
) {
  throw new Error(
    "Usage: node scripts/build-artifact-manifest.mjs <built-file> <declarations.json> <git-revision>",
  )
}
const declarations = JSON.parse(await readFile(declarationsPath, "utf8"))
const hash = createHash("sha256")
for await (const chunk of createReadStream(artifactPath)) {
  hash.update(chunk)
}

const manifest = createArtifactManifest({
  ...declarations,
  version: 1,
  revision,
  artifactDigest: `sha256:${hash.digest("hex")}`,
})
console.log(JSON.stringify(manifest, null, 2))
