# @mois/form-engine-nhforms

NHForms component loader with two-pass loading for cross-referenced runtime components.

## Used by this app

The Webform app uses NHForms components through `@mois/form-components/nhforms` entrypoints. This package provides the lower-level loader used by those entrypoints and by runtime package tests.

Root `tsconfig.json` maps `@mois/form-engine-nhforms` to `packages/form-engine-nhforms/src`, so app and package code import source directly during development.

Validate from the repo root:

```bash
pnpm typecheck:packages
```

Or from this package:

```bash
pnpm typecheck
```

## Loader model

The loader accepts component source records, transforms them with Babel, and registers components in two passes so components can reference each other.

It returns:

- `components`: Loaded React components by name.
- `errors`: Per-component load failures.
- `metadata`: Component identity metadata.

## Next and Vite paths

Most app code should import NHForms through `@mois/form-components`, not this package directly.

| Context | Preferred path |
| --- | --- |
| Next app/runtime packaging | `@mois/form-components/nhforms/next` or generated component source snapshots. |
| Vite consumers | `@mois/form-components/nhforms/vite`. |
| Low-level custom loader | `@mois/form-engine-nhforms`. |

The Next path relies on generated source snapshots. The Vite path can use glob/raw import conventions. Keep both paths aligned when adding or changing NHForms components.

## Basic usage

```typescript
import * as Babel from "@babel/standalone";
import { MoisScopeBuilder } from "@mois/form-engine-mois";
import { loadNHFormsComponents } from "@mois/form-engine-nhforms";

const sources = [
  {
    name: "Scale5",
    code: `
      const Scale5 = ({ value, onChange }) => (
        <Fluent.ChoiceGroup
          options={[
            { key: "0", text: "0" },
            { key: "1", text: "1" },
            { key: "2", text: "2" },
            { key: "3", text: "3" },
            { key: "4", text: "4" },
          ]}
          selectedKey={value}
          onChange={(_, option) => onChange?.(option?.key)}
        />
      );
    `,
    identity: {
      name: "Scale5",
      title: "Scale 5",
    },
  },
];

const scopeBuilder = new MoisScopeBuilder();
const { components, errors, metadata } = loadNHFormsComponents(sources, {
  babel: Babel,
  scopeBuilder,
});
```

## API highlights

- `loadNHFormsComponents(sources, config)`: Load multiple components with two-pass cross-reference support.
- `loadSingleComponent(source, config)`: Load one component.
- `getRegistry()`: Read the global component registry.
- `clearRegistry()`: Clear the registry, useful for hot reload and tests.

## Contributor notes

After changing NHForms source inputs, run:

```bash
pnpm generate:nhforms
pnpm test
```

Preview success in one bundler path is not enough. Verify the Next-compatible generated source path and the Vite path when loader behavior changes.
