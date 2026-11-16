import { execFileSync } from "node:child_process"
import { appendFileSync, readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { inspect } from "./factory/guardian.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const git = (args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
const base = process.argv[2] ?? "origin/staging"
if (!/^[\w./-]+$/.test(base) || base.startsWith("-")) {
  throw new Error("Expected a Git base ref or SHA")
}
const revision = git(["rev-parse", "--verify", `${base}^{commit}`]).trim()
const relevant = (file) =>
  /\.(ts|tsx|md|mdx|mdc)$/.test(file) || /(^|\/)package.json$/.test(file)
const basePaths = git(["ls-tree", "-r", "--name-only", "-z", revision])
  .split("\0")
  .filter(Boolean)
const basePathSet = new Set(basePaths)
const currentFiles = git([
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "-z",
])
  .split("\0")
  .filter(relevant)
const changed = new Set([
  ...git(["diff", "--name-only", "-z", revision]).split("\0"),
  ...currentFiles.filter((file) => !basePathSet.has(file)),
])
// Read all prose/manifests for backlinks/ownership, but parse TS only when changed.
const needsContent = (file) =>
  relevant(file) && (!/\.tsx?$/.test(file) || changed.has(file))
const baseFiles = basePaths.filter(needsContent)
const before = new Map(
  baseFiles.map((file) => [file, git(["show", `${revision}:${file}`])]),
)
const after = new Map(
  [...new Set(currentFiles)]
    .filter(needsContent)
    .filter((file) => existsSync(`${root}${file}`))
    .map((file) => [file, readFileSync(`${root}${file}`, "utf8")]),
)
// Include all tracked paths so relative links to assets, directories and source resolve.
const withPaths = (tree, files) =>
  new Map([...files.map((file) => [file, ""]), ...tree])
const findings = inspect(
  withPaths(before, basePaths),
  withPaths(
    after,
    git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
      .split("\0")
      .filter((file) => file && existsSync(`${root}${file}`)),
  ),
)
const summary =
  [
    "## Engineering guardians",
    `Compared with \`${revision.slice(0, 12)}\`: ${findings.length} new deterministic finding(s).`,
    ...findings.map(
      ({ file, line, rule, message }) =>
        `- \`${file}:${line}\` **${rule}**: ${message}`,
    ),
    "",
    "Covers selected Effect 4/functional syntax, package ownership, local Markdown links and removed documented root commands. Existing graph tests cover runtime direction/cycles. Contextual architecture, duplication and semantic documentation review require AI/human judgment; hosted AI is disabled.",
  ].join("\n") + "\n"
process.stdout.write(summary)
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
}
const escape = (text) =>
  text.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")
if (process.env.GITHUB_ACTIONS === "true") {
  findings.forEach(({ file, line, rule, message }) =>
    process.stdout.write(
      `::error file=${escape(file).replaceAll(",", "%2C").replaceAll(":", "%3A")},line=${line},title=${rule}::${escape(message)}\n`,
    ),
  )
}
process.exitCode = findings.length ? 1 : 0
