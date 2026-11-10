import { resolve, sep } from "node:path"
import process from "node:process"
import { Buffer } from "node:buffer"
import { log } from "node:console"
import { build } from "esbuild"
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"

const result = await build({
  entryPoints: ["src/app.tsx"],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  define: { "process.env.NODE_ENV": '"production"' },
  drop: ["console"],
  metafile: true,
})
writeFileSync("dist/browser-metafile.json", JSON.stringify(result.metafile))
const script = result.outputFiles[0].text.replaceAll("</script", "<\\/script")
execFileSync(
  process.execPath,
  [
    "node_modules/tailwindcss/lib/cli.js",
    "-i",
    "src/theme.css",
    "-o",
    "dist/theme.css",
    "--minify",
  ],
  { stdio: "pipe" },
)
const css = readFileSync("dist/theme.css", "utf8")
const hash = createHash("sha256").update(script).digest("base64")
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>Flowmark run evidence</title><style>${css}</style></head><body><div id="root"></div><script>${script}</script></body></html>`
if (
  Buffer.byteLength(html) > 1024 * 1024 ||
  /<script[^>]+src=|<link[^>]+href=|\beval\s*\(|new\s+Function\s*\(/i.test(
    html,
  ) ||
  /url\(\s*["']?https?:/i.test(css)
) {
  throw new Error(
    `Evidence resource violates its static asset budget or network/eval policy (${Buffer.byteLength(html)} bytes)`,
  )
}

if (
  Object.keys(result.metafile.inputs).some((path) =>
    ["auth", "api", "db", "mcp"].some((name) =>
      resolve(path).startsWith(resolve("..", name) + sep),
    ),
  )
) {
  throw new Error("Private server module in evidence resource")
}
writeFileSync(
  "dist/generated-resource.js",
  `export const evidenceHtml = ${JSON.stringify(html)};\n`,
)
writeFileSync(
  "dist/generated-resource.d.ts",
  "export declare const evidenceHtml: string\n",
)
writeFileSync("dist/evidence.html", html)
writeFileSync("dist/browser-metafile.json", JSON.stringify(result.metafile))
log(
  `Evidence resource: ${Buffer.byteLength(html)} bytes; no external assets or server runtime modules`,
)
