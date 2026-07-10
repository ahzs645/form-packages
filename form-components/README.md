# @mois/form-components

MOIS UI component library used by the Webform app. It provides the controls, archetypes, dialogs, hooks, runtime scope helpers, and NHForms component loaders used by preview and export flows.

## Used by this app

The root app consumes this package through pnpm workspace aliases:

```typescript
import { buildScope } from "@mois/form-components/scope";
import { FormStateProvider } from "@mois/form-components";
import { nhformsComponents } from "@mois/form-components/nhforms";
```

Root `tsconfig.json` maps `@mois/form-components` and subpaths to `packages/form-components/src`, so app code imports source directly during development.

Run package validation from the repo root:

```bash
pnpm typecheck:packages
```

Or from this package:

```bash
pnpm typecheck
```

## NHForms loaders

NHForms supports both Next and Vite contexts.

| Export | Purpose |
| --- | --- |
| `@mois/form-components/nhforms` | Default NHForms entrypoint used by package consumers. |
| `@mois/form-components/nhforms/next` | Next-compatible loader backed by generated component source snapshots. |
| `@mois/form-components/nhforms/vite` | Vite-compatible loader using Vite source discovery conventions. |
| `@mois/form-components/nhforms/component-sources.generated` | Generated source snapshot used by Next/runtime packaging paths. |
| `@mois/form-components/nhforms/metadata` | Component metadata entrypoint. |

After changing NHForms component folders, exports, or generated source inputs, run:

```bash
pnpm generate:nhforms
pnpm test
```

Preview success in one loader path does not prove the other path is correct. Keep Next and Vite entrypoints aligned.

## Standalone usage

When copying this package to another project:

1. Copy all internal MOIS packages under `packages/`, not just this package.
2. Configure aliases for `@mois/form-components` and `@mois/form-engine-core`.
3. Install peer dependencies.
4. Choose the appropriate NHForms loader for your bundler.

## Peer dependencies

```json
{
  "react": "^18.0.0 || ^19.0.0",
  "react-dom": "^18.0.0 || ^19.0.0",
  "@fluentui/react": "^8.0.0",
  "@babel/standalone": "^7.0.0",
  "@milkdown/kit": "^7.0.0",
  "@milkdown/react": "^7.0.0",
  "immer": "^9.0.0 || ^10.0.0 || ^11.0.0",
  "react-markdown": "^9.0.0 || ^10.0.0"
}
```

## Main exports

- `/controls`: MOIS controls such as sections, text areas, and date controls.
- `/components`: MOIS components such as form/page structures and archetypes.
- `/archetypes`: Higher-level MOIS archetype components.
- `/dialogs`: Dialog components.
- `/hooks`: Runtime hooks such as source data and active data access.
- `/scope`: Scope-building utilities and MOIS namespace shims.
- `/nhforms`: NHForms component entrypoints.
