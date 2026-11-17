---
name: readme
description: Write or simplify Flowmark repository and package READMEs as short, clear entry points. Use when creating or editing a README, including npm package landing text.
---

# README writing

A README helps its intended reader understand the project and take the first
useful step. Keep it short enough to scan. Put detailed guides and reference
material behind direct links.

For a public package, normally include a brief purpose, installation, minimal
configuration, one practical example, documentation links and the license.
For the repository, explain the product and route readers to setup and contribution
instructions. Adapt to the reader; do not force every README into one template.

- Describe the current usable product. Keep old-version comparisons, legacy
  behavior, release plans and unreleased feature descriptions in release notes,
  migration guides or contributor documentation.
- Explain dependencies only when the reader must act on them. Omit transitive
  package inventories, internal framework versions, implementation details and
  instructions to install dependencies the package manager already supplies.
- Show the easiest supported path. Preserve essential credential and lifecycle
  instructions; link alternate runtimes and advanced options rather than
  duplicating their guides.
- Use concrete, small examples with meaningful results. Avoid an API catalog,
  long feature lists, repeated explanations or speculative warnings.
- Do not shorten text into an inaccurate claim. Keep necessary runtime requirements
  or compatibility constraints where they affect installation; place detailed
  compatibility history elsewhere.

Before finishing, remove any paragraph that does not help the reader begin or
find the next relevant guide. Check examples and links. For npm, inspect the
packed README: changing repository source does not replace a README embedded in
an already published version. Publication follows the separate release workflow.
