# @webforms/form-model

UI-independent authoring contracts shared by the Webforms builder, persistence
codecs, previews, and exporters.

This package owns:

- builder field, workflow, design, document, and variant types;
- the canonical field-type definitions used by palettes and default factories;
- runtime schemas for validating persisted builder data;
- the shared field-link condition evaluator.

It must not import from the root app, `components/`, or `lib/`. The root
`pnpm check:architecture` command enforces that boundary.

Run validation from the repository root:

```bash
pnpm lint:form-model
pnpm typecheck:packages
pnpm vitest run packages/form-model/src/conditions.test.ts
```
