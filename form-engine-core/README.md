# @mois/form-engine-core

Generic form rendering engine with JSX transformation and state management.

## Installation

```bash
npm install @mois/form-engine-core
```

## Peer Dependencies

- `react` ^18.0.0
- `@babel/standalone` ^7.0.0
- `immer` ^9.0.0 || ^10.0.0 || ^11.0.0

## Usage

### Basic Usage with Custom Scope

```typescript
import { createComponentFromCode, BaseScopeBuilder } from '@mois/form-engine-core';
import * as Babel from '@babel/standalone';

// Create a scope builder with your components
const scopeBuilder = new BaseScopeBuilder({
  components: {
    MyButton: (props) => <button {...props} />,
    MyInput: (props) => <input {...props} />,
  },
  hooks: {
    useMyData: () => ({ data: 'example' }),
  },
});

// Transform JSX code to a React component
const code = `<MyButton onClick={() => alert('Hello!')}>Click me</MyButton>`;

const Component = createComponentFromCode(code, {
  babel: Babel,
  scopeBuilder,
});

// Render the component
function App() {
  return <Component />;
}
```

### With Form State Management

```typescript
import {
  createComponentFromCode,
  BaseScopeBuilder,
  useActiveDataForForms,
  initFormData,
} from '@mois/form-engine-core';

// Add form hooks to your scope
const scopeBuilder = new BaseScopeBuilder({
  hooks: {
    useActiveData: useActiveDataForForms,
  },
});

// Reset form state before loading new form
initFormData();

const formCode = `
const [fd, setFd] = useActiveData();
<div>
  <input
    value={fd.field.data.name || ''}
    onChange={(e) => setFd({ field: { data: { name: e.target.value } } })}
  />
</div>
`;

const FormComponent = createComponentFromCode(formCode, {
  babel: Babel,
  scopeBuilder,
});
```

### Extending the Scope Builder

```typescript
import { BaseScopeBuilder } from '@mois/form-engine-core';

class MyAppScopeBuilder extends BaseScopeBuilder {
  constructor() {
    super({
      components: {
        // Your app's components
      },
      hooks: {
        // Your app's hooks
      },
      namespaces: {
        // Your app's namespaces
      },
    });
  }
}
```

## API Reference

### `createComponentFromCode(code, options)`

Transforms JSX/TSX code into a React component.

- `code`: string - The JSX/TSX code to transform
- `options.babel`: any - Babel standalone instance
- `options.scopeBuilder`: ScopeBuilder - Scope builder for execution context
- `options.onInitialData?`: (data) => void - Callback when InitialData is extracted

### `BaseScopeBuilder`

Extensible scope builder class.

- `constructor(config?)` - Create with optional configuration
- `buildScope()` - Build the complete scope object
- `extend(config)` - Create extended builder with additional config
- `getConfig()` - Get current configuration

### `useActiveDataForForms(selector?)`

Hook for form state management.

Returns `[formData, setFormData]` tuple.

### `initFormData()`

Reset form data to initial state.

### `ErrorBoundary`

React error boundary component.

### `LivePreview`

Component for rendering compiled JSX with error handling.
