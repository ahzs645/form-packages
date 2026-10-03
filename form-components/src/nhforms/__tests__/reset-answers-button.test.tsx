// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as Babel from '@babel/standalone';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { produce } from 'immer';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const source = Babel.transform(readFileSync('packages/form-components/src/nhforms/ResetAnswersButton/index.jsx', 'utf8'), { presets: ['react'] }).code;
describe('source-form reset', () => {
  it.each([false, true])('restores only declared answers and respects a signed record (signed=%s)', signed => {
    let state = { field: { data: { name: 'Old name', check: true, unrelated: 'keep' }, status: { name: 'error', unrelated: 'keep' } }, patient: { name: 'Chart name' } };
    const Component = new Function('React', 'Fluent', 'useActiveData', 'useSourceData', 'produce', `${source}; return ResetAnswersButton;`)(React, { DefaultButton: ({ text, disabled, onClick }: { text: string; disabled: boolean; onClick: () => void }) => React.createElement('button', { disabled, onClick }, text) }, () => [state, (update: (s: typeof state) => typeof state) => { state = update(state); }], () => ({ webform: { recordState: signed ? 'SIGNED' : 'DRAFT' } }), produce);
    const element = document.createElement('div');
    document.body.appendChild(element);
    const root = createRoot(element);
    act(() => root.render(React.createElement(Component, { answers: { name: '', check: false } })));
    act(() => element.querySelector('button')!.click());
    expect(state.field.data.name).toBe(signed ? 'Old name' : '');
    expect(state.field.data.check).toBe(signed);
    expect(state.field.data.unrelated).toBe('keep');
    expect(state.patient.name).toBe('Chart name');
    expect(state.field.status.unrelated).toBe('keep');
    act(() => root.unmount());
    element.remove();
  });
});
