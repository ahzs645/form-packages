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
      const fieldNames = ['patientId', 'observationId', 'observationPanelId', 'description', 'value', 'documentId', 'note', 'webformId', 'webformDefinitionId', 'templateId', 'shortNote', 'associatedPartyId', 'chartPreferenceId', 'connectionId', 'householdOccupantId', 'longTermMedicationId', 'prescriptionId', 'prescriptionLogId', 'serviceEpisodeId', 'serviceEventId', 'encounterId', 'taskId', 'favouriteMedicationId', 'correspondenceId', 'comment', 'medication', 'preference', 'method', 'officeNote', 'title', 'formdata', 'isDraft', 'recordState'];
      return { __type: { fields: [...fieldNames.map((name) => ({ name, type: name.endsWith('Id') ? scalar : { kind: 'SCALAR', name: 'String' }, args: [] })), ...['observationPanels', 'observations', 'contacts', 'preferences', 'connections', 'documents', 'householdOccupants', 'longTermMedications', 'prescriptions', 'prescriptionLogs', 'serviceEpisodes', 'encounters', 'favouriteMedications', 'correspondences'].map((name) => ({ name, type: list, args: [] }))] } };
    }
    if (operation === 'ProbeMoisWrite') {
      const name = query.match(/\{\s*(\w+)/)[1];
      if (write) return write(name, vars);
      if (name === 'addObservation') { const record = { ...vars.observation, observationId: 501 }; records.push(record); return { addObservation: [record] }; }
      if (name === 'changeObservations') { if (vars.observationChanges) Object.assign(records[0], vars.observationChanges[0]); return { changeObservations: [{ patientId: 42, observations: records }] }; }
      return { [name]: null };
    }
    if (operation === 'ReadContactBeforeProbe') return { patient: [{ patientId: 42, telecom: { homePhone: '5550001', homeMessage: 'Y', workPhone: '5550002', homeEmail: 'test@example.invalid' } }] };
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
    let episode: any;
    let serviceEvent: any;
    const base = testHost((name, vars) => {
      if (name === 'changeServiceEvent') { serviceEvent = { ...vars.serviceEvent, serviceEventId: 511 }; return { [name]: [serviceEvent] }; }
      const payload: any = Object.values(vars).find((v) => v && typeof v === 'object' && !Array.isArray(v)) || {};
      const record = { ...payload, patientId: 42, observationId: 501, observationPanelId: 518, associatedPartyId: 502, chartPreferenceId: 503, connectionId: 504, documentId: 505, householdOccupantId: 506, longTermMedicationId: 507, prescriptionId: 508, prescriptionLogId: 509, serviceEpisodeId: 510, serviceEventId: 511, encounterId: 512, taskId: 513, favouriteMedicationId: 514, correspondenceId: 515, webformId: 516, webformDefinitionId: 517 };
      if (name === 'changeServiceEpisode') episode = { ...vars.serviceEpisode, serviceEpisodeId: 510 };
      const patientResult = Object.fromEntries(['observationPanels', 'observations', 'contacts', 'preferences', 'connections', 'documents', 'householdOccupants', 'longTermMedications', 'prescriptions', 'prescriptionLogs', 'serviceEpisodes', 'encounters', 'favouriteMedications', 'correspondences'].map((key) => [key, [record]]));
      return { [name]: [{ ...record, ...patientResult }] };
    });
    const transport = vi.fn(async (...args: any[]) => {
      if (args[0] === 'VerifyServiceEpisode') return { patient: [{ patientId: 42, serviceEpisodes: [episode] }] };
      if (['ReadServiceEventBeforeProbe', 'VerifyServiceEvent'].includes(args[0])) return { patient: [{ patientId: 42, encounters: [{ encounterId: 512 }], serviceEpisodes: [{ serviceEpisodeId: 510, serviceEvents: serviceEvent ? [serviceEvent] : [] }] }] };
      return (base as any)(...args);
    });
    mount(transport); await clickButton('Inspect read/write API'); await setContext({ serviceEventEncounterId: 512, eventService: { code: 'TEST EVENT', system: 'NH.SERVICE' }, providerId: 12, assignedUserId: 7, service: { code: 'TEST', system: 'TEST' }, serviceMrpId: 7, serviceMrp: { code: '7', display: 'Test MRP', system: 'MOIS.USER' } }); await clickButton('Run test writes');
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
    expect(variablesFor('changePatientContact').newContact).toEqual({ homePhone: '5550001', homeMessage: 'N', workPhone: '5550002', homeEmail: 'test@example.invalid' });
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

  it.each([false, true])('verifies changed form fields, definition titles, signing and resource content (apply changes: %s)', async (applyChanges) => {
    let form: any;
    let definition: any;
    let resource: any;
    const base = testHost((name, vars) => {
      if (name === 'addWebformDefinition') { definition = { ...vars.webform, webformDefinitionId: 901 }; return { [name]: [definition] }; }
      if (name === 'addWebformResource') { resource = { ...vars.resource, webformResourceId: 902 }; return { [name]: [resource] }; }
      if (name === 'addWebform') { form = { ...vars.webform, webformId: 903, documentId: 904, recordState: 'UNSIGNED' }; return { [name]: [form] }; }
      if (name === 'updateWebform') { if (applyChanges) form = { ...form, ...vars.webform }; return { [name]: [form] }; }
      if (name === 'updateWebformDefinition') { if (applyChanges) definition = { ...definition, ...vars.webformDefinition }; return { [name]: [definition] }; }
      if (name === 'signWebform') { if (applyChanges) form = { ...form, recordState: 'SIGNED' }; return { [name]: [form] }; }
      return { [name]: null };
    });
    const transport = vi.fn(async (...args: any[]) => {
      if (args[0] === 'VerifyMoisResource') return { webformResource: resource ? [{ ...resource, contents: applyChanges ? resource.contents : 'OLD CONTENT' }] : [] };
      if (args[0] === 'VerifyMoisWrite') {
        if (args[3].includes('webformDefinition(')) return { webformDefinition: definition ? [definition] : [] };
        if (args[3].includes('webform(')) return { webform: form ? [form] : [] };
      }
      return (base as any)(...args);
    });
    mount(transport); await clickButton('Inspect read/write API'); await clickButton('Run test writes');
    for (const operation of ['updateWebform', 'updateWebformDefinition', 'signWebform', 'addWebformResource']) {
      const result = reportValue().writeResults.find((row: any) => row.operation === operation);
      expect(result.status, operation).toBe(applyChanges ? 'Write verified' : 'Mutation accepted; persistence unverified');
      if (operation !== 'addWebformResource') expect(result.verificationChecks.every((check: any) => check.matched)).toBe(applyChanges);
    }
    expect(JSON.stringify(reportValue())).not.toContain('test@example.invalid');
  });

  it('does not send contact changes when the fresh phone baseline is unavailable', async () => {
    const base = testHost();
    const transport = vi.fn(async (...args: any[]) => args[0] === 'ReadContactBeforeProbe' ? { patient: [{ patientId: 42, telecom: { homePhone: null } }] } : (base as any)(...args));
    mount(transport); await clickButton('Inspect read/write API'); await clickButton('Run test writes');
    expect(transport.mock.calls.some((call: any) => call[0] === 'ProbeMoisWrite' && call[3].includes('{ changePatientContact('))).toBe(false);
    expect(reportValue().writeResults.find((row: any) => row.operation === 'changePatientContact')).toMatchObject({ status: 'Not attempted' });
  });

  it.each(['matched', 'missing', 'changedMrp', 'changedNote'])('requires an independent episode field match before exposing its ID to events: %s', async (outcome) => {
    let episode: any;
    const base = testHost((name, vars) => {
      if (name === 'changeServiceEpisode') {
        episode = { ...vars.serviceEpisode, serviceEpisodeId: 810 };
        return { [name]: [{ patientId: 42, serviceEpisodes: [episode] }] };
      }
      return { [name]: null };
    });
    const transport = vi.fn(async (...args: any[]) => {
      if (args[0] === 'ReadServiceEventBeforeProbe') return { patient: [{ patientId: 42, encounters: [{ encounterId: 512 }], serviceEpisodes: [{ serviceEpisodeId: 810, serviceEvents: [] }] }] };
      if (args[0] === 'VerifyServiceEpisode') {
        expect(args[3]).toContain('asMemberOfs { asMemberOfId providerId }');
        const record = { ...episode, ...(outcome === 'changedMrp' ? { serviceMrp: { ...episode.serviceMrp, code: '8' } } : outcome === 'changedNote' ? { note: 'OLD NOTE' } : {}) };
        return { patient: [{ patientId: 42, serviceEpisodes: outcome === 'missing' ? [] : [record] }] };
      }
      return (base as any)(...args);
    });
    mount(transport); await clickButton('Inspect read/write API');
    await setContext({ serviceEventEncounterId: 512, eventService: { code: 'TEST EVENT', system: 'NH.SERVICE' }, service: { code: 'TEST', display: 'Test service', system: 'NH.SERVICE' }, serviceMrpId: 7, serviceMrp: { code: '7', display: 'Test MRP', system: 'MOIS.USER' } });
    await clickButton('Run test writes');
    const result = reportValue().writeResults.find((row: any) => row.operation === 'changeServiceEpisode');
    expect(result.status).toBe(outcome === 'matched' ? 'Write verified' : 'Mutation accepted; persistence unverified');
    expect(result.verificationChecks).toHaveLength(13);
    expect(reportValue().createdTestRecordIds.serviceEpisodeId).toBe(outcome === 'matched' ? 810 : undefined);
    expect(transport.mock.calls.some((call: any) => call[0] === 'ProbeMoisWrite' && call[3].includes('{ changeServiceEvent('))).toBe(outcome === 'matched');
    expect(episode).toMatchObject({ encounterId: null, endDate: null, stopReason: { code: null, display: null, system: null }, stopNote: null, includeOnDemographics: { code: 'N', display: 'No', system: 'MOIS-YESNO' }, includeOnCarePlan: { code: 'N', display: 'No', system: 'MOIS-YESNO' }, asMemberOfs: [] });
    expect(JSON.stringify(reportValue())).not.toContain('Test MRP');
    if (outcome === 'matched') {
      await act(async () => {
        const select = container.querySelector<HTMLSelectElement>('select[aria-label="Write operation"]')!;
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'changeServiceEpisode'); select.dispatchEvent(new Event('change', { bubbles: true }));
        const textarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Write variable overrides JSON"]')!;
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, JSON.stringify({ changeServiceEpisode: { patientId: '$patientId', serviceEpisode: { ...episode, serviceEpisodeId: '$created.serviceEpisodeId', note: 'EXPLICIT UPDATED NOTE' } } })); textarea.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await clickButton('Run test writes');
      const calls = transport.mock.calls.filter((call: any) => call[0] === 'ProbeMoisWrite' && call[3].includes('{ changeServiceEpisode('));
      expect(calls).toHaveLength(2);
      expect(calls[1][4].serviceEpisode).toMatchObject({ serviceEpisodeId: 810, note: 'EXPLICIT UPDATED NOTE' });
      expect(reportValue().writeResults.filter((row: any) => row.operation === 'changeServiceEpisode').at(-1).status).toBe('Write verified');
      expect(reportValue().createdTestRecordIds.serviceEpisodeId).toBe(810);
    }
  });

  it.each([undefined, { code: '8', system: 'MOIS.USER' }])('does not send the episode recipe without a matching MRP pair: %s', async (serviceMrp) => {
    const transport = testHost(); mount(transport); await clickButton('Inspect read/write API');
    await setContext({ service: { code: 'TEST', system: 'NH.SERVICE' }, serviceMrpId: 7, serviceMrp });
    await clickButton('Run test writes');
    expect(transport.mock.calls.some((call: any) => call[0] === 'ProbeMoisWrite' && call[3].includes('{ changeServiceEpisode('))).toBe(false);
    expect(reportValue().writeResults.find((row: any) => row.operation === 'changeServiceEpisode')).toMatchObject({ status: 'Not attempted', error: expect.stringContaining('serviceMrp') });
  });

  it.each(['create', 'update', 'missing', 'oldPhase', 'wrongParent', 'extraEvent', 'existingId'])('requires fresh event fields and membership before retaining its ID: %s', async (outcome) => {
    const event = { serviceEventId: 901, serviceEpisodeId: 810, objectType: 'tdt_encounter', objectTypeExt: null, objectId: 512, service: { code: 'ACT30', display: 'WOUND CARE', system: 'NH.SERVICE' }, phase: { code: 'INITIAL', display: 'Initial', system: 'MOIS-SERVICEEVENTPHASE' }, healthIssues: [] };
    const updating = ['update', 'oldPhase'].includes(outcome);
    const beforeEvents = updating || outcome === 'existingId' ? [event] : [];
    let submitted: any;
    const base = testHost((name, vars) => { submitted = vars.serviceEvent; return { [name]: [{ ...submitted, serviceEventId: 901 }] }; });
    const transport = vi.fn(async (...args: any[]) => {
      if (['ReadServiceEventBeforeProbe', 'VerifyServiceEvent'].includes(args[0])) {
        expect(args[4]).toEqual({ patientId: 42 });
        expect(args[3]).toContain('$patientId: Int!');
        expect(args[3]).toContain('healthIssue { code display system }');
        const after = { ...submitted, serviceEventId: 901, ...(outcome === 'oldPhase' ? { phase: event.phase } : {}) };
        const events = args[0] === 'ReadServiceEventBeforeProbe' ? beforeEvents : outcome === 'missing' ? [] : outcome === 'extraEvent' ? [after, { ...after, serviceEventId: 902 }] : [after];
        return { patient: [{ patientId: 42, encounters: [{ encounterId: 512 }], serviceEpisodes: [{ serviceEpisodeId: args[0] === 'VerifyServiceEvent' && outcome === 'wrongParent' ? 999 : 810, serviceEvents: events }] }] };
      }
      return (base as any)(...args);
    });
    mount(transport); await clickButton('Inspect read/write API');
    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>('select[aria-label="Write operation"]')!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'changeServiceEvent'); select.dispatchEvent(new Event('change', { bubbles: true }));
      const textarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Write variable overrides JSON"]')!;
      const input = { ...event, serviceEventId: updating ? 901 : 0, ...(updating ? { phase: { code: 'FOLLOWUP', display: 'Follow Up', system: 'MOIS-SERVICEEVENTPHASE' } } : {}) };
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, JSON.stringify({ changeServiceEvent: { serviceEpisodeId: 810, serviceEvent: input } })); textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clickButton('Run test writes');
    const passed = ['create', 'update'].includes(outcome);
    expect(reportValue().writeResults.at(-1).status).toBe(passed ? 'Write verified' : 'Mutation accepted; persistence unverified');
    expect(reportValue().createdTestRecordIds.serviceEventId).toBe(passed ? 901 : undefined);
    expect(transport.mock.calls.filter((call) => call[0] === 'ProbeMoisWrite')).toHaveLength(1);
    expect(JSON.stringify(reportValue())).not.toContain('WOUND CARE');
  });

  it.each(['missingParent', 'missingEncounter', 'wrongPatient'])('rejects an event link without fresh same-patient context: %s', async (outcome) => {
    const base = testHost();
    const transport = vi.fn(async (...args: any[]) => args[0] === 'ReadServiceEventBeforeProbe' ? { patient: [{ patientId: outcome === 'wrongPatient' ? 99 : 42, encounters: outcome === 'missingEncounter' ? [] : [{ encounterId: 512 }], serviceEpisodes: outcome === 'missingParent' ? [] : [{ serviceEpisodeId: 810, serviceEvents: [] }] }] } : (base as any)(...args));
    mount(transport); await clickButton('Inspect read/write API');
    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>('select[aria-label="Write operation"]')!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'changeServiceEvent'); select.dispatchEvent(new Event('change', { bubbles: true }));
      const textarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Write variable overrides JSON"]')!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, JSON.stringify({ changeServiceEvent: { serviceEpisodeId: 810, serviceEvent: { serviceEventId: 0, serviceEpisodeId: 810, objectType: 'tdt_encounter', objectTypeExt: null, objectId: 512, service: { code: 'TEST', system: 'NH.SERVICE' }, phase: { code: 'INITIAL', system: 'MOIS-SERVICEEVENTPHASE' }, healthIssues: [] } } })); textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clickButton('Run test writes');
    expect(reportValue().writeResults.at(-1).status).toBe('Not attempted');
    expect(transport.mock.calls.some((call) => call[0] === 'ProbeMoisWrite')).toBe(false);
  });

  it.each(['firstChild', 'mixed', 'reordered', 'missingExisting', 'changedExisting', 'reusedId', 'zeroId', 'duplicateId', 'wrongParent', 'ambiguous'])('reconciles generated child IDs only after an exact independent match: %s', async (outcome) => {
    const existing = { serviceEventHealthIssueId: 71, serviceEventId: 901, healthIssue: { code: 'OLD', display: 'Private existing diagnosis', system: 'ICD-9' }, certainty: { code: 'Confirmed', display: 'CONFIRMED', system: 'MOIS-CONDITIONCERTAINTY' } };
    const added = { serviceEventHealthIssueId: 0, serviceEventId: 901, healthIssue: { code: 'NEW', display: 'Private new diagnosis', system: 'SNOMED-CT' }, certainty: { code: 'Impression', display: 'IMPRESSION', system: 'MOIS-CONDITIONCERTAINTY' } };
    const event = { serviceEventId: 901, serviceEpisodeId: 810, objectType: 'tdt_encounter', objectTypeExt: null, objectId: 512, service: { code: 'ACT30', system: 'NH.SERVICE' }, phase: { code: 'FOLLOWUP', system: 'MOIS-SERVICEEVENTPHASE' }, healthIssues: outcome === 'firstChild' ? [] : [existing] };
    const submitted = { ...event, healthIssues: outcome === 'firstChild' ? [added] : outcome === 'ambiguous' ? [existing, added, added] : [existing, added] };
    const actualNew = { ...added, serviceEventHealthIssueId: outcome === 'reusedId' ? 99 : outcome === 'zeroId' ? 0 : outcome === 'duplicateId' ? 71 : 72, serviceEventId: outcome === 'wrongParent' ? 999 : 901 };
    let actualChildren = outcome === 'firstChild' || outcome === 'missingExisting' ? [actualNew] : [{ ...existing, ...(outcome === 'changedExisting' ? { certainty: { code: 'Impression', display: 'IMPRESSION', system: 'MOIS-CONDITIONCERTAINTY' } } : {}) }, actualNew];
    if (outcome === 'reordered') actualChildren.reverse();
    if (outcome === 'ambiguous') actualChildren.push({ ...actualNew, serviceEventHealthIssueId: 73 });
    const base = testHost((name) => ({ [name]: [{ ...submitted, healthIssues: [existing, { ...added, serviceEventHealthIssueId: 72 }] }] }));
    const transport = vi.fn(async (...args: any[]) => {
      if (['ReadServiceEventBeforeProbe', 'VerifyServiceEvent'].includes(args[0])) return { patient: [{ patientId: 42, encounters: [{ encounterId: 512 }], serviceEpisodes: [
        { serviceEpisodeId: 810, serviceEvents: [args[0] === 'ReadServiceEventBeforeProbe' ? event : { ...event, healthIssues: actualChildren }] },
        { serviceEpisodeId: 811, serviceEvents: [{ serviceEventId: 902, healthIssues: [{ ...added, serviceEventHealthIssueId: 99, serviceEventId: 902 }] }] },
      ] }] };
      return (base as any)(...args);
    });
    mount(transport); await clickButton('Inspect read/write API');
    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>('select[aria-label="Write operation"]')!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'changeServiceEvent'); select.dispatchEvent(new Event('change', { bubbles: true }));
      const textarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Write variable overrides JSON"]')!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, JSON.stringify({ changeServiceEvent: { serviceEpisodeId: 810, serviceEvent: submitted } })); textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clickButton('Run test writes');
    const passed = ['firstChild', 'mixed', 'reordered'].includes(outcome);
    const report = reportValue(); const result = report.writeResults.at(-1);
    expect(result.status).toBe(passed ? 'Write verified' : 'Mutation accepted; persistence unverified');
    expect(result.healthIssueRecordIds).toEqual(passed ? actualChildren.map((child) => child.serviceEventHealthIssueId) : undefined);
    expect(report.createdTestRecordIds.serviceEventId).toBe(passed ? 901 : undefined);
    expect(JSON.stringify(report)).not.toContain('Private new diagnosis');
    expect(JSON.stringify(report)).not.toContain('Private existing diagnosis');
  });

  it.each([
    { input: 'null', outcome: 'preserved', passed: true },
    { input: 'omitted', outcome: 'preserved', passed: true },
    { input: 'null', outcome: 'cleared', passed: false },
    { input: 'omitted', outcome: 'changedId', passed: false },
    { input: 'null', outcome: 'changedValue', passed: false },
    { input: 'omitted', outcome: 'missingBaseline', passed: false },
    { input: 'null', outcome: 'nullBaseline', passed: false },
    { input: 'empty', outcome: 'cleared', passed: true },
    { input: 'empty', outcome: 'preserved', passed: false },
    { input: 'empty', outcome: 'nullResult', passed: false },
    { input: 'null', outcome: 'phaseChanged', passed: true },
    { input: 'omitted', outcome: 'phaseChanged', passed: true },
    { input: 'null', outcome: 'oldPhase', passed: false },
  ])('verifies child preservation or clearing against the independent baseline: $input / $outcome', async ({ input, outcome, passed }) => {
    const child = { serviceEventHealthIssueId: 71, serviceEventId: 901, healthIssue: { code: 'TEST', display: 'Private child coding', system: 'ICD-9' }, certainty: { code: 'Confirmed', system: 'MOIS-CONDITIONCERTAINTY' } };
    const before: any = { serviceEventId: 901, serviceEpisodeId: 810, objectType: 'tdt_encounter', objectTypeExt: null, objectId: 512, service: { code: 'ACT30', system: 'NH.SERVICE' }, phase: { code: 'FOLLOWUP', system: 'MOIS-SERVICEEVENTPHASE' }, healthIssues: [child] };
    const submitted: any = { ...before, healthIssues: input === 'empty' ? [] : null };
    if (input === 'omitted') delete submitted.healthIssues;
    if (['phaseChanged', 'oldPhase'].includes(outcome)) submitted.phase = { code: 'INITIAL', system: 'MOIS-SERVICEEVENTPHASE' };
    if (outcome === 'missingBaseline') delete before.healthIssues;
    if (outcome === 'nullBaseline') before.healthIssues = null;
    const after = { ...before, phase: outcome === 'oldPhase' ? before.phase : submitted.phase,
      healthIssues: outcome === 'cleared' ? [] : outcome === 'nullResult' ? null : [{ ...child,
        ...(outcome === 'changedId' ? { serviceEventHealthIssueId: 72 } : {}),
        ...(outcome === 'changedValue' ? { certainty: { ...child.certainty, code: 'Impression' } } : {}),
      }] };
    // An apparently correct mutation echo must not override a failed reread.
    const base = testHost((name) => ({ [name]: [{ ...before, ...submitted, healthIssues: input === 'empty' ? [] : [child] }] }));
    const transport = vi.fn(async (...args: any[]) => {
      if (['ReadServiceEventBeforeProbe', 'VerifyServiceEvent'].includes(args[0])) return { patient: [{ patientId: 42, encounters: [{ encounterId: 512 }], serviceEpisodes: [{ serviceEpisodeId: 810, serviceEvents: [args[0] === 'ReadServiceEventBeforeProbe' ? before : after] }] }] };
      return (base as any)(...args);
    });
    mount(transport); await clickButton('Inspect read/write API');
    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>('select[aria-label="Write operation"]')!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'changeServiceEvent'); select.dispatchEvent(new Event('change', { bubbles: true }));
      const textarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Write variable overrides JSON"]')!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, JSON.stringify({ changeServiceEvent: { serviceEpisodeId: 810, serviceEvent: submitted } })); textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clickButton('Run test writes');
    const blocked = ['missingBaseline', 'nullBaseline'].includes(outcome);
    const result = reportValue().writeResults.at(-1);
    expect(result.status).toBe(blocked ? 'Not attempted' : passed ? 'Write verified' : 'Mutation accepted; persistence unverified');
    const sent = transport.mock.calls.filter((call) => call[0] === 'ProbeMoisWrite');
    expect(sent).toHaveLength(blocked ? 0 : 1);
    if (!blocked) {
      expect(Object.prototype.hasOwnProperty.call(sent[0][4].serviceEvent, 'healthIssues')).toBe(input !== 'omitted');
      expect(result.healthIssueVerificationMode).toBe(input === 'empty' ? 'Match submitted list' : 'Preserve baseline list');
      expect(result.verificationChecks.some((check: any) => check.field === 'serviceEvent.healthIssues')).toBe(true);
    }
    expect(result.healthIssueRecordIds).toEqual(passed ? input === 'empty' ? [] : [71] : undefined);
    expect(reportValue().createdTestRecordIds.serviceEventId).toBe(passed ? 901 : undefined);
    expect(JSON.stringify(reportValue())).not.toContain('Private child coding');
  });

  it.each(['omitted', 'null'])('requires an explicit child array for a new event: %s', async (input) => {
    const transport = testHost(); mount(transport); await clickButton('Inspect read/write API');
    const event: any = { serviceEventId: 0, serviceEpisodeId: 810, objectType: 'tdt_encounter', objectTypeExt: null, objectId: 512, service: { code: 'TEST', system: 'NH.SERVICE' }, phase: { code: 'INITIAL', system: 'MOIS-SERVICEEVENTPHASE' } };
    if (input === 'null') event.healthIssues = null;
    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>('select[aria-label="Write operation"]')!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'changeServiceEvent'); select.dispatchEvent(new Event('change', { bubbles: true }));
      const textarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Write variable overrides JSON"]')!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, JSON.stringify({ changeServiceEvent: { serviceEpisodeId: 810, serviceEvent: event } })); textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clickButton('Run test writes');
    expect(reportValue().writeResults.at(-1)).toMatchObject({ status: 'Not attempted', error: expect.stringContaining('explicit healthIssues array') });
    expect(transport.mock.calls.some((call) => call[0] === 'ProbeMoisWrite')).toBe(false);
  });

  it('checks nickname primitives even when MOIS formats the text differently', async () => {
    let nickname: any;
    const base = testHost((name, vars) => { if (name === 'changePatientName') nickname = vars.newNickName; return { [name]: [{ patientId: 42 }] }; });
    const transport = vi.fn(async (...args: any[]) => args[0] === 'VerifyMoisWrite' && args[3].includes('nickName') ? { patient: [{ patientId: 42, nickName: { first: nickname.first, family: nickname.family, text: 'TEST, WEBFORMS' } }] } : (base as any)(...args));
    mount(transport); await clickButton('Inspect read/write API'); await clickButton('Run test writes');
    expect(reportValue().writeResults.find((row: any) => row.operation === 'changePatientName')).toMatchObject({ status: 'Write verified', verificationChecks: [{ field: 'nickName.first', matched: true }, { field: 'nickName.family', matched: true }] });
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
