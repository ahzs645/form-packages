import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import * as Babel from '@babel/standalone';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildClientSchema, parse, validate } = require('graphql') as typeof import('graphql');
const { getVariableValues } = require('graphql/execution/values.js') as typeof import('graphql/execution/values.js');
const schemaData = JSON.parse(fs.readFileSync('data/mois-second-instance-schema.json', 'utf8')).schema;
for (const t of schemaData.types) if (['OBJECT', 'INTERFACE'].includes(t.kind)) t.interfaces ??= [];
schemaData.directives ??= [];
const schema = buildClientSchema({ __schema: schemaData });
const plan = JSON.parse(fs.readFileSync('data/mois-comprehensive-suite.json', 'utf8'));
const compiled = Babel.transform(fs.readFileSync('packages/form-components/src/nhforms/PatientContextQueryTest/index.jsx', 'utf8'), { presets: ['react'] }).code!;
const suite = new Function(`${compiled}; return runPatientContextVariantSuite;`)();
const clone = (v: any) => JSON.parse(JSON.stringify(v));
function setup(options: any = {}) {
  let tasks: any[] = [{ taskId: 100, patientId: 42, encounterId: 5, description: 'PREEXISTING', note: 'keep', isComplete: {code:'N',display:'No',system:'MOIS-YESNO'} }];
  let n = 200, stopped = false, unknown = false;
  let latest: any;
  const writes: any[] = [];
  const request = vi.fn(async (operation: string, query: string, vars: any, mutation = false) => {
    const errors = validate(schema, parse(query)); expect(errors.map((e: any) => e.message), query).toEqual([]);
    if (operation === 'SuiteSchema') return { __schema: schemaData };
    if (operation === 'SuiteContext') return { patient: [{ patientId: options.wrongPatient ? 99 : 42, encounters: [{ encounterId: 5, providerId: 6 }], serviceEpisodes: [] }] };
    if (operation === 'SuiteProfile') return { userProfile: [{ userProfileId: 7, loginName: 'TEST', identity: { fullName: 'TEST USER' } }] };
    if (operation === 'SuiteCreate') {
      writes.push(clone(vars));
      const t = { ...vars.newTask, taskId: n++, patientId: 42, encounterId: 5, documentId: null, createdDate: '2026-09-11', isComplete: { code: 'N', display: 'No', system: 'MOIS-YESNO' }, isAcknowledged: { code: 'N', display: 'No', system: 'MOIS-YESNO' }, acknowledgedBy: null, acknowledgedDate: null, completedBy: null, completedDate: null };
      tasks.push(t);
      return { createEncounterTask: [clone(t)] };
    }
    if (operation === 'SuiteChange') {
      writes.push(clone(vars));
      const row = tasks.find(t => t.taskId === vars.task.taskId);
      if (options.timeout) { unknown = true; throw new Error('Query timed out after 30 seconds.'); }
      if (options.reject && options.reject(vars.task)) throw new Error('Server rejected candidate');
      Object.assign(row, clone(vars.task));
      if (options.omitClears && !Object.hasOwn(vars.task, 'completedBy')) row.completedBy = null;
      if (options.sideEffect) tasks[0].note = 'UNEXPECTED';
      if (options.stop) stopped = true;
      return { changeTask: [clone(row)] };
    }
    if (operation === 'SuiteVerify') return { task: clone(tasks) };
    throw new Error('Unexpected operation ' + operation);
  });
  const run = async (fields = ['completedBy'], previous?: any) => {
    const profile = { ...plan.profiles.find((p: any) => p.key === 'tasks'), fields };
    return suite({ request, patientId: 42, patient: {}, sourceProfile: { userProfileId: 7 }, context: {}, plan: {...plan, profiles:[profile]}, previous, active: () => !stopped, uncertain: () => unknown, emit: (v: any) => { latest = clone(v); } });
  };
  return { run, request, writes, tasks: () => tasks, latest: () => latest };
}
describe('comprehensive MOIS suite', () => {
  it('sets, omits, clears, sets again, empties and restores on a new task with separate reads', async () => {
    const h = setup(); const result = await h.run();
    expect(result.cases.find((x: any) => x.id === 'tasks.create.seed').status).toBe('Create verified');
    expect(result.cases.find((x: any) => x.id === 'tasks.completedBy.set').status).toBe('Write verified');
    expect(result.cases.find((x: any) => x.id === 'tasks.completedBy.omit').status).toBe('Omission preserved value');
    expect(result.cases.find((x: any) => x.id === 'tasks.completedBy.null').status).toBe('Write verified');
    expect(result.cases.find((x: any) => x.id === 'tasks.completedBy.restore').status).toBe('Restoration verified');
    expect(h.tasks()[1].completedBy).toBe(null); expect(h.tasks()[0].note).toBe('keep');
    expect(h.writes.some((v: any) => v.task && !Object.hasOwn(v.task,'completedBy'))).toBe(true);
    expect(h.writes.filter((v: any) => v.task).every((v: any) => v.task.taskId === 200 && !Object.hasOwn(v.task,'stamp'))).toBe(true);
    const before = h.writes.length; await h.run(['completedBy'], result); expect(h.writes).toHaveLength(before);
  });
  it('records clearing on omission instead of assuming preservation', async () => {
    const h = setup({ omitClears: true }); const r = await h.run();
    expect(r.cases.find((x: any) => x.id.endsWith('.omit')).status).toBe('Omission cleared value');
  });
  it('reads independently after a rejected mutation and does not report success from an echo', async () => {
    const h = setup({ reject: (task: any) => task.completedBy === 'TEST USER' }); const r = await h.run();
    expect(r.cases.find((x: any) => x.id === 'tasks.completedBy.set').status).toBe('Rejected; selected read unchanged');
    const calls = h.request.mock.calls; const writeAt = calls.findIndex(x => x[0] === 'SuiteChange');
    expect(calls[writeAt + 1][0]).toBe('SuiteVerify');
  });
  it('stops dependent variants on an unrelated record change', async () => {
    const h = setup({ sideEffect: true }); const r = await h.run(['completedBy','note']);
    expect(r.cases.find((x: any) => x.id === 'tasks.completedBy.set').status).toBe('Unexpected changes; profile stopped');
    expect(h.writes).toHaveLength(2);
  });
  it('halts on timeout, retaining uncertain outcome instead of interpreting an immediate unchanged read as rollback', async () => {
    const h = setup({ timeout: true }); const r = await h.run();
    expect(r.status).toContain('uncertain write'); expect(h.writes).toHaveLength(2);
    expect(r.cases.find((x: any) => x.id === 'tasks.completedBy.set').status).toBe('Outcome requires inspection');
  });
  it('blocks all suite writes if context belongs to another patient', async () => {
    const h = setup({wrongPatient:true}); await expect(h.run()).rejects.toThrow('Context verification failed'); expect(h.writes).toHaveLength(0);
  });
  it('tests name/date omission and null while both task flags are enabled, then restores', async () => {
    const h = setup(); const r = await h.run([]);
    expect(r.cases.find((c: any) => c.id === 'tasks.workflow.acknowledgedBy.omit').status).toBe('Omission preserved value');
    const metadataWrites = h.writes.filter(v => v.task?.acknowledgedBy === 'TEST USER');
    expect(metadataWrites.some(v => v.task.isAcknowledged.code === 'Y' && v.task.isComplete.code === 'Y')).toBe(true);
    expect(h.tasks()[1]).toMatchObject({acknowledgedBy:null,completedBy:null,isAcknowledged:{code:'N'},isComplete:{code:'N'}});
  });
  it('stops on failed restoration and leaves the original value in the evidence', async () => {
    const h = setup({reject:(task: any) => task.completedBy === null}); const r = await h.run(['completedBy','description']);
    expect(r.cases.find((c: any) => c.id === 'tasks.completedBy.restore').stopProfile).toBe(true);
    expect(r.origins.tasks.record.completedBy).toBe(null);
    expect(r.cases.some((c: any) => c.id === 'tasks.description.set')).toBe(false);
  });
  it('includes unexercised input fields and operations, rather than labeling the schema tested', async () => {
    const h = setup(); const r = await h.run();
    expect(r.fieldCoverage.find((x: any) => x.operation === 'changeTask' && x.field === 'assignedTeamId').status).toContain('Not exercised');
    expect(r.operationCoverage.find((x: any) => x.operation === 'sendFax').status).toContain('Separate');
  });
});

// Validate every generated profile query and input against the captured MOIS schema.
// This transport deliberately models a successful echo + separate persisted reads;
// production database behavior is established only by a returned live report.
describe('all profile contracts', () => {
  const named = (t: any): any => t.ofType ? named(t.ofType) : t;
  const typeMap = new Map<string, any>(schemaData.types.map((t: any) => [t.name, t]));
  const profileCases: [string, any][] = plan.profiles.map((p: any) => [p.key, p]);
  it.each(profileCases)('%s uses schema-valid reads and variables', async (_key: string, profile: any) => {
    const failures: string[] = [], operations: string[] = [];
    const coding = {code:'TEST',display:'Test',system:'TEST'};
    const blank = (type: string) => Object.fromEntries((typeMap.get(type)?.fields || []).map((f: any) => [f.name, null]));
    let rows: any[] = profile.existingFallback ? [{...blank(profile.type), [profile.id]: profile.id === 'patientId' ? 42 : 901, ...(profile.id !== 'patientId' ? {patientId:42} : {}), ...(profile.type === 'Patient' ? {patientId:42} : {})}] : [];
    let nextId = 902;
    const ctx: any = { userProfileId:7, encounterId:5, providerId:6, userName:'TEST USER', service:coding, serviceMrp:{code:'7',system:'MOIS.USER'},serviceMrpId:7,eventService:coding,healthIssue:coding,appointmentStatus:coding };
    const request = async (operation: string, text: string, vars: any, mutation = false) => {
      const doc = parse(text), errors = validate(schema, doc);
      const definition: any = doc.definitions.find((d: any) => d.kind === 'OperationDefinition');
      const variables = getVariableValues(schema, definition.variableDefinitions, vars);
      failures.push(...errors.map(e => e.message), ...((variables as any).errors || []).map((e: any) => e.message));
      operations.push(operation);
      if (errors.length || (variables as any).errors?.length) throw new Error('Schema contract failure: ' + failures.join('; '));
      const root = definition.selectionSet.selections[0].name.value;
      if (operation === 'SuiteSchema') return {__schema:schemaData};
      if (operation === 'SuiteContext') return {patient:[{patientId:42,encounters:[{encounterId:5,providerId:6}],conditions:[],serviceEpisodes:[]}]};
      if (operation === 'SuiteProfile') return {userProfile:[{userProfileId:7,identity:{fullName:'TEST USER'}}]};
      if (operation === 'SuiteCreate') {
        let seed = vars[profile.inputArg]; if (Array.isArray(seed)) seed = seed[0];
        const r = {...blank(profile.type),...clone(seed),[profile.id]:nextId++};
        if (profile.readRoot !== 'webformDefinition' && !['resources','favourites'].includes(profile.key)) r.patientId=42;
        if (profile.key === 'forms') {r.documentId=800; r.recordState='UNSIGNED';}
        rows.push(r); return {[root]:[clone(r)]};
      }
      if (operation === 'SuiteChange') {
        let seed = vars[profile.updateArg || profile.inputArg]; if (Array.isArray(seed)) seed = seed[0];
        const r = rows.find(x => x[profile.id] === seed[profile.id]) || rows[0];
        Object.assign(r,clone(seed)); return {[root]:[clone(r)]};
      }
      if (mutation) throw new Error('Specialized behavior tested separately');
      if (operation === 'SuiteFile') return {document:[{documentId:rows[0]?.documentId,patientId:42,encodedFile:null}]};
      if (profile.readRoot === 'patient' && !profile.path.length) return {patient:clone(rows)};
      let value: any = clone(rows);
      for (const segment of [...profile.path].reverse()) value = [{[segment]: profile.objectPath ? value[0] : value}];
      if (['patient','encounter'].includes(profile.readRoot)) value=value.map((r: any) => ({...r,patientId:42,...(profile.readRoot === 'encounter' ? {encounterId:5} : {})}));
      return {[profile.readRoot]:value};
    };
    const previous: any = {revision:plan.revision,cases:[],ids:{episodes:900,definitions:899,documents:898,prescriptions:897},origins:{},created:[],fieldCoverage:[]};
    delete previous.ids[profile.key];
    const result = await suite({request,patientId:42,patient:{},sourceProfile:{userProfileId:7},context:ctx,plan:{...plan,profiles:[{...profile, delete:null, lifecycle:false, healthIssues:false, taskMetadata:false, encounterStatus:false, rejectedUpdateProbe:false}]},previous,active:()=>true,uncertain:()=>false,emit:()=>{}});
    expect(failures).toEqual([]);
    if (profile.create) expect(operations, JSON.stringify(result.cases)).toContain('SuiteCreate');
    if (profile.fields.length) expect(operations, JSON.stringify(result.cases)).toContain('SuiteChange');
    expect(result.cases.filter((c: any) => /Unknown (input|argument)|Missing input contract|Invalid (enum|text|integer|boolean)/.test(c.error || ''))).toEqual([]);
  });
});
