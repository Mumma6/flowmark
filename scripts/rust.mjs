import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import console from "node:console"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cache = path.join(root, ".cache/rust")
const cargoHome = process.env.CARGO_HOME ?? path.join(cache, "cargo")
const rustupHome = process.env.RUSTUP_HOME ?? path.join(cache, "rustup")
const env = {
  ...process.env,
  CARGO_HOME: cargoHome,
  RUSTUP_HOME: rustupHome,
  PATH: `${path.join(cargoHome, "bin")}${path.delimiter}${process.env.PATH}`,
}
const toolchain = readFileSync(
  path.join(root, "rust-toolchain.toml"),
  "utf8",
).match(/channel = "([^"]+)"/)[1]
const bindingVersion = readFileSync(
  path.join(root, "crates/flowmark-evidence/Cargo.toml"),
  "utf8",
).match(/wasm-bindgen = "=([^"]+)"/)[1]

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function setup() {
  if (!existsSync(path.join(cargoHome, "bin/rustup"))) {
    mkdirSync(cache, { recursive: true })
    const installer = path.join(cache, "rustup-init.sh")
    run("curl", [
      "--proto",
      "=https",
      "--tlsv1.2",
      "-sSf",
      "https://sh.rustup.rs",
      "-o",
      installer,
    ])
    run("sh", [
      installer,
      "-y",
      "--no-modify-path",
      "--profile",
      "minimal",
      "--default-toolchain",
      toolchain,
    ])
  }
  run("rustup", ["show", "active-toolchain"])
}

const command = process.argv[2]
if (!["setup", "check", "format", "build"].includes(command)) {
  throw new Error("Usage: node scripts/rust.mjs setup|check|format|build")
}
setup()
if (command === "check") {
  run("cargo", ["fmt", "--all", "--check"])
  run("cargo", [
    "clippy",
    "--workspace",
    "--all-targets",
    "--locked",
    "--",
    "-D",
    "warnings",
  ])
  run("cargo", ["test", "--workspace", "--locked"])
}
if (command === "format") {
  run("cargo", ["fmt", "--all"])
}
if (command === "build") {
  const version = spawnSync("wasm-bindgen", ["--version"], {
    env,
    encoding: "utf8",
  })
  if (
    version.status !== 0 ||
    version.stdout.trim() !== `wasm-bindgen ${bindingVersion}`
  ) {
    run("cargo", [
      "install",
      "wasm-bindgen-cli",
      "--version",
      bindingVersion,
      "--locked",
      "--force",
    ])
  }
  run("cargo", [
    "build",
    "--release",
    "--locked",
    "--target",
    "wasm32-unknown-unknown",
    "-p",
    "flowmark-evidence",
  ])
  const output = path.join(root, "packages/evidence-engine/wasm")
  run("wasm-bindgen", [
    path.resolve(
      root,
      env.CARGO_TARGET_DIR ?? "target",
      "wasm32-unknown-unknown/release/flowmark_evidence.wasm",
    ),
    "--target",
    "web",
    "--out-dir",
    output,
  ])
  writeFileSync(
    path.join(output, "package.json"),
    JSON.stringify({ type: "module" }) + "\n",
  )
  const binary = readFileSync(path.join(output, "flowmark_evidence_bg.wasm"))
  writeFileSync(
    path.join(output, "engine.js"),
    [
      'import { Buffer } from "node:buffer"',
      'import { initSync, summarize_operations_json, percentile_json } from "./flowmark_evidence.js"',
      `initSync({ module: Buffer.from(${JSON.stringify(binary.toString("base64"))}, "base64") })`,
      "export { summarize_operations_json, percentile_json }",
      "",
    ].join("\n"),
  )
  writeFileSync(
    path.join(output, "engine.d.ts"),
    'export { summarize_operations_json, percentile_json } from "./flowmark_evidence.js"\n',
  )
  console.info(
    `Built ESM bindings with ${binary.length} embedded WASM bytes; no runtime file reads.`,
  )
}
