# @mois/form-components

Complete MOIS UI components library for rendering web forms. This package bundles all the controls, components, hooks, and NHForms components needed to render MOIS forms.

## Installation

When using within the monorepo, the package is available through npm workspaces.

When copying to another project, you'll need to:

1. Copy the entire `packages/` directory
2. Configure your bundler (Vite, webpack, etc.) to resolve the `@styleguide` alias to the styleguide `src/` folder
3. Install peer dependencies

## Peer Dependencies

```json
{
  "react": "^18.0.0",
  "react-dom": "^18.0.0",
  "@fluentui/react": "^8.0.0",
  "@babel/standalone": "^7.0.0",
  "immer": "^9.0.0 || ^10.0.0 || ^11.0.0"
}
```

## Usage

### Basic Form Rendering

```typescript
import React from 'react';
import * as Babel from '@babel/standalone';
import { createComponentFromCode } from '@mois/form-engine-core';
import { buildScope, FormStateProvider } from '@mois/form-components';

function FormRenderer({ formCode }) {
  // Build the complete scope with all MOIS components
  const scope = buildScope();

  // Create a form component from JSX code
  const FormComponent = createComponentFromCode(formCode, {
    babel: Babel,
    scope,
  });

  // Render with state management
  return (
    <FormStateProvider>
      <FormComponent />
    </FormStateProvider>
  );
}
```

### Importing Specific Components

```typescript
// Import specific controls
import { Section, TextArea, DateSelect } from '@mois/form-components/controls';

// Import specific components
import { Form, NameBlock, Page } from '@mois/form-components/components';

// Import hooks
import { useSourceData, useActiveData, useCodeList } from '@mois/form-components/hooks';

// Import scope utilities
import { buildScope, FluentNamespace, MoisFunction } from '@mois/form-components/scope';

// Import NHForms components
import { nhformsComponents, Allergies, Conditions } from '@mois/form-components/nhforms';
```

## Vite Configuration

When using in a Vite project, configure the aliases in `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@mois/form-components': path.resolve(__dirname, 'packages/form-components/src'),
      '@mois/form-engine-core': path.resolve(__dirname, 'packages/form-engine-core/src'),
      '@styleguide': path.resolve(__dirname, 'src'),  // Points to styleguide src/
    },
  },
});
```

## Package Exports

- **`/controls`** - All MOIS controls (Section, TextArea, DateSelect, etc.)
- **`/components`** - All MOIS components (Form, NameBlock, Page, archetypes, etc.)
- **`/hooks`** - All hooks (useSourceData, useActiveData, useCodeList, etc.)
- **`/scope`** - Scope building utilities (buildScope, FluentNamespace, etc.)
- **`/nhforms`** - NHForms components (dynamically loaded at build time)

## Note on NHForms Components

The NHForms components use Vite's `import.meta.glob` for dynamic loading at build time. They require a Vite build environment to function properly. The raw JSX files are located in `src/nhforms-components/` and are compiled during the build process.
