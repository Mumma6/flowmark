# Dashboard review screenshots

Captured on 29 October 2026 from the running local dashboard for PR #18.
All workflow/run content uses existing synthetic fixtures. These images show the
UI implementation, not production data or evidence of business correctness.

Desktop captures use a 1440 × 1000 viewport; mobile captures use 390 × 844.
Most images include the full page. Account is shown as a header and form detail
with a shorter viewport, omitting the local-only demo credential banner.
Ingestion-key images show stored prefixes only, never key secrets. No credentials
were created, rotated or revoked to prepare these images.

Coverage:

- Overview: dark/light, mobile and empty project.
- Workflows: directory and workflow detail.
- Runs: full history on desktop and mobile.
- Run detail: reported result, waterfall, event table, context, comparison,
  explicit related runs and a reported failure on desktop/mobile.
- Settings: Projects, Ingestion keys, Setup help and Account.
- Mobile navigation.

These are all dashboard routes changed by this redesign. Authentication and
onboarding flows are outside this visual change and are not represented as new
screens. The gallery in the PR description embeds these files at their immutable
asset commit so it remains stable as the feature branch changes.
