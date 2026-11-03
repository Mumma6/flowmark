import * as pulumi from "@pulumi/pulumi"
import * as resend from "@pulumi/resend"
import * as vercel from "@pulumiverse/vercel"

interface VerificationRecord {
  readonly record: string
  readonly name: string
  readonly type: string
  readonly value: string
  readonly priority?: number
}

const verificationRecords = {
  dkim: { name: "resend._domainkey", record: "DKIM", types: ["TXT", "CNAME"] },
  spf: { name: "send", record: "SPF", types: ["TXT"] },
  "return-path": { name: "send", record: "SPF", types: ["MX"] },
  "secondary-return-path": { name: "rsend", record: "SPF", types: ["CNAME"] },
}
type VerificationKind = keyof typeof verificationRecords

// Resend can return relative or fully qualified names. Refuse unrelated names
// rather than accidentally adding the provider's domain twice at Vercel.
export const relativeRecordName = (name: string, domain: string) => {
  const normalized = name.replace(/\.$/, "")
  if (normalized === domain) {
    return ""
  }
  if (normalized.endsWith(`.${domain}`)) {
    return normalized.slice(0, -(domain.length + 1))
  }
  if (["resend._domainkey", "send", "rsend"].includes(normalized)) {
    return normalized
  }
  throw new pulumi.RunError(
    "Resend returned an unexpected verification hostname",
  )
}

export const selectVerificationRecord = (
  records: readonly VerificationRecord[],
  kind: VerificationKind,
  domain: string,
) => {
  const expected = verificationRecords[kind]
  const candidates = records.filter(
    (record) =>
      record.record === expected.record && expected.types.includes(record.type),
  )
  if (candidates.length !== 1) {
    throw new pulumi.RunError(
      `Expected exactly one Resend ${kind} verification record`,
    )
  }
  const record = candidates[0]
  const name = relativeRecordName(record.name, domain)
  if (name !== expected.name) {
    throw new pulumi.RunError(
      "Resend verification records must stay on the reviewed sending hosts",
    )
  }
  if (
    !record.value ||
    (kind === "return-path" &&
      (!Number.isInteger(record.priority) || record.priority! < 0))
  ) {
    throw new pulumi.RunError(
      "Resend returned an incomplete verification record",
    )
  }
  return { ...record, name }
}

// The shared sending domain and its DNS belong to production's shared resource
// ownership. This never deploys or changes the Production applications.
export const manageResendDomain = (stack: "nonprod" | "production") => {
  const config = new pulumi.Config()
  if (!config.getBoolean("manageResendDomain")) {
    return undefined
  }
  if (stack !== "production") {
    throw new pulumi.RunError(
      "The shared Resend domain belongs to the production stack",
    )
  }
  const domainName = config.require("resendDomainName", {
    pattern: /^flowmark\.dev$/,
  })
  const teamId = config.require("vercelTeamId", { pattern: /^team_/ })
  const resendProvider = new resend.Provider("resend-management", {
    apiKey: new pulumi.Config("resend").requireSecret("apiKey"),
  })
  const vercelProvider = new vercel.Provider("vercel-resend-dns", {
    team: teamId,
    apiToken: new pulumi.Config("vercel").requireSecret("apiToken"),
  })
  const domain = new resend.Domain(
    "flowmark-transactional-email",
    {
      name: domainName,
      region: "eu-west-1",
      openTracking: false,
      clickTracking: false,
    },
    {
      provider: resendProvider,
      protect: true,
      ...(config.get("resendDomainId")
        ? { import: config.require("resendDomainId") }
        : {}),
    },
  )

  // Four fixed resources are visible in preview before domain creation. Only
  // their properties depend on computed outputs; no resources inside apply.
  const dns = (Object.keys(verificationRecords) as VerificationKind[]).map(
    (kind) => {
      const expected = verificationRecords[kind]
      const record = domain.records.apply((records) =>
        selectVerificationRecord(records, kind, domainName),
      )
      return new vercel.DnsRecord(
        `resend-${kind}`,
        {
          domain: domainName,
          teamId,
          name: expected.name,
          type: expected.types.length === 1 ? expected.types[0] : record.type,
          value: record.value,
          ...(kind === "return-path"
            ? { mxPriority: record.apply((value) => value.priority!) }
            : {}),
          ttl: 300,
          comment:
            "Flowmark transactional email: Resend sending verification only",
        },
        { provider: vercelProvider, protect: true },
      )
    },
  )
  return { domain, dns, provider: resendProvider }
}
