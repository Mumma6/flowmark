#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import console from "node:console"
import process from "node:process"
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function readPackedManifest(tarballPath) {
  const listing = spawnSync("tar", ["-xOf", tarballPath, "package/package.json"], {
    encoding: "utf8",
  })
  if (listing.status !== 0) {
    console.error(`Failed to read package.json from ${tarballPath}.`)
    process.exit(1)
  }
  return JSON.parse(listing.stdout)
}

function assertNoWorkspaceProtocol(manifest, label) {
  const deps = { ...manifest.dependencies, ...manifest.peerDependencies }
  for (const [name, version] of Object.entries(deps)) {
    if (typeof version === "string" && version.startsWith("workspace:")) {
      console.error(
        `${label} tarball still contains workspace protocol for ${name}: ${version}`,
      )
      process.exit(1)
    }
  }
  if (!manifest.main || !manifest.types) {
    console.error(`${label} tarball is missing main/types in package.json.`)
    process.exit(1)
  }
}

console.log("Release verify: SDK tests…")
run("pnpm", ["--filter", "@flowmarkdev/core", "test"])
run("pnpm", ["--filter", "@flowmarkdev/node", "test"])

console.log("Release verify: SDK builds…")
run("pnpm", ["--filter", "@flowmarkdev/core", "build"])
run("pnpm", ["--filter", "@flowmarkdev/node", "build"])

const tempDir = mkdtempSync(join(tmpdir(), "flowmark-release-verify-"))
try {
  console.log("Release verify: pack tarballs…")
  run("pnpm", [
    "--filter",
    "@flowmarkdev/core",
    "pack",
    "--pack-destination",
    tempDir,
  ])
  run("pnpm", [
    "--filter",
    "@flowmarkdev/node",
    "pack",
    "--pack-destination",
    tempDir,
  ])

  const tarballs = readdirSync(tempDir).filter((name) => name.endsWith(".tgz"))
  const coreTar = tarballs.find((name) => name.startsWith("flowmarkdev-core-"))
  const nodeTar = tarballs.find((name) => name.startsWith("flowmarkdev-node-"))
  if (!coreTar || !nodeTar) {
    console.error("Expected core and node pack tarballs in temp directory.")
    process.exit(1)
  }

  const coreManifest = readPackedManifest(join(tempDir, coreTar))
  const nodeManifest = readPackedManifest(join(tempDir, nodeTar))

  assertNoWorkspaceProtocol(coreManifest, "@flowmarkdev/core")
  assertNoWorkspaceProtocol(nodeManifest, "@flowmarkdev/node")

  if (coreManifest.version !== nodeManifest.version) {
    console.error(
      `Version mismatch: core ${coreManifest.version} vs node ${nodeManifest.version}`,
    )
    process.exit(1)
  }

  console.log(
    `Release verify passed for @flowmarkdev/core and @flowmarkdev/node @ ${coreManifest.version}.`,
  )
  console.log(
    "Publish deliberately via GitHub Actions (see private/docs/sdk-release.md).",
  )
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
