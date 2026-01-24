# @mois/form-engine-nhforms

NHForms component loader with two-pass loading for cross-references.

## Installation

```bash
npm install @mois/form-engine-nhforms @mois/form-engine-mois @mois/form-engine-core
```

## Overview

This package provides a component loader specifically designed for NHForms components. It features:

- **Two-pass loading**: Components can reference each other
- **Global registry**: Loaded components are available for cross-references
- **Error handling**: Individual component failures don't break the entire load

## Usage

### Loading Components

```typescript
import { loadNHFormsComponents } from '@mois/form-engine-nhforms';
import { MoisScopeBuilder } from '@mois/form-engine-mois';
import * as Babel from '@babel/standalone';

// Component sources (typically loaded from files)
const sources = [
  {
    name: 'Scale5',
    code: `
      const Scale5 = ({ value, onChange }) => (
        <Fluent.ChoiceGroup
          options={[
            { key: '0', text: '0' },
            { key: '1', text: '1' },
            { key: '2', text: '2' },
            { key: '3', text: '3' },
            { key: '4', text: '4' },
          ]}
          selectedKey={value}
          onChange={(_, o) => onChange?.(o?.key)}
        />
      );
    `,
    identity: {
      name: 'Scale5',
      title: 'Scale 5',
      description: 'A 0-4 scale selection component',
    },
  },
  {
    name: 'HonosQuestion',
    code: `
      // This component uses Scale5 from the registry
      const HonosQuestion = ({ label, fieldId }) => {
        const [fd, setFd] = useActiveData();
        return (
          <Fluent.Stack>
            <Fluent.Label>{label}</Fluent.Label>
            <Scale5
              value={fd.field.data[fieldId]}
              onChange={(v) => setFd({ field: { data: { [fieldId]: v } } })}
            />
          </Fluent.Stack>
        );
      };
    `,
    identity: {
      name: 'HonosQuestion',
      title: 'HoNOS Question',
      components: ['Scale5'],
    },
  },
];

// Load components
const scopeBuilder = new MoisScopeBuilder().withHooks({
  useActiveData: useActiveDataForForms,
});

const { components, errors, metadata } = loadNHFormsComponents(sources, {
  babel: Babel,
  scopeBuilder,
});

if (errors.length > 0) {
  console.warn('Some components failed to load:', errors);
}

// Use components in your form scope
const extendedScope = scopeBuilder.withNHFormsComponents(components);
```

### Loading from Files (Vite Example)

```typescript
import { loadNHFormsComponents } from '@mois/form-engine-nhforms';

// Use Vite's glob import to discover components
const identityModules = import.meta.glob('./components/**/Identity.json', { eager: true });
const codeModules = import.meta.glob('./components/**/index.jsx', { eager: true, query: '?raw' });

// Build sources array
const sources = Object.keys(identityModules).map(path => {
  const name = path.split('/')[2]; // Extract folder name
  const codePath = path.replace('Identity.json', 'index.jsx');
  return {
    name,
    code: (codeModules[codePath] as any).default,
    identity: (identityModules[path] as any).default,
  };
});

const { components } = loadNHFormsComponents(sources, config);
```

### Accessing the Registry

```typescript
import { getRegistry, clearRegistry } from '@mois/form-engine-nhforms';

// Get all loaded components
const allComponents = getRegistry();

// Clear the registry (useful for hot reload)
clearRegistry();
```

## API Reference

### `loadNHFormsComponents(sources, config)`

Load multiple components with two-pass loading.

Parameters:
- `sources`: ComponentSource[] - Array of component sources
- `config.babel`: any - Babel instance
- `config.scopeBuilder`: ScopeBuilder - Scope builder
- `config.enableCrossReferences?`: boolean - Enable two-pass loading (default: true)
- `config.additionalScope?`: Record<string, any> - Extra scope items

Returns:
- `components`: Record<string, any> - Loaded components
- `errors`: Array<{ name, error }> - Loading errors
- `metadata`: Record<string, ComponentIdentity> - Component metadata

### `loadSingleComponent(source, config)`

Load a single component.

### `getRegistry()`

Get the global component registry.

### `clearRegistry()`

Clear the global component registry.

## Types

```typescript
interface ComponentSource {
  name: string;
  code: string;
  identity?: ComponentIdentity;
}

interface ComponentIdentity {
  name: string;
  title: string;
  description?: string;
  version?: { major: number; minor: number; patch: number };
  components?: string[]; // Dependencies
}
```
