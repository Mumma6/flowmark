---
name: flowmark-ui-components
description: "Use when building or changing Flowmark web, dashboard, docs, or other frontend UI. Prefer shadcn/ui components through the shared @flowmark/ui package; add reusable shadcn-based primitives there instead of duplicating them in apps."
---

# Flowmark UI Components

Build consistent, accessible Flowmark interfaces by reusing shadcn-style
components from the shared `@flowmark/ui` package.

## When to Use

- Creating or editing a web page, dashboard, form, dialog, navigation, or other
  frontend interaction in this repository.
- Choosing between an existing shared component and app-local markup.
- Adding a reusable UI component or reviewing UI consistency.

## Procedure

1. **Inspect before building.** Read the target app's neighboring components,
   `packages/ui/src/index.tsx`, and the relevant source component. Check
   `packages/ui/components.json` for the shadcn configuration.
2. **Prefer the shared package.** Import available controls and primitives
   from `@flowmark/ui`; do not import their source files by relative path or
   copy a second implementation into an app.
3. **Extend the shared package when needed.** If a shadcn component is missing
   and more than one surface could use it, add it under `packages/ui/src`,
   export it from `packages/ui/src/index.tsx`, and consume it through
   `@flowmark/ui`. Follow the configured shadcn style and existing `cn`, theme,
   accessibility, and dependency patterns. Prefer the shadcn CLI or the
   repository's configured component workflow when available.
4. **Keep app-specific UI app-specific.** A one-off product illustration,
   domain visualization, page layout, or composition belongs in its app.
   Reuse shared primitives inside it where appropriate; do not turn every
   semantic `article`, `section`, or static text block into a Card component.
5. **Avoid unnecessary dependencies and abstractions.** Do not add another UI
   kit, duplicate a component already provided by `@flowmark/ui`, or introduce
   a wrapper that adds no Flowmark-specific behavior.
6. **Preserve behavior and accessibility.** Use semantic HTML, keyboard
   interaction, visible focus, labels, and appropriate loading/empty/error
   states. Preserve the current app's tokens and responsive conventions.
   Use Tailwind utilities, not app-specific CSS classes, CSS modules, or inline
   layout styles. Global CSS is for theme variables and Tailwind directives.
7. **Validate the affected surface.** Run the narrow app and shared-package
   lint/typecheck/tests as applicable. For visual changes, inspect desktop and
   mobile layouts in the browser when available.

## Source of truth

Inspect `packages/ui/src/index.tsx` for current exports rather than maintaining
a duplicate component inventory here. Reuse the shared `FlowmarkMark` for the
brand icon, including the established accent dot in wordmarks.

Check each app's Tailwind version and shared components' actual state attributes.
The dashboard/harness use Tailwind 3 while landing/docs use Tailwind 4.
