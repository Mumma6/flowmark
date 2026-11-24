# Sample payments

A small synthetic payment service with its own SQLite file. It is a stand-in for someone else's application: a request is stored, a provider answers later, and the service decides whether that answer belongs to the same change. It is not deployed, and it does not seed Flowmark.

Two confirmation revisions live in the source:

- `src/confirm-linked.ts` confirms a payment only when the provider names the same change.
- `src/confirm-unlinked.ts` records the provider receipt without that link. Its happy path still confirms the payment.

Set `PAYMENT_CONFIRMATION=unlinked` to run the second revision. The default is `linked`.

## Run on loopback

From the repository root:

```bash
pnpm --filter @flowmark/sample-payments start
```

The process listens on `127.0.0.1:3099`. The SQLite file is under the system temp directory unless `SAMPLE_PAYMENTS_DB` is set.

```bash
curl -s http://127.0.0.1:3099/health
curl -s -X POST http://127.0.0.1:3099/payments \
  -H 'content-type: application/json' \
  -d '{"amountCents":1250,"provider":"same"}'
```

`provider` is `same`, `other`, `missing`, `none`, `late`, or `fail`. Amounts and provider responses are synthetic. There is no real payment provider.

Leave `FLOWMARK_API_KEY` unset. The service still confirms payments, and `/health` reports `flowmarkBinding: "unconfigured"`. A complete local key plus `FLOWMARK_BINDING_ID`, `FLOWMARK_DEPLOYMENT_ID`, `FLOWMARK_ARTIFACT_DIGEST`, and `FLOWMARK_PROBE_ID` opts into the public SDK. Do not point those values at a hosted project from this sample.
