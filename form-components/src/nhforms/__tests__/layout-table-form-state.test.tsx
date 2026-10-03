// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import * as Babel from '@babel/standalone';
import * as PDFLib from '@cantoo/pdf-lib';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { BuilderField } from '@webforms/form-model';
import { LocalFormStateProvider, useActiveDataForForms } from '../../hooks/form-state';
import { builderFieldToParsedField } from '@/lib/builder-parsed-field';
import { renderActionButtons } from '@/lib/mois-export/renderers/button-renderer';
import { DEFAULT_FOOTER_BUTTONS } from '@/lib/mois-export/constants';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const selectAnswers = (data: any) => data.field.data;
const section = { activeSelector: selectAnswers };
const sourceData = {};
let latest: any;
let writeSelected: (updater: any) => void;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

function Observer() {
  const [data] = useActiveDataForForms();
  const [, setSelected] = useActiveDataForForms(selectAnswers);
  latest = data;
  writeSelected = setSelected;
  return null;
}

function Numeric({ fieldId }: { fieldId: string }) {
  const [answers, setAnswers] = useActiveDataForForms(selectAnswers);
  return <input aria-label={fieldId} value={answers[fieldId] ?? ''} onChange={event => {
    const value = Number(event.currentTarget.value);
    setAnswers({ [fieldId]: value });
  }} />;
}

function loadLayoutTable() {
  const source = ['ValueKit', 'FormulaKit', 'FormLogicKit', 'DefaultsKit', 'LayoutTable']
    .map(name => readFileSync(`packages/form-components/src/nhforms/${name}/index.jsx`, 'utf8')).join('\n');
  const compiled = Babel.transform(source, { presets: ['react'] }).code;
  return new Function('React', 'Fluent', 'useActiveData', 'useSection', 'useSourceData', 'Numeric',
    `${compiled}; return LayoutTable;`)(React, {}, useActiveDataForForms, () => section, () => sourceData, Numeric) as React.ComponentType<any>;
}

async function mount(child?: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(<LocalFormStateProvider><Observer />{child}</LocalFormStateProvider>));
  await act(async () => {});
}

describe('selected form-state writes', () => {
  it('renders and saves text classification results without numeric coercion', async () => {
    const rows = [{ id: 'row', cells: [
      { id: 'points-cell', kind: 'field', fieldId: 'points', inputType: 'number' },
      { id: 'classification-cell', kind: 'computed', fieldId: 'classification',
        formula: 'iif(hasValue([points]), iif([points] >= 18, "VH", iif([points] >= 10, "H", "L")), "")',
        resultType: 'text', precision: 2 },
      { id: 'identifier-cell', kind: 'computed', fieldId: 'identifier',
        formula: 'iif(hasValue([points]), "007", "")', resultType: 'text', precision: 2 },
    ] }];
    const LayoutTable = loadLayoutTable();
    await mount(<LayoutTable rows={rows} />);
    expect(latest.field.data.classification ?? '').toBe('');
    for (const [points, classification] of [[5, 'L'], [12, 'H'], [18, 'VH']] as const) {
      await act(async () => writeSelected({ points }));
      await act(async () => {});
      expect(container!.textContent).toContain(classification);
      expect(latest.field.data).toMatchObject({ classification, identifier: '007' });
      expect(latest.formData.classification).toBe(classification);
    }
    const pdf = await PDFLib.PDFDocument.create();
    const field = pdf.getForm().createTextField('classification-box');
    field.addToPage(pdf.addPage());
    field.setText(latest.formData.classification);
    const saved = await PDFLib.PDFDocument.load(await pdf.save());
    expect(saved.getForm().getTextField('classification-box').getText()).toBe('VH');
  });

  it('merges scoped object patches without mutating the previous state', async () => {
    await mount();
    await act(async () => writeSelected({ amount: 1, other: 'keep' }));
    const previous = latest.field.data;
    await act(async () => writeSelected({ amount: 2 }));
    expect(previous.amount).toBe(1);
    expect(latest.field.data).toMatchObject({ amount: 2, other: 'keep' });
    await act(async () => writeSelected({ amount: 3 }));
    expect(latest.field.data).toMatchObject({ amount: 3, other: 'keep' });
  });

  it('persists LayoutTable defaults and computed results for the PDF exporter after an input changes', async () => {
    const table: BuilderField = { id: 'expenses', label: 'Expenses', type: 'layoutTable', layoutTableConfig: { rows: [{ id: 'row', cells: [
      { id: 'amount-cell', kind: 'field', fieldId: 'monthly', inputType: 'number', defaultAnswer: { kind: 'literal', value: 0 }, pdfFieldAliases: ['monthly-box'] },
      { id: 'annual-cell', kind: 'computed', fieldId: 'annual', formula: '[monthly] * 12', resultType: 'number', precision: 2, pdfFieldAliases: ['annual-box'] },
    ] }] } };
    const LayoutTable = loadLayoutTable();
    await mount(<LayoutTable rows={table.layoutTableConfig!.rows} />);
    expect(latest.field.data).toMatchObject({ monthly: 0, annual: '0' });
    const previous = latest.field.data;
    const input = container!.querySelector('input')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, '100.25');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {});
    expect(latest.field.data).toMatchObject({ monthly: 100.25, annual: '1203' });
    expect(latest.formData.annual).toBe('1203');
    expect(previous.monthly).toBe(0);
    const jsx = renderActionButtons({ ...DEFAULT_FOOTER_BUTTONS, showPdfRegenerator: true }, '', undefined,
      [builderFieldToParsedField(table, 0)]).join('\n');
    const map = JSON.parse(jsx.match(/ fieldMap=\{(\{[^\n]*?\})\}/)![1]);
    expect(map['annual-box']).toBe('annual');
    const pdf = await PDFLib.PDFDocument.create();
    const field = pdf.getForm().createTextField('annual-box');
    field.addToPage(pdf.addPage());
    field.setText(String(latest.field.data[map['annual-box']]));
    const saved = await PDFLib.PDFDocument.load(await pdf.save());
    expect(saved.getForm().getTextField('annual-box').getText()).toBe('1203');
  });
});
