# @mois/form-engine-core

Generic runtime engine for transforming JSX/TSX strings into React components and executing them with an injected scope.

## Used by this app

The Webform app uses this package indirectly through MOIS preview, NHForms loading, and export simulation paths. It is the lowest-level package in the runtime stack:

```text
app preview/export
  -> @mois/form-components
  -> @mois/form-engine-mois
  -> @mois/form-engine-nhforms
  -> @mois/form-engine-core
```

Root `tsconfig.json` maps `@mois/form-engine-core` to `packages/form-engine-core/src`, so app and package code import source directly during development.

Validate from the repo root:

```bash
pnpm typecheck:packages
```

Or from this package:

```bash
pnpm typecheck
```

## Core responsibilities

- Transform runtime JSX with Babel standalone.
- Build and extend execution scopes.
- Provide form-state primitives.
- Provide preview/error-boundary runtime helpers.

## Basic usage

```typescript
import * as Babel from "@babel/standalone";
import { BaseScopeBuilder, createComponentFromCode } from "@mois/form-engine-core";

const scopeBuilder = new BaseScopeBuilder({
  components: {
    MyInput: (props) => <input {...props} />,
  },
  hooks: {
    useMyData: () => ({ value: "example" }),
  },
});

const Component = createComponentFromCode("<MyInput />", {
  babel: Babel,
  scopeBuilder,
});
```

## Form state

```typescript
import {
  BaseScopeBuilder,
  createComponentFromCode,
  initFormData,
  useActiveDataForForms,
} from "@mois/form-engine-core";

initFormData();

const scopeBuilder = new BaseScopeBuilder({
  hooks: {
    useActiveData: useActiveDataForForms,
  },
});

const Component = createComponentFromCode(
  `
  const [fd, setFd] = useActiveData();
  <input
    value={fd.field.data.name || ""}
    onChange={(event) => setFd({ field: { data: { name: event.target.value } } })}
  />
  `,
  { babel: Babel, scopeBuilder }
);
```

## Public API highlights

- `createComponentFromCode(code, options)`: Transform JSX/TSX source into a React component.
- `BaseScopeBuilder`: Compose components, hooks, namespaces, and values into an execution scope.
- `useActiveDataForForms(selector?)`: Access runtime form data.
- `initFormData()`: Reset runtime form data.
- `ErrorBoundary`: React error boundary for runtime rendering.
- `LivePreview`: Preview component for compiled JSX.

## Notes for contributors

Runtime JSX is not normal ESM. Code executed through this package must rely on injected scope symbols. When adding behavior, verify both preview and exported package paths.
