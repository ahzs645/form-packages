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
    const report = JSON.parse(container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Live query results JSON"]')!.value);
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
    expect(JSON.parse(container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Live query results JSON"]')!.value).status).toBe('Introspection disabled');
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
    const report = JSON.parse(container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Live query results JSON"]')!.value);
    expect(report.reportVersion).toBe(5);
    expect(report.apiInventory.inputTypes).toHaveLength(2);
    expect(report.apiInventory.mutations[0]).toMatchObject({ coverage: 'Mapped adapter; live write untested', executionStatus: 'Not executed' });
    expect(report.apiInventory.mutations[1]).toMatchObject({ coverage: 'Needs a dedicated write test', executionStatus: 'Not executed' });
    expect(report.apiInventory.uninspectedInputTypes).toEqual([]);
    expect(transport).toHaveBeenCalledTimes(5);
  });

});

const liveSchema = JSON.parse(fs.readFileSync('data/mois-live-api-schema.json', 'utf8'));
const reportValue = () => JSON.parse(container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Live query results JSON"]')!.value);
const clickButton = async (name: string) => { await act(async () => { Array.from(container.querySelectorAll('button')).find((b) => b.textContent === name)!.click(); }); };
async function setContext(value: unknown) {
  await act(async () => {
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Test context JSON"]')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, JSON.stringify(value));
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function testHost(write?: (name: string, variables: any) => any) {
  const records: any[] = [];
  return vi.fn(async (operation, _token, _server, query, vars) => {
    if (operation === 'InspectPatientContextRoots') return { __schema: { queryType: { name: 'Query' }, mutationType: { name: 'Mutation' } } };
    if (operation === 'InspectPatientContextType') {
      if (vars.name === 'Query') return { __type: { fields: liveSchema.queries } };
      if (vars.name === 'Mutation') return { __type: { fields: liveSchema.mutations } };
      const input = liveSchema.inputTypes.find((t: any) => t.name === vars.name);
      if (input) return { __type: input };
      const fieldNames = ['patientId', 'observationId', 'observationPanelId', 'description', 'value', 'documentId', 'note', 'webformId', 'webformDefinitionId', 'templateId', 'shortNote', 'associatedPartyId', 'chartPreferenceId', 'connectionId', 'householdOccupantId', 'longTermMedicationId', 'prescriptionId', 'prescriptionLogId', 'serviceEpisodeId', 'serviceEventId', 'encounterId', 'taskId', 'favouriteMedicationId', 'correspondenceId', 'comment', 'medication', 'preference', 'method', 'officeNote', 'title'];
      return { __type: { fields: [...fieldNames.map((name) => ({ name, type: name.endsWith('Id') ? scalar : { kind: 'SCALAR', name: 'String' }, args: [] })), ...['observationPanels', 'observations', 'contacts', 'preferences', 'connections', 'documents', 'householdOccupants', 'longTermMedications', 'prescriptions', 'prescriptionLogs', 'serviceEpisodes', 'encounters', 'favouriteMedications', 'correspondences'].map((name) => ({ name, type: list, args: [] }))] } };
    }
    if (operation === 'ProbeMoisWrite') {
      const name = query.match(/\{\s*(\w+)/)[1];
      if (write) return write(name, vars);
      if (name === 'addObservation') { const record = { ...vars.observation, observationId: 501 }; records.push(record); return { addObservation: [record] }; }
      if (name === 'changeObservations') { if (vars.observationChanges) Object.assign(records[0], vars.observationChanges[0]); return { changeObservations: [{ patientId: 42, observations: records }] }; }
      return { [name]: null };
    }
    if (operation === 'VerifyMoisWrite') return { patient: [{ patientId: 42, observations: records }] };
    if (operation === 'ProbePaperTemplates') return { paperFormTemplate: [{ templateId: 3 }] };
    if (operation === 'ProbeMoisRoot') { const name = query.match(/\{\s*(\w+)/)[1]; return { [name]: [] }; }
    throw new Error('Unexpected operation ' + operation);
  });
}

describe('live write laboratory', () => {
  it('tests schema-valid default payloads, verifies observation updates and keeps sent operations out of subsequent batch runs', async () => {
    const transport = testHost(); mount(transport);
    await clickButton('Inspect read/write API');
    expect(transport.mock.calls.every((call) => call[3].startsWith('query '))).toBe(true);
    await clickButton('Run test writes');
    const report = reportValue();
    expect(report.writeResults).toHaveLength(41);
    expect(report.writeResults.find((r: any) => r.operation === 'addObservation')).toMatchObject({ status: 'Write verified', recordId: 501 });
    expect(report.writeResults.find((r: any) => r.operation === 'changeObservations')).toMatchObject({ status: 'Write verified', recordId: 501 });
    expect(report.writeResults.find((r: any) => r.operation === 'sendFax')).toMatchObject({ status: 'Not attempted' });
    expect(report.writeResults.find((r: any) => r.operation === 'query')).toMatchObject({ status: 'Not attempted' });
    expect(report.writeResults.filter((r: any) => /Unknown input|Unknown argument/.test(r.error || ''))).toEqual([]);
    expect(JSON.stringify(report)).not.toContain('secret-token');
    expect(report.writeResults.every((r: any) => !r.variables)).toBe(true);
    expect(report.createdTestRecordIds.observationId).toBe(501);
    const count = transport.mock.calls.filter((call) => call[0] === 'ProbeMoisWrite').length;
    await clickButton('Run test writes');
    expect(transport.mock.calls.filter((call) => call[0] === 'ProbeMoisWrite')).toHaveLength(count);
  });
  it('does not call an accepted mutation a verified write without read-back evidence', async () => {
    mount(testHost((name) => ({ [name]: [{ __typename: 'Patient', patientId: 42 }] })));
    await clickButton('Inspect read/write API'); await clickButton('Run test writes');
    const report = reportValue();
    expect(report.writeResults.some((r: any) => r.status === 'Mutation accepted; persistence unverified')).toBe(true);
    expect(report.writeResults.some((r: any) => r.status === 'Write verified')).toBe(false);
  });

  it('runs custom GraphQL through the host and excludes response values from the report', async () => {
    const transport = vi.fn(async (operation: string, _token, _server, _query, vars) => {
      expect(operation).toBe('CustomPatientProbe'); expect(vars).toEqual({ patientId: 42 });
      return { patient: [{ patientId: 42, name: 'PRIVATE RESPONSE' }] };
    });
    mount(transport); await clickButton('Run custom operation');
    expect(container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Custom response 1"]')!.value).toContain('PRIVATE RESPONSE');
    const report = reportValue();
    expect(report.customOperations[0]).toMatchObject({ kind: 'query', status: 'Query response received', resultFields: ['patient'] });
    expect(JSON.stringify(report)).not.toContain('PRIVATE RESPONSE');
    expect(JSON.stringify(report)).not.toContain('secret-token');
  });
  it('probes every root query or reports its missing inputs', async () => {
    mount(testHost()); await clickButton('Inspect read/write API'); await clickButton('Test root queries');
    const report = reportValue();
    expect(report.rootQueryResults).toHaveLength(24);
    expect(report.rootQueryResults.find((r: any) => r.operation === 'patient')).toMatchObject({ status: 'Read succeeded: empty' });
    expect(report.rootQueryResults.find((r: any) => r.operation === 'document')).toMatchObject({ status: 'Not attempted' });
  });

  it('can reach all 39 concrete mutation fields with valid dependencies and explicit fax inputs', async () => {
    const transport = testHost((name, vars) => {
      const payload: any = Object.values(vars).find((v) => v && typeof v === 'object' && !Array.isArray(v)) || {};
      const record = { ...payload, patientId: 42, observationId: 501, observationPanelId: 518, associatedPartyId: 502, chartPreferenceId: 503, connectionId: 504, documentId: 505, householdOccupantId: 506, longTermMedicationId: 507, prescriptionId: 508, prescriptionLogId: 509, serviceEpisodeId: 510, serviceEventId: 511, encounterId: 512, taskId: 513, favouriteMedicationId: 514, correspondenceId: 515, webformId: 516, webformDefinitionId: 517 };
      const patientResult = Object.fromEntries(['observationPanels', 'observations', 'contacts', 'preferences', 'connections', 'documents', 'householdOccupants', 'longTermMedications', 'prescriptions', 'prescriptionLogs', 'serviceEpisodes', 'encounters', 'favouriteMedications', 'correspondences'].map((key) => [key, [record]]));
      return { [name]: [{ ...record, ...patientResult }] };
    });
    mount(transport); await clickButton('Inspect read/write API'); await setContext({ providerId: 12, assignedUserId: 7, service: { code: 'TEST', system: 'TEST' } }); await clickButton('Run test writes');
    const attempted = transport.mock.calls.filter((call) => call[0] === 'ProbeMoisWrite').map((call) => call[3].match(/\{\s*(\w+)/)[1]);
    const expected = liveSchema.mutations.map((m: any) => m.name).filter((name: string) => !['sendFax', 'query'].includes(name));
    expect(attempted.sort()).toEqual([...expected, "changeObservations"].sort());
    // Fax is available only with an explicit destination and individually selected operation.
    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>('select[aria-label="Write operation"]')!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'sendFax'); select.dispatchEvent(new Event('change', { bubbles: true }));
      const textarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Write variable overrides JSON"]')!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, JSON.stringify({ sendFax: { patientId: '$patientId', eFaxAccountId: 1, document: { documentId: '$created.documentId' }, recipients: [{ faxNumber: 'TEST-DESTINATION' }] } })); textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clickButton('Run test writes');
    expect(transport.mock.calls.filter((call) => call[0] === 'ProbeMoisWrite' && call[3].includes('sendFax('))).toHaveLength(1);
  });
  it('uses constrained demographic values, valid definition metadata and a separate named panel probe', async () => {
    const transport = testHost(); mount(transport); await clickButton('Inspect read/write API'); await clickButton('Run test writes');
    const calls = transport.mock.calls.filter((call) => call[0] === 'ProbeMoisWrite');
    const variablesFor = (name: string) => calls.find((call) => call[3].includes(`{ ${name}(`))![4];
    expect(variablesFor('changePatientContact').newContact.homeMessage).toMatch(/^[YN]$/);
    expect(variablesFor('changePatientInsurance').newInsurance.insuranceNumber.length).toBeLessThanOrEqual(8);
    expect(variablesFor('changePatientInsurance').newInsurance.billingDepartment).toBeUndefined();
    expect(variablesFor('changePatientName').newUsualName).toMatchObject({ first: 'WEBFORMS', family: 'TEST' });
    const definition = variablesFor('addWebformDefinition').webform;
    expect(definition.name).toMatch(/^webforms_test_[a-z0-9_]+$/);
    expect(definition.buildVersion).toMatch(/^\d{8}$/);
    expect(definition.type).toBe('ATTACHMENT');
    const observationCalls = calls.filter((call) => call[3].includes('{ changeObservations('));
    expect(observationCalls).toHaveLength(2);
    expect(observationCalls[0][4].panelChanges).toBeUndefined();
    expect(observationCalls[1][4].observationChanges).toBeUndefined();
    expect(observationCalls[1][4].panelChanges[0].panelName.code).toBe('4548-4');
    expect(calls.some((call) => call[3].includes('{ createAppointment('))).toBe(false);
    expect(reportValue().writeResults.find((r: any) => r.operation === 'createAppointment').error).toContain('providerId');
  });

  it('recovers missing medication IDs through a unique marker read, without repeating the write', async () => {
    let medication: any;
    const base = testHost((name, vars) => {
      if (name === 'changeLongTermMedication') medication = vars.longTermMedication;
      return { [name]: [{ patientId: 42 }] };
    });
    const transport = vi.fn(async (...args: any[]) => {
      if (args[0] === 'VerifyMoisWrite' && args[1] && args[3].includes('longTermMedications')) return { patient: [{ patientId: 42, longTermMedications: [{ ...medication, longTermMedicationId: 987 }] }] };
      return (base as any)(...args);
    });
    mount(transport); await clickButton('Inspect read/write API'); await clickButton('Run test writes');
    expect(reportValue().writeResults.find((r: any) => r.operation === 'changeLongTermMedication')).toMatchObject({ status: 'Write verified', recordId: 987, idRecovery: 'Unique marker found on independent read' });
    expect(transport.mock.calls.filter((call) => call[0] === 'ProbeMoisWrite' && call[3].includes('{ changeLongTermMedication('))).toHaveLength(1);
  });

  it('stops after an uncertain mutation timeout and prevents duplicate retries', async () => {
    vi.useFakeTimers();
    try {
      const transport = testHost(() => new Promise(() => {})); mount(transport);
      await clickButton('Inspect read/write API');
      await clickButton('Run test writes');
      await act(async () => { await vi.advanceTimersByTimeAsync(30001); });
      const report = reportValue();
      expect(report.writeResults[0].status).toBe('Outcome unknown; do not retry automatically');
      expect(transport.mock.calls.filter((call) => call[0] === 'ProbeMoisWrite')).toHaveLength(1);
      const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Run test writes')!;
      expect(button.disabled).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});

const missingType = (name: string) => ({ kind: 'OBJECT', name });
const missingList = (name: string) => ({ kind: 'LIST', ofType: missingType(name) });
const missingField = (name: string, type: any, args: any[] = []) => ({ name, type, args });
const missingArg = (name: string, required = false) => ({ name, defaultValue: null, type: required ? { kind: 'NON_NULL', ofType: scalar } : scalar });
const missingSchema = (extra: any[] = []) => ({ __schema: { queryType: { name: 'ReadRoot' }, types: [
  { name: 'ReadRoot', kind: 'OBJECT', fields: [missingField('patient', missingList('Patient'), [missingArg('id')]), missingField('webform', missingList('Webform'), [missingArg('id', true)]), missingField('webformDefinition', missingList('WebformDefinition'), [missingArg('first')])] },
  { name: 'Patient', kind: 'OBJECT', fields: [missingField('patientId', scalar), missingField('serviceEpisodes', missingList('ServiceEpisode'))] },
  { name: 'ServiceEpisode', kind: 'OBJECT', fields: [missingField('serviceEvents', missingList('ServiceEvent')), missingField('patient', missingType('Patient'))] },
  { name: 'ServiceEvent', kind: 'OBJECT', fields: [missingField('serviceEventId', scalar)] },
  { name: 'Webform', kind: 'OBJECT', fields: [missingField('webformId', scalar)] },
  { name: 'WebformDefinition', kind: 'OBJECT', fields: [missingField('webformDefinitionId', scalar)] },
  ...extra,
] } });
const exploration = () => reportValue().missingCollectionExploration;

describe('missing collection exploration', () => {
  it('runs independently, verifies a nested path, and keeps related form catalogs distinct', async () => {
    const transport = vi.fn(async (operation, _token, _server, query, vars) => {
      expect(query).toMatch(/^query /);
      if (operation === 'ExploreMissingSchema') return missingSchema();
      if (query.includes('webformDefinition')) return { webformDefinition: [] };
      expect(query).toContain('patientId serviceEpisodes { __typename serviceEvents');
      expect(vars).toEqual({ p0_id: 42 });
      return { patient: [{ patientId: 42, serviceEpisodes: [{ serviceEvents: [{ serviceEventId: 8, privateSample: 'SECRET RECORD' }] }] }] };
    });
    mount(transport); await clickButton('Explore missing collections');
    const result = exploration();
    expect(result.collections).toHaveLength(11);
    const events = result.collections.find((r: any) => r.collection === 'serviceEvents');
    expect(events.status).toBe('Candidate path read verified; equivalence unverified');
    expect(events.paths[0]).toMatchObject({ path: 'patient.serviceEpisodes.serviceEvents', status: 'Read succeeded', count: 1 });
    const forms = result.collections.find((r: any) => r.collection === 'dynamicForms');
    expect(forms.status).toBe('Related API explored; equivalence unverified');
    expect(forms.paths.find((p: any) => p.path === 'webform')).toMatchObject({ status: 'Exposed path; needs arguments or scope' });
    expect(result.collections.find((r: any) => r.collection === 'familyHistory').status).toBe('No candidate path found within search bounds');
    expect(result.coverage).toMatchObject({ completed: true, probesSent: 2 });
    expect(JSON.stringify(result)).not.toContain('SECRET RECORD');
    expect(JSON.stringify(result)).not.toContain('secret-token');
    expect(result.collections.find((r: any) => r.collection === 'standardForms').paths.find((p: any) => p.path === 'webformDefinition').reusedProbe).toBe(true);
  });

  it('distinguishes an empty ancestor from an empty target, and rejects the wrong patient', async () => {
    let chart: any = { patientId: 42, serviceEpisodes: [] };
    mount(vi.fn(async (op) => op === 'ExploreMissingSchema' ? missingSchema() : { patient: [chart], webformDefinition: [] }));
    await clickButton('Explore missing collections');
    let events = exploration().collections.find((r: any) => r.collection === 'serviceEvents');
    expect(events.paths[0].status).toBe('Query succeeded; no parent records reached target');
    chart = { patientId: 42, serviceEpisodes: [{ serviceEvents: [] }] };
    await clickButton('Explore missing collections');
    events = exploration().collections.find((r: any) => r.collection === 'serviceEvents');
    expect(events.paths[0].status).toBe('Read succeeded: empty');
    chart = { patientId: 43, serviceEpisodes: [{ serviceEvents: [] }] };
    await clickButton('Explore missing collections');
    expect(exploration().collections.find((r: any) => r.collection === 'serviceEvents').paths[0].status).toBe('Read failed');
  });

  it('reports required nested arguments without inventing values, while other paths continue', async () => {
    const schema = missingSchema();
    schema.__schema.types.find((t: any) => t.name === 'ServiceEpisode')!.fields![0].args = [missingArg('serviceEventId', true)];
    const transport = vi.fn(async (op, _token, _server, query) => {
      if (op === 'ExploreMissingSchema') return schema;
      expect(query).not.toContain('serviceEvents');
      return { webformDefinition: [] };
    });
    mount(transport); await clickButton('Explore missing collections');
    expect(exploration().collections.find((r: any) => r.collection === 'serviceEvents').paths[0].error).toContain('serviceEvents.serviceEventId');
  });

  it('reports denied introspection as incomplete rather than declaring collections unavailable', async () => {
    mount(vi.fn(async () => { throw new Error('Introspection denied'); }));
    await clickButton('Explore missing collections');
    expect(exploration().status).toBe('Exploration incomplete');
    expect(exploration().coverage.completed).toBe(false);
    expect(exploration().collections.every((r: any) => r.status === 'Not completed')).toBe(true);
  });

  it('explores concrete types through inline fragments and does not loop on cyclic output graphs', async () => {
    const schema: any = missingSchema([
      { name: 'Node', kind: 'UNION', fields: null, possibleTypes: [{ name: 'FamilyHistory', kind: 'OBJECT' }] },
      { name: 'FamilyHistory', kind: 'OBJECT', fields: [missingField('familyHistoryId', scalar)] },
    ]);
    schema.__schema.types.find((t: any) => t.name === 'Patient').fields.push(missingField('records', { kind: 'LIST', ofType: { kind: 'UNION', name: 'Node' } }));
    mount(vi.fn(async (op, _token, _server, query) => {
      if (op === 'ExploreMissingSchema') return schema;
      if (query.includes('FamilyHistory')) {
        expect(query).toContain('records { __typename ... on FamilyHistory { __typename familyHistoryId } }');
        return { patient: [{ patientId: 42, records: [{ __typename: 'FamilyHistory', familyHistoryId: 5 }] }] };
      }
      return { patient: [{ patientId: 42, serviceEpisodes: [] }], webformDefinition: [] };
    }));
    await clickButton('Explore missing collections');
    expect(exploration().collections.find((r: any) => r.collection === 'familyHistory').paths[0].status).toBe('Read succeeded');
    expect(exploration().coverage.visitedStates).toBeLessThan(30);
  });
});

describe('missing exploration boundaries', () => {
  it('reports depth bounds and exports schema metadata for investigating unrecognized names', async () => {
    const schema: any = missingSchema();
    schema.__schema.types.find((t: any) => t.name === 'Patient').fields.push(missingField('deep', missingType('Deep1')));
    for (let i = 1; i <= 7; i++) schema.__schema.types.push({ name: 'Deep' + i, kind: 'OBJECT', fields: [missingField(i === 7 ? 'socialHistory' : 'next', missingType(i === 7 ? 'SocialHistory' : 'Deep' + (i + 1)))] });
    schema.__schema.types.push({ name: 'SocialHistory', kind: 'OBJECT', fields: [missingField('socialHistoryId', scalar)] });
    mount(vi.fn(async (op) => op === 'ExploreMissingSchema' ? schema : { patient: [{ patientId: 42, serviceEpisodes: [] }], webformDefinition: [] }));
    await clickButton('Explore missing collections');
    expect(exploration().coverage.truncated).toBe(true);
    expect(exploration().collections.find((r: any) => r.collection === 'socialHistory')).toMatchObject({ matchedOutputTypes: ['SocialHistory'], status: 'No candidate path found within search bounds' });
    expect(exploration().schemaTypes.find((t: any) => t.name === 'Deep7').fields[0].name).toBe('socialHistory');
  });

  it('stops read exploration without dispatching further probes or losing the incomplete result', async () => {
    let finish!: (value: unknown) => void;
    const transport = vi.fn(async (op) => op === 'ExploreMissingSchema' ? missingSchema() : new Promise((resolve) => { finish = resolve; }));
    mount(transport); await clickButton('Explore missing collections');
    await clickButton('Stop checks');
    await act(async () => { finish({ patient: [{ patientId: 42, serviceEpisodes: [] }] }); });
    expect(exploration().status).toBe('Stopped; exploration incomplete');
    expect(exploration().coverage.completed).toBe(false);
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
