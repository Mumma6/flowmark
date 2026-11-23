import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"

const copy = JSON.parse(
  readFileSync(
    new URL("../public/landing-page-copy.en.json", import.meta.url),
    "utf8",
  ),
)

const story = JSON.stringify(copy)

test("the landing tells the four capabilities as the current product", () => {
  assert.deepEqual(
    copy.how.steps.map((step) => step.title),
    ["Connect", "Understand", "Improve Memory", "Verify Changes"],
  )
  assert.deepEqual(
    copy.loop.steps.map((step) => step.title),
    ["Connect", "Understand", "Improve Memory", "Verify Changes"],
  )
  assert.match(copy.hero.body, /remembers what happened/)
  assert.equal(
    copy.metadata.socialImage.caption,
    "Connect → Understand → Improve Memory → Verify Changes",
  )
  assert.doesNotMatch(
    story,
    /in development|planned|process intelligence|business reader|Insights|persona/i,
  )
})
