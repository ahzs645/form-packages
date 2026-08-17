// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalFormStateProvider } from '../hooks/form-state';
import { SimpleCodeSelect } from './SimpleCodeSelect';

function collectCssRules(): string[] {
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) rules.push(rule.cssText);
    } catch {
      /* unsupported sheet */
    }
  }
  return rules;
}

describe('SimpleCodeSelect required affordances', () => {
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

  it('renders the asterisk and warning tint while a required dropdown is empty', async () => {
    await act(async () => {
      root.render(
        <LocalFormStateProvider>
          <SimpleCodeSelect
            fieldId="mood"
            label="Mood"
            selectionType="single"
            optionList={{ A: 'Calm', B: 'Anxious' }}
            required
          />
        </LocalFormStateProvider>
      );
    });

    const rules = collectCssRules();
    const label = container.querySelector('label');
    expect(label).toBeTruthy();
    const labelClasses = (label?.className || '').split(/\s+/).filter(Boolean);
    // Fluent renders the red star as a ::after rule on the label class.
    const hasAsteriskRule = rules.some(
      (rule) => labelClasses.some((cls) => rule.startsWith(`.${cls}::after`)) && rule.includes("' *'")
    );
    expect(hasAsteriskRule).toBe(true);

    // Native MOIS parity: the empty required field body gets the warning tint.
    const titleEl = container.querySelector('.ms-Dropdown-title') as HTMLElement;
    const titleClasses = (titleEl?.className || '').split(/\s+/).filter(Boolean);
    const hasTintRule = rules.some(
      (rule) =>
        titleClasses.some((cls) => rule.startsWith(`.${cls}`)) &&
        /background-color:\s*#FFF4CE/i.test(rule)
    );
    expect(hasTintRule).toBe(true);
  });
});
