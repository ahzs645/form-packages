// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import * as Babel from '@babel/standalone';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const compiled = Babel.transform(fs.readFileSync('packages/form-components/src/nhforms/PatientContextQueryTest/index.jsx', 'utf8'), { presets: ['react'] }).code!;
let root: Root;
let container: HTMLDivElement;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });
const scalar = { kind: 'SCALAR', name: 'Int' };
const list = { kind: 'LIST', ofType: { kind: 'OBJECT', name: 'Observation' } };
const fields = [
  { name: 'observations', args: [], type: list },
  { name: 'restricted', args: [{ name: 'filter', defaultValue: null, type: { kind: 'NON_NULL', ofType: scalar } }], type: list },
  { name: 'empty', args: [], type: list },
];
const initial = { patient: { patientId: 42, name: { text: 'Test patient' } }, auth: { jwToken: 'secret-token', apiServer: 'https://example.test/' } };
function mount(transport?: any, writeTargets: unknown[] = []) {
  let sd: any = initial;
  const Component = new Function('React', 'useSourceData', 'queryGraphQL', `${compiled}; return PatientContextQueryTest;`)(React, () => sd, transport);
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  const render = () => act(() => root.render(<Component collections={['observations', 'missing', 'restricted']} writeTargets={writeTargets} />));
  render();
  return (next: any) => { sd = next; render(); };
}
async function run() { await act(async () => { container.querySelector('button')!.click(); }); }

describe('PatientContextQueryTest', () => {
  it('disables live reads without the real host transport', () => {
    mount();
    expect(container.querySelector('button')!.disabled).toBe(true);
    expect(container.textContent).toContain('Builder preview cannot perform these checks');
  });
  it('discovers schema, queries individual collections, and differentiates absent, empty, and required arguments', async () => {
    const transport = vi.fn(async (operation, token, server, query, variables) => {
      expect(query).not.toMatch(/\bmutation\b/);
      if (operation === 'InspectPatientContextType') return { __type: { fields: variables.name === 'Patient' ? fields : [{ name: 'observationId', args: [], type: scalar }] } };
      expect(variables).toEqual({ patientId: 42 });
      return { patient: [{ patientId: 42, empty: [], observations: [{ observationId: 1 }] }] };
    });
    mount(transport); await run();
    expect(container.textContent).toContain('Live checks complete');
    expect(container.textContent).toContain('Not exposed in Patient schema');
    expect(container.textContent).toContain('Skipped: requires arguments');
    expect(container.textContent).toContain('Read succeeded: empty');
    expect(container.textContent).toContain('observationId');
    expect(container.textContent).not.toContain('secret-token');
    const report = JSON.parse(container.querySelector('textarea')!.value);
    expect(report.reportType).toBe('mois-patient-context-live-query');
    expect(report.schemaFields.map((field: any) => field.name)).toContain('observations');
    expect(report.results.find((row: any) => row.collection === 'observations')).toMatchObject({ status: 'Read succeeded', count: 1 });
    expect(JSON.stringify(report)).not.toContain('Test patient');
    expect(JSON.stringify(report)).not.toContain('secret-token');
    expect(report.results.every((row: any) => !('sample' in row))).toBe(true);
    expect(report).not.toHaveProperty('patientId');
    expect(transport).toHaveBeenCalledTimes(4); // Patient schema, record schema, two collection reads.
  });
  it('reports denied introspection without attempting any collection reads', async () => {
    const transport = vi.fn(async (_op, _token, _server, _query, _vars, status) => {
      status(() => ({ error: 'Introspection denied', detailErrors: [{ message: 'Introspection disabled' }] }));
      return null;
    });
    mount(transport); await run();
    expect(container.textContent).toContain('Introspection disabled');
    expect(JSON.parse(container.querySelector('textarea')!.value).status).toBe('Introspection disabled');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('shows per-collection errors and continues, rejecting results for another patient', async () => {
    mount(vi.fn(async (op, _token, _server, _query, vars) => {
      if (op === 'InspectPatientContextType') return { __type: { fields: vars.name === 'Patient' ? fields : [] } };
      return { patient: [{ patientId: 999, observations: [{ value: 'wrong patient data' }] }] };
    }));
    await run();
    expect(container.textContent).toContain('MOIS did not return the requested patient');
    expect(container.textContent).not.toContain('wrong patient data');
    expect(container.textContent).toContain('Live checks complete');
  });
  it('ignores pending responses when the patient changes', async () => {
    let resolve!: (value: unknown) => void;
    const transport = vi.fn(() => new Promise((done) => { resolve = done; }));
    const update = mount(transport);
    await run();
    update({ ...initial, patient: { patientId: 43 } });
    await act(async () => { resolve({ __type: { fields } }); });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('No live checks run yet');
    expect(container.textContent).not.toContain('Live checks complete');
  });
  it('discovers arbitrary root names and nested mutation inputs without executing any mutation', async () => {
    const input = { kind: 'INPUT_OBJECT', name: 'TestInput' };
    const enumType = { kind: 'ENUM', name: 'TestKind' };
    const transport = vi.fn(async (operation, _token, _server, query, variables) => {
      expect(query.trim()).toMatch(/^query /);
      if (operation === 'InspectPatientContextRoots') return { __schema: { queryType: { name: 'ReadRoot' }, mutationType: { name: 'WriteRoot' } } };
      const types: Record<string, any> = {
        ReadRoot: { fields: [{ name: 'patient', args: [], type: list }] },
        WriteRoot: { fields: [{ name: 'changeTest', args: [{ name: 'input', type: input }], type: scalar }, { name: 'unknownWrite', args: [], type: scalar }] },
        TestInput: { kind: 'INPUT_OBJECT', inputFields: [{ name: 'kind', type: enumType }, { name: 'recursive', type: input }] },
        TestKind: { kind: 'ENUM', enumValues: [{ name: 'TEST' }] },
      };
      return { __type: types[variables.name] };
    });
    mount(transport, [{ id: 'test.changeTest', graphqlField: 'changeTest', runtimeStatus: 'supported' }]);
    await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Inspect read/write API')!.click(); });
    const report = JSON.parse(container.querySelector('textarea')!.value);
    expect(report.reportVersion).toBe(2);
    expect(report.apiInventory.inputTypes).toHaveLength(2);
    expect(report.apiInventory.mutations[0]).toMatchObject({ coverage: 'Mapped adapter; live write untested', executionStatus: 'Not executed' });
    expect(report.apiInventory.mutations[1]).toMatchObject({ coverage: 'Needs a dedicated write test', executionStatus: 'Not executed' });
    expect(report.apiInventory.uninspectedInputTypes).toEqual([]);
    expect(transport).toHaveBeenCalledTimes(5);
  });

});
