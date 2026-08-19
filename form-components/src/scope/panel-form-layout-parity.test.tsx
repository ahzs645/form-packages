// @vitest-environment happy-dom
/**
 * Layout parity for bare fields under <Form> (repro: test_panel_form-0.1.1,
 * "TEST: Observation panel create and update").
 *
 * The engine's DEFAULT section layout is 'linear' (verbatim in the SMOIS
 * bundle's default context), so fields placed directly under <Form> render
 * with LEFT-positioned labels in a ~240px label column, and a field `note`
 * (e.g. a lab reference range) renders to the RIGHT of the input. Our
 * default used to be 'flex', which stacked top labels inside the
 * size-clamped wrapper and crammed the whole form into a narrow column.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as Babel from '@babel/standalone';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createComponentFromCode, BaseScopeBuilder } from '@mois/form-engine-core';
import { buildScope } from './build-scope';
import { FormStateProvider, initFormData } from '../hooks/form-state';

const FORM_SOURCE = `
const FormComponent = () => {
  return (
    <Form>
      <TextArea fieldId="createdBy" label="Created By" size="medium" />
      <TextArea
        fieldId="glucoseValue"
        label="Glucose (Fasting)"
        note="4.0-7.0"
        textFieldProps={{ description: "mmol/L" }}
        size="tiny"
      />
      <Markdown
        fieldId="report"
        label="Lab assessment note"
        defaultValue={"In this _test form_, **the sample data comes prefilled**."}
      />
    </Form>
  )
}
`;

describe('panel form layout parity (linear default)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    initFormData();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  it('renders bare Form fields with left labels and right-hand notes', async () => {
    const scope = buildScope();
    const scopeBuilder = new BaseScopeBuilder();
    scopeBuilder.buildScope = () => scope;

    const Component = createComponentFromCode(FORM_SOURCE, {
      babel: Babel,
      scopeBuilder,
    });

    await act(async () => {
      root.render(
        <FormStateProvider>
          <Component />
        </FormStateProvider>
      );
    });

    for (const labelText of ['Created By', 'Glucose (Fasting)']) {
      const label = Array.from(document.querySelectorAll('label'))
        .find((el) => el.textContent === labelText);
      expect(label, `label "${labelText}" must render`).toBeTruthy();
      // Left-label mode: the label sits inside LayoutItem's row-wrap flex
      // container, beside the field. Top-label mode (the old flex default)
      // parents the label directly under the field-id wrapper instead.
      const parent = label!.parentElement as HTMLElement;
      expect(
        parent.style.flexFlow,
        `label "${labelText}" must be in the left-label row container`
      ).toBe('row wrap');
    }

    // The lab entry's note (reference range) renders beside the input.
    const noteHost = Array.from(document.querySelectorAll('div'))
      .find((el) => el.textContent === '4.0-7.0' && el.children.length === 0);
    expect(noteHost, 'reference-range note must render').toBeTruthy();
    const fieldRow = noteHost!.closest('[data-field-id="glucoseValue"]');
    expect(fieldRow, 'note must live inside the field row').toBeTruthy();

    // Markdown control (lab assessment note): Preview | Edit pivot; preview
    // renders the markdown (bold/italic), Edit is a plain textarea holding
    // the RAW source — matching the real engine (its Edit tab is the
    // TextArea control, not a rich editor).
    const tabs = Array.from(document.querySelectorAll('button'))
      .filter((el) => (el.textContent ?? '').includes('Preview') || (el.textContent ?? '').includes('Edit'));
    expect(
      tabs.map((el) => el.textContent?.trim()),
      `markdown pivot missing; note-field html: ${(document.querySelector('[data-field-id="report"]') as HTMLElement | null)?.outerHTML?.slice(0, 400) ?? 'FIELD NOT RENDERED'}`
    ).toEqual(['Preview', 'Edit']);
    const bold = Array.from(document.querySelectorAll('strong'))
      .find((el) => el.textContent === 'the sample data comes prefilled');
    expect(bold, 'preview must render the markdown').toBeTruthy();

    const editTab = tabs.find((el) => (el.textContent ?? '').includes('Edit'))!;
    await act(async () => {
      editTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea, 'Edit tab must show a plain textarea').toBeTruthy();
    expect(textarea.value).toBe('In this _test form_, **the sample data comes prefilled**.');
  });
});
