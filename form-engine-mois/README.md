# @mois/form-engine-mois

MOIS-specific form components, hooks, and scope builder for rendering MOIS web forms.

## Installation

```bash
npm install @mois/form-engine-mois @mois/form-engine-core
```

## Peer Dependencies

- `react` ^18.0.0
- `@fluentui/react` ^8.0.0
- `@mois/form-engine-core` ^1.0.0
- `immer` ^9.0.0 || ^10.0.0 || ^11.0.0

## Usage

### Basic Form Rendering

```typescript
import { MoisScopeBuilder, createComponentFromCode } from '@mois/form-engine-mois';
import * as Babel from '@babel/standalone';

// Create MOIS scope builder
const scopeBuilder = new MoisScopeBuilder();

// Load your form code (from file or API)
const formCode = `
const FormComponent = () => {
  const [fd] = useActiveData();
  return (
    <Form>
      <Header title="My Form" />
      <TextArea label="Notes" fieldId="notes" />
      <Footer>
        <SubmitButton />
      </Footer>
    </Form>
  );
};
`;

// Transform to React component
const FormComponent = createComponentFromCode(formCode, {
  babel: Babel,
  scopeBuilder,
});

// Render with your provider
function App() {
  return (
    <YourMoisProvider sourceData={patientData}>
      <FormComponent />
    </YourMoisProvider>
  );
}
```

### Configuring with MOIS Hooks and Components

The `MoisScopeBuilder` provides a fluent API to configure your scope:

```typescript
import { MoisScopeBuilder } from '@mois/form-engine-mois';

// Import your MOIS hooks and components
import { useSourceData, useActiveData, useCodeList } from './your-mois-context';
import { Header, Footer, TextArea, SimpleCodeSelect } from './your-controls';
import { MoisFunction, Pe } from './your-namespaces';

const scopeBuilder = new MoisScopeBuilder()
  .withHooks({
    useSourceData,
    useActiveData,
    useCodeList,
    useSection: () => ({ sectionNum: 0, layout: 'flex' }),
    useTheme: () => ({ tokens: {} }),
  })
  .withNamespaces({
    MoisFunction,
    Pe,
  })
  .withComponents({
    Header,
    Footer,
    TextArea,
    SimpleCodeSelect,
    // ... other components
  });
```

### With NHForms Components

```typescript
import { MoisScopeBuilder } from '@mois/form-engine-mois';
import { loadNHFormsComponents } from '@mois/form-engine-nhforms';

// Load NHForms components
const { components } = loadNHFormsComponents(nhformsSources, {
  babel: Babel,
  scopeBuilder: new MoisScopeBuilder(),
});

// Add to scope
const scopeBuilder = new MoisScopeBuilder()
  .withNHFormsComponents(components);
```

## API Reference

### `MoisScopeBuilder`

MOIS-specific scope builder extending `BaseScopeBuilder`.

```typescript
new MoisScopeBuilder(options?)
```

Options:
- `additionalComponents?`: Record<string, any> - Extra components
- `nhformsComponents?`: Record<string, any> - NHForms components
- `identity?`: { title, name, ... } - Form identity metadata

Methods:
- `withHooks(hooks)` - Configure MOIS hooks
- `withNamespaces(namespaces)` - Configure MOIS namespaces
- `withComponents(components)` - Add MOIS components
- `withNHFormsComponents(components)` - Add NHForms components
- `buildScope()` - Build complete scope object

### Types

```typescript
interface MoisSourceData {
  patient?: PatientData;
  encounter?: EncounterData;
  webform?: WebformData;
  formParams?: Record<string, any>;
  optionLists?: Record<string, CodeListItem[]>;
  userProfile?: UserProfileData;
  // ...
}
```
