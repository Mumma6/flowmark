# Licensing

Copyright 2026 Martin Persson, except where third-party notices apply.

## Scope

The root [LICENSE](../LICENSE) applies to first-party platform code unless a
more specific license below applies. Directory licenses cover their entire
subtree; documentation exceptions cover documentation and its embedded examples,
not the platform implementation those examples may import.

| Material                                                                                                                                                       | License                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/core` (`@flowmarkdev/core`)                                                                                                                          | [Apache-2.0](../packages/core/LICENSE)                                                |
| `packages/sdk` (`@flowmarkdev/node`), including all published entry points                                                                                     | [Apache-2.0](../packages/sdk/LICENSE)                                                 |
| `examples`                                                                                                                                                     | [Apache-2.0](../examples/LICENSE)                                                     |
| `docs`, `apps/docs/content`, and other first-party Markdown/MDX documentation, including root and package READMEs                                              | [Apache-2.0](./LICENSE)                                                               |
| All other first-party code: API, auth, database, MCP, engine adapter and Rust crate, UI, evidence views, email, demo, config, apps, scripts and infrastructure | [FSL-1.1-ALv2](../LICENSE)                                                            |
| Third-party code and assets                                                                                                                                    | Their respective upstream terms; see [third-party notices](../THIRD_PARTY_NOTICES.md) |

## SDK and hosted use

Both public npm packages are Apache-2.0. They can be used in personal,
commercial, enterprise and open-source applications, subject to Apache's notice
and other requirements. `@flowmarkdev/node` depends on `@flowmarkdev/core` and
MIT-licensed Effect; its optional Next.js peer is MIT-licensed. Neither public
package depends on FSL platform code. Internal build configuration is not shipped
as an SDK runtime dependency. Examples do not relicense their dependencies.

Using Flowmark's hosted service or sending it telemetry does not require making
your application's source available or licensing it under FSL. Source licenses
do not replace the hosted service's terms.

## Public platform source

The repository remains publicly inspectable. You can study its architecture,
learn from its implementation, and contribute through the normal GitHub workflow.
The platform is **source-available**, not OSI-approved open source. FSL permits
internal use, non-commercial education and research, and other permitted purposes;
it restricts making the software available in competing commercial products or
services as defined in the license. It does not prohibit every commercial use.

For each version made available under FSL, an additional Apache-2.0 license takes
effect on the second anniversary of the date that version was made available.
This happens separately for each version, including public commits; it is not a
single date on which all future platform versions become Apache-licensed. See the
[official FSL explanation](https://fsl.software/). The license text governs.

## Transition and branding

Previously distributed MIT versions, including npm SDK versions through 0.3.0,
retain their existing MIT permissions. This transition does not revoke those
rights or restrict reuse of those versions. Apache SDK metadata in this checkout
applies to future releases; existing npm artifacts are unchanged. Older MIT code
and platform versions that reach their Apache future-license date can still be
used commercially under those licenses.

Code and documentation licenses do not grant general trademark rights to the
Flowmark name, logo or branding, or permission to imply endorsement. The
licenses' provisions for identifying origin still apply. No separate trademark
policy or commercial feature restrictions are introduced.
