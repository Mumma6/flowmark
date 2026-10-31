# @flowmarkdev/core

Shared workflow event contracts for Flowmark.

Application code should install
[`@flowmarkdev/node`](https://www.npmjs.com/package/@flowmarkdev/node). This
package is published so the SDK can depend on a normal registry version of the
telemetry envelope the API accepts.

```bash
npm i @flowmarkdev/node
```

Docs: [docs.flowmark.dev](https://docs.flowmark.dev)

The published package is 0.2.0 and uses Effect 4.1.0. Exported schemas require
the v4 Schema API; for example, use `Schema.decodeUnknownEffect(schema)` and
`typeof schema.Type`. Telemetry JSON contracts are unchanged. Upgrade
`@flowmarkdev/core` and `@flowmarkdev/node` together. Do not depend on Effect
v3 error internals.
