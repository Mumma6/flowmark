# Local dependency capture experiment

The fixture asks why an invoice import completed after its primary provider
returned HTTP 429. Each lane runs the same import, falls back to a second
provider, and reports two imported invoices. The dependency paths use synthetic
query and authorization values so the measurement can check the wire output.

## Reproduce

Run these commands sequentially with workspace watchers stopped:

```sh
FLOWMARK_CAPTURE_BENCHMARK=1 pnpm --filter @flowmarkdev/node test:consumer
pnpm test:integration
```

The first command packs the SDK and exercises a separate Node consumer and a
Next.js production build over loopback. Each lane has one cold observation,
eight warmups and 128 measured calls with concurrency eight. Warm latency
covers the app callback and ends before the technical export and final SDK
drain. Node SDK delivery can overlap the callback.
Cold CLI time includes the drain. Cold Next time includes server startup,
readiness polling and the first response. RSS is sampled at callback completion.
The receiver checks wire bytes and confirms the two reported invoices in both
application results and SDK terminal events.

The second command uses the managed disposable PostgreSQL runner. It measures
eight bursts of eight same-run writes at initial histories of 8 and 96 steps.
It compares semantic-only writes with the same workload alongside a separate
in-memory decode of bounded technical records. It measures handler-to-receipt
latency and samples tagged pool lock occupancy with a 5 ms pause between
queries. It verifies the authorized run read and stored event count. Real
socket latency, per-transaction lock duration and technical SQL writes are
outside these measurements.

## What answered the question

| Lane                     | Evidence                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| SDK callback             | The run completed and the application reported two imports.                                                       |
| Explicit SDK operation   | The primary operation reported `RATE_LIMITED`. The run still completed.                                           |
| Curated capture          | The scope captured primary 429 and fallback 200. Parallel runs had separate records.                              |
| Existing trace reference | The SDK stored the trace and root span IDs. A separate OTLP/HTTP JSON fixture contained the two dependency spans. |

The curated fixture selects fixed dependency names, status and time to response
headers or an earlier transport error at source. It omits the synthetic query,
authorization header and response body
from exported telemetry. A third response exceeded the two-record budget and
produced a known drop. In the CLI, a 503 at the technical sink produced a known
delivery drop while the SDK workflow still completed. A missing record outside these
known outcomes leaves dependency behavior unknown.

The runtime checks cover Node fetch on the tested Undici version, and fetch
inside one Next.js App Router Node Route Handler with request-owned delivery.
An independent Node diagnostics subscriber stayed active during the comparison.
The trace lane uses a synthetic OTLP receiver. Stock Collector behavior,
third-party tracing SDK coexistence, core `http`, other clients and runtimes
remain unverified.

## Local measurements

One run on an Apple M1 Pro (10 logical cores, 32 GiB), using Node 24.15.0,
Undici 7.24.4, Next.js 16.4.2 and packed SDK 0.4.1.

| Runtime · lane       | Cold ms | Warm p95 ms | Warm p99 ms | Sampled peak RSS MiB | Max technical bytes/run |
| -------------------- | ------: | ----------: | ----------: | -------------------: | ----------------------: |
| Node · SDK           |  263.64 |        9.83 |       11.98 |               197.89 |                       0 |
| Node · operation     |  262.02 |       19.66 |       23.42 |               211.17 |                       0 |
| Node · curated       |  263.52 |        8.72 |       11.61 |               193.36 |                     198 |
| Node · trace fixture |  268.30 |        8.42 |       13.66 |               196.98 |                     921 |
| Next · SDK           |  355.12 |       14.78 |       15.73 |               221.16 |                       0 |
| Next · operation     |  351.38 |       22.28 |       22.70 |               227.14 |                       0 |
| Next · curated       |  347.24 |       15.71 |       18.90 |               216.28 |                     198 |
| Next · trace fixture |  353.36 |       16.98 |       18.50 |               232.42 |                     921 |

Provisional curated budgets relative to the SDK lane were +1 ms p95,
+3 ms p99, +16 MiB sampled peak RSS, and 256 bytes and two records per run.
The Next curated p99 was +3.17 ms in this run. Each healthy runtime received
256 curated records across its 128 measured calls. Timing and RSS are
directional local measurements. Hosted overhead and stock Collector
capacity require their own measurements.

The PostgreSQL 18 Alpine run received and read back every semantic event in
all four cases. The tagged pool reached seven waiting connections in each.

| Initial steps | Workload | Lock-positive samples/total | Receipt p95 ms | Receipt p99 ms | Persisted events |
| ------------: | -------- | --------------------------: | -------------: | -------------: | ---------------: |
|             8 | Semantic |                      68/125 |         148.45 |         162.74 |               74 |
|             8 | Mixed    |                      67/123 |         146.21 |         172.16 |               74 |
|            96 | Semantic |                      69/123 |         137.41 |         149.54 |              162 |
|            96 | Mixed    |                      67/120 |         122.70 |         125.40 |              162 |

These samples show same-run contention. Timing varied under shared integration
load. Isolating the effects of technical decode and history length would
require a dedicated load run.

## Delivery recommendation

Defer automatic capture. The existing SDK operation answers why the primary
failed. An existing trace can add the fallback status through the explicit
reference when the trace reader has access. Automatic capture added the fallback
response here. Revisit it if a case shows that this extra context materially
changes investigation and is impractical to record explicitly.

If capture is selected later, keep technical observations separate from
workflow lifecycle and business populations. Start with an explicit allowlist,
separate budgets and diagnostic expiry. Require a demonstrated erasure and
late-replay policy before persistence. A sampled, expired or never-observed
dependency stays unknown. Actual Collector compatibility and lifetime controls
need their own evidence.

[Undici diagnostics channels](https://github.com/nodejs/undici/blob/main/docs/docs/api/DiagnosticsChannel.md) ·
[OTLP JSON encoding](https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding) ·
[Explicit trace reference recipe](../../packages/sdk/examples/trace-context/README.md)
