// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalFormStateProvider } from '../hooks/form-state';
import { SimpleCodeChecklist } from './SimpleCodeChecklist';

describe('SimpleCodeChecklist layout fidelity', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderChecklist(props: Partial<React.ComponentProps<typeof SimpleCodeChecklist>> = {}) {
    await act(async () => {
      root.render(
        <LocalFormStateProvider>
          <SimpleCodeChecklist
            fieldId="languages"
            label="Languages"
            selectionType="multiple"
            optionList={{ EN: 'English', FR: 'French', ES: 'Spanish', AR: 'Arabic' }}
            {...props}
          />
        </LocalFormStateProvider>
      );
    });
  }

  it('matches SMOIS responsive row wrapping when multiline is false', async () => {
    await renderChecklist({
      optionSize: 'small',
      containerProps: { 'data-testid': 'answers' },
      optionProps: { title: 'forwarded-option-props' },
    });

    const answers = container.querySelector('[data-testid="answers"]') as HTMLDivElement;
    expect(answers.style.display).toBe('flex');
    expect(answers.style.flexFlow).toBe('row wrap');
    expect(answers.querySelectorAll('[title="forwarded-option-props"]').length).toBeGreaterThanOrEqual(4);
  });

  it('supports fixed columns through the real SMOIS containerProps escape hatch', async () => {
    await renderChecklist({
      optionSize: 'min',
      containerProps: {
        'data-testid': 'answers',
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '8px 40px',
        },
      },
    });

    const answers = container.querySelector('[data-testid="answers"]') as HTMLDivElement;
    expect(answers.style.display).toBe('grid');
    expect(answers.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
  });

  it('keeps multiline choices in a single vertical column', async () => {
    await renderChecklist({ multiline: true, containerProps: { 'data-testid': 'answers' } });

    const answers = container.querySelector('[data-testid="answers"]') as HTMLDivElement;
    expect(answers.style.display).toBe('flex');
    expect(answers.style.flexFlow).toBe('column');
  });
});
