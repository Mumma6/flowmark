import assert from "node:assert/strict"
import test from "node:test"
import * as pulumi from "@pulumi/pulumi"
import type { MockResourceArgs } from "@pulumi/pulumi/runtime"
import {
  manageResendDomain,
  relativeRecordName,
  selectVerificationRecord,
} from "../resend-domain"

const records = [
  {
    record: "DKIM",
    name: "resend._domainkey.flowmark.dev",
    type: "TXT",
    value: "synthetic-public-dkim",
  },
  {
    record: "SPF",
    name: "send.flowmark.dev",
    type: "TXT",
    value: "v=spf1 include:amazonses.com ~all",
  },
  {
    record: "SPF",
    name: "send.flowmark.dev",
    type: "MX",
    value: "feedback-smtp.eu-west-1.amazonses.com",
    priority: 10,
  },
  // Required by the live API for full verification, even while Forge is disabled.
  { record: "SPF", name: "rsend", type: "CNAME", value: "send.forge.rmta.net" },
]
const registered: MockResourceArgs[] = []
pulumi.runtime.setMocks(
  {
    newResource: (args) => {
      registered.push(args)
      return {
        id: args.name,
        state: {
          ...args.inputs,
          ...(args.type === "resend:index/domain:Domain"
            ? { records, status: "not_started" }
            : {}),
        },
      }
    },
    call: ({ inputs }) => inputs,
  },
  "flowmark-infrastructure",
  "production",
  false,
)
const configure = (values: Record<string, string>) =>
  pulumi.runtime.setAllConfig(values)
const config = {
  "flowmark-infrastructure:manageResendDomain": "true",
  "flowmark-infrastructure:resendDomainName": "flowmark.dev",
  "flowmark-infrastructure:vercelTeamId": "team_fixture",
  "resend:apiKey": "re_fixture_management",
  "vercel:apiToken": "fixture-vercel-management",
}

test("shared sending domain is opt-in and cannot be owned by nonprod", () => {
  configure({})
  assert.equal(manageResendDomain("production"), undefined)
  configure(config)
  assert.throws(() => manageResendDomain("nonprod"), /production stack/)
})

test("DNS mapping rejects unrelated hosts, duplicate records and root mail routing", () => {
  assert.equal(relativeRecordName("send.flowmark.dev.", "flowmark.dev"), "send")
  assert.equal(
    relativeRecordName("resend._domainkey", "flowmark.dev"),
    "resend._domainkey",
  )
  assert.throws(() => relativeRecordName("send.other.dev", "flowmark.dev"))
  assert.throws(() => selectVerificationRecord([], "dkim", "flowmark.dev"))
  assert.throws(() =>
    selectVerificationRecord([...records, records[0]], "dkim", "flowmark.dev"),
  )
  assert.throws(() =>
    selectVerificationRecord(
      [{ ...records[2], name: "flowmark.dev" }],
      "return-path",
      "flowmark.dev",
    ),
  )
  assert.throws(() =>
    selectVerificationRecord(
      [{ ...records[2], priority: undefined }],
      "return-path",
      "flowmark.dev",
    ),
  )
})

test("declares one EU sending domain and four sending DNS records with tracking disabled", async () => {
  configure(config)
  const result = manageResendDomain("production")!
  await new Promise<void>((resolve) =>
    pulumi.all(result.dns.map((record) => record.id)).apply(() => resolve()),
  )
  const domain = registered.find(
    (entry) => entry.type === "resend:index/domain:Domain",
  )!
  assert.equal(domain.inputs.name, "flowmark.dev")
  assert.equal(domain.inputs.region, "eu-west-1")
  assert.equal(domain.inputs.openTracking, false)
  assert.equal(domain.inputs.clickTracking, false)
  const dns = registered.filter((entry) => entry.type.includes("dnsRecord"))
  assert.equal(dns.length, 4)
  assert.deepEqual(dns.map((entry) => entry.inputs.name).sort(), [
    "resend._domainkey",
    "rsend",
    "send",
    "send",
  ])
  for (const record of dns) {
    assert.equal(record.inputs.domain, "flowmark.dev")
    assert.equal(record.inputs.teamId, "team_fixture")
    assert.equal(record.inputs.ttl, 300)
  }
  const mx = dns.find((entry) => entry.inputs.type === "MX")!
  assert.equal(mx.inputs.mxPriority, 10)
  assert.equal(mx.inputs.name, "send")
})
