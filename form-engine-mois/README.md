# @mois/form-engine-mois

MOIS-specific runtime integration built on `@mois/form-engine-core`.

## Used by this app

The Webform app uses this package to construct MOIS-aware runtime scopes for preview, export simulation, and NHForms component loading.

Root `tsconfig.json` maps `@mois/form-engine-mois` to `packages/form-engine-mois/src`, so app and package code import source directly during development.

Validate from the repo root:

```bash
pnpm typecheck:packages
```

Or from this package:

```bash
pnpm typecheck
```

## Responsibilities

- Extend the core scope builder with MOIS hooks, namespaces, and components.
- Provide MOIS context types for source data, active data, option lists, user profile data, and form metadata.
- Bridge NHForms-loaded components into the MOIS runtime scope.

## Basic usage

```typescript
import * as Babel from "@babel/standalone";
import { createComponentFromCode } from "@mois/form-engine-core";
import { MoisScopeBuilder } from "@mois/form-engine-mois";

const scopeBuilder = new MoisScopeBuilder();

const Component = createComponentFromCode(
  `
  const [fd] = useActiveData();
  <Form>
    <TextArea label="Notes" fieldId="notes" />
  </Form>
  `,
  { babel: Babel, scopeBuilder }
);
```

## With NHForms components

```typescript
import { MoisScopeBuilder } from "@mois/form-engine-mois";
import { loadNHFormsComponents } from "@mois/form-engine-nhforms";

const scopeBuilder = new MoisScopeBuilder();
const { components } = loadNHFormsComponents(nhformsSources, {
  babel: Babel,
  scopeBuilder,
});

const extendedScopeBuilder = scopeBuilder.withNHFormsComponents(components);
```

## API highlights

- `MoisScopeBuilder`: MOIS-specific scope builder extending the core builder.
- `withHooks(hooks)`: Add MOIS/runtime hooks.
- `withNamespaces(namespaces)`: Add MOIS namespace shims such as functions and patient/entity helpers.
- `withComponents(components)`: Add MOIS components.
- `withNHFormsComponents(components)`: Add loaded NHForms components.
- `buildScope()`: Build the complete execution scope.

## Contributor notes

Some MOIS functions are simulated for preview. Keep simulation behavior clearly documented and verify exported package behavior separately from browser preview.
