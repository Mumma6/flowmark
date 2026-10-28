import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
  assertPreviewMigrationTarget,
  describeDatabaseTarget,
  isLoopbackHost,
  isNeonHost,
} from "./db-env-neon.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

describe("db-env-neon helpers", () => {
  it("classifies loopback hosts", () => {
    assert.equal(isLoopbackHost("localhost"), true)
    assert.equal(isLoopbackHost("127.0.0.1"), true)
    assert.equal(isLoopbackHost("ep-foo.eu-central-1.aws.neon.tech"), false)
  })

  it("classifies neon hosts", () => {
    assert.equal(isNeonHost("ep-foo.eu-central-1.aws.neon.tech"), true)
    assert.equal(isNeonHost("localhost"), false)
  })

  it("describes database targets without printing secrets", () => {
    const neon = describeDatabaseTarget(
      "postgresql://user:secret@ep-foo.eu-central-1.aws.neon.tech/neondb",
    )
    assert.equal(neon.kind, "neon")
    assert.equal(neon.host, "ep-foo.eu-central-1.aws.neon.tech")
    assert.equal(neon.host.includes("secret"), false)
  })

  it("refuses a fake preview migration host", () => {
    const fakeHost = assertPreviewMigrationTarget({
      branch: "preview",
      migrationUrl: "postgresql://user:secret@ep-fake.example.com/neondb",
      productionMigrationUrl:
        "postgresql://user:secret@ep-prod.eu-central-1.aws.neon.tech/neondb",
    })
    assert.match(fakeHost ?? "", /ep-fake\.example\.com/)
    assert.equal(fakeHost?.includes("secret"), false)

    const sameHost = assertPreviewMigrationTarget({
      branch: "preview",
      migrationUrl: "postgresql://user:secret@ep-fake.neon.tech/neondb",
      productionMigrationUrl:
        "postgresql://user:other@ep-fake.neon.tech/neondb",
    })
    assert.match(sameHost ?? "", /matches the production env file/)
    assert.equal(sameHost?.includes("secret"), false)

    assert.match(
      assertPreviewMigrationTarget({
        branch: "production",
        migrationUrl: "postgresql://user:secret@ep-preview.neon.tech/neondb",
        productionMigrationUrl:
          "postgresql://user:secret@ep-prod.neon.tech/neondb",
      }) ?? "",
      /not preview/,
    )
    assert.equal(
      assertPreviewMigrationTarget({
        branch: "preview",
        migrationUrl: "postgresql://user:secret@ep-preview.neon.tech/neondb",
        productionMigrationUrl:
          "postgresql://user:secret@ep-prod.neon.tech/neondb",
      }),
      null,
    )
  })

  it("exits before reading database URLs when preview migrate is not confirmed", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/db-migrate-preview.mjs"],
      { cwd: repoRoot, encoding: "utf8" },
    )
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /confirm-preview-migrate/)
    assert.equal(result.stderr.includes("postgresql://"), false)
    assert.equal(result.stdout.includes("postgresql://"), false)
  })
})
