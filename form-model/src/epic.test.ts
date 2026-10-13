import { describe, expect, it } from 'vitest';
import { normalizeEpicExportSettings, readEpicExportSettings, type EpicExportSettings } from './epic';
import { BuilderDocumentSchema, EpicExportSettingsSchema, WorkspaceDocumentV3Schema } from './schemas';
import { normalizeExportTargetsSetting } from './targets';

function configuredSettings(): EpicExportSettings {
  return {
    version: 1,
    site: {
      issuer: 'https://ehr.example.org/FHIR/R4', clientId: 'public-client-id', redirectUri: 'https://forms.example.org/epic/callback.html',
      authorizationOrigins: ['https://login.example.org'], scopeVersion: 'v2', launchMode: 'ehr', observationNoteLimit: 254,
    },
    readMappings: [
      { fieldId: 'mrn', source: 'patient', path: 'identifier', identifierSystem: 'urn:oid:1.2.3' },
      { fieldId: 'started', source: 'encounter', path: 'period.start' },
      { fieldId: 'previous', source: 'observation', path: 'valueCodeableConcept', coding: { system: 'http://loinc.org', code: '1234-5' },
        answers: [{ value: ' local value ', system: 'urn:oid:1.2.4', code: ' customer answer ', display: 'Reviewed answer' }] },
    ],
    observationMappings: [
      { fieldId: 'systolic', diastolicFieldId: 'diastolic', coding: { system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure' },
        valueType: 'blood-pressure', unit: { code: 'mm[Hg]', display: 'mmHg' }, commentsFieldId: 'comments', template: { system: 'urn:oid:1.2.5', value: 'VITALS' } },
      { fieldId: 'answer', coding: { system: 'http://open.epic.com/FHIR/StructureDefinition/observation-flowsheet-id', code: 'encoded-row-id' },
        valueType: 'coding', answers: [{ value: 'yes', code: '1', system: 'urn:oid:1.2.6' }] },
    ],
    note: { enabled: true, type: { system: 'http://loinc.org', code: '11506-3' }, docStatus: 'preliminary', fieldIds: ['systolic', 'diastolic', 'comments'] },
    questionnaire: { enabled: true, canonical: 'https://ehr.example.org/Questionnaire/assigned', status: 'in-progress', questions: [
      { fieldId: 'answer', linkId: 'exact-create-link-id', answerType: 'string', answers: [{ value: 'yes', code: 'Epic category' }] },
      { fieldId: 'duration', linkId: 'time-unit-create-link-id', answerType: 'quantity', unit: { code: 'min' } },
    ] },
  };
}

describe('Epic target settings', () => {
  it('keeps absent, non-object and future settings absent and supplies an unconfigured, unsigned default', () => {
    for (const value of [undefined, null, false, 'epic', [], { version: 2 }, { version: '1' }]) {
      expect(normalizeEpicExportSettings(value)).toBeUndefined();
    }
    expect(readEpicExportSettings(undefined)).toEqual({
      version: 1,
      site: { issuer: '', clientId: '', redirectUri: '', authorizationOrigins: [], scopeVersion: 'v1', launchMode: 'both', observationNoteLimit: 60 },
      readMappings: [], observationMappings: [],
      note: { enabled: false, type: { system: '', code: '' }, docStatus: 'preliminary', fieldIds: [] },
      questionnaire: { enabled: false, canonical: '', status: 'completed', questions: [] },
    });
  });

  it('preserves all explicitly configured clinical channels, including the blood-pressure pair', () => {
    const settings = configuredSettings();
    expect(normalizeEpicExportSettings(settings)).toEqual(settings);
    expect(EpicExportSettingsSchema.parse(settings)).toEqual(settings);
  });

  it('retains incomplete and duplicate rows so export review can identify the authored mistakes', () => {
    const settings = normalizeEpicExportSettings({
      readMappings: [{ fieldId: ' name ', source: 'patient', path: '' }, { fieldId: 'name', source: 'patient', path: 'name.text' }],
      observationMappings: [{ fieldId: ' weight ', coding: { system: 'http://loinc.org', code: '' }, unit: { code: '' }, template: {} }, { fieldId: 'weight' }],
      questionnaire: { questions: [{ fieldId: ' weight ', linkId: '' }, { fieldId: 'weight', linkId: 'same' }, { fieldId: 'other', linkId: 'same' }] },
    });
    expect(settings?.readMappings).toEqual([{ fieldId: 'name', source: 'patient', path: '' }, { fieldId: 'name', source: 'patient', path: 'name.text' }]);
    expect(settings?.observationMappings).toEqual([
      { fieldId: 'weight', coding: { system: 'http://loinc.org', code: '' }, valueType: 'quantity', unit: { code: '' }, template: { system: '', value: '' } },
      { fieldId: 'weight', coding: { system: '', code: '' }, valueType: 'quantity' },
    ]);
    expect(settings?.questionnaire.questions.map(({ fieldId, linkId }) => ({ fieldId, linkId }))).toEqual([
      { fieldId: 'weight', linkId: '' }, { fieldId: 'weight', linkId: 'same' }, { fieldId: 'other', linkId: 'same' },
    ]);
    expect(EpicExportSettingsSchema.parse(settings)).toEqual(settings);
  });

  it('strips credentials, chart payloads and verification claims from every settings object', () => {
    const source = configuredSettings();
    const poison = { access_token: 'NEVER_PERSIST', refresh_token: 'NEVER_PERSIST', clientSecret: 'NEVER_PERSIST', patient: 'NEVER_PERSIST', runtimeVerified: 'NEVER_PERSIST' };
    const input = {
      ...source, ...poison, site: { ...source.site, ...poison },
      readMappings: source.readMappings.map((row) => ({ ...row, ...poison, ...(row.coding ? { coding: { ...row.coding, ...poison } } : {}), ...(row.answers ? { answers: row.answers.map((answer) => ({ ...answer, ...poison })) } : {}) })),
      observationMappings: source.observationMappings.map((row) => ({ ...row, ...poison, coding: { ...row.coding, ...poison }, ...(row.unit ? { unit: { ...row.unit, ...poison } } : {}), ...(row.template ? { template: { ...row.template, ...poison } } : {}), ...(row.answers ? { answers: row.answers.map((answer) => ({ ...answer, ...poison })) } : {}) })),
      note: { ...source.note, ...poison, type: { ...source.note.type, ...poison } },
      questionnaire: { ...source.questionnaire, ...poison, questions: source.questionnaire.questions.map((row) => ({ ...row, ...poison, ...(row.unit ? { unit: { ...row.unit, ...poison } } : {}), ...(row.answers ? { answers: row.answers.map((answer) => ({ ...answer, ...poison })) } : {}) })) },
    };
    for (const clean of [normalizeEpicExportSettings(input), EpicExportSettingsSchema.parse(input)]) {
      expect(clean).toEqual(source);
      expect(JSON.stringify(clean)).not.toContain('NEVER_PERSIST');
    }
  });

  it('preserves exact stored answer values and customer answer codes while cleaning labels and identifiers', () => {
    const settings = normalizeEpicExportSettings({
      readMappings: [{ fieldId: ' choice ', source: 'observation', path: ' valueCodeableConcept ', answers: [{ value: '  answer  ', code: '  category  ', system: ' urn:oid:1.2.3 ', display: ' Label ' }] }],
    });
    expect(settings?.readMappings[0]).toEqual({ fieldId: 'choice', source: 'observation', path: 'valueCodeableConcept', answers: [{ value: '  answer  ', code: '  category  ', system: 'urn:oid:1.2.3', display: 'Label' }] });
  });

  it('requires explicit booleans for enabling a write or development HTTP and never infers a signed note', () => {
    const settings = normalizeEpicExportSettings({ site: { allowLoopbackHttp: 'true', observationNoteLimit: 999 }, note: { enabled: 'true', docStatus: 'signed' }, questionnaire: { enabled: 1 } });
    expect(settings?.site).not.toHaveProperty('allowLoopbackHttp');
    expect(settings?.site.observationNoteLimit).toBe(60);
    expect(settings?.note).toMatchObject({ enabled: false, docStatus: 'preliminary' });
    expect(settings?.questionnaire.enabled).toBe(false);
    expect(readEpicExportSettings({ epicExport: { note: { enabled: true, docStatus: 'final' } } }).note).toMatchObject({ enabled: true, docStatus: 'final' });
  });

  it.each([
    ['future version', (settings: EpicExportSettings) => ({ ...settings, version: 2 })],
    ['unsupported OAuth mode', (settings: EpicExportSettings) => ({ ...settings, site: { ...settings.site, launchMode: 'backend' } })],
    ['unsupported read source', (settings: EpicExportSettings) => ({ ...settings, readMappings: [{ fieldId: 'x', source: 'binary', path: 'data' }] })],
    ['unsupported observation type', (settings: EpicExportSettings) => ({ ...settings, observationMappings: [{ fieldId: 'x', coding: { system: '', code: '' }, valueType: 'reference' }] })],
    ['unsupported note status', (settings: EpicExportSettings) => ({ ...settings, note: { ...settings.note, docStatus: 'amended' } })],
    ['unsupported questionnaire answer', (settings: EpicExportSettings) => ({ ...settings, questionnaire: { ...settings.questionnaire, questions: [{ fieldId: 'x', linkId: 'q', answerType: 'attachment' }] } })],
  ])('rejects a %s in the typed document schema', (_label, change) => {
    expect(EpicExportSettingsSchema.safeParse(change(configuredSettings())).success).toBe(false);
  });

  it('round-trips the public configuration through both canonical document schemas and keeps Epic target order', () => {
    const settings = configuredSettings();
    const document = { name: 'Epic form', fields: [], design: {}, identityType: 'TESTFORM', identityCode: 'EPIC', drafts: [], branchingRules: {}, paginationEnabled: false, pageCount: 1, pageAssignments: {}, epicExport: settings, exportTargets: { primary: 'epic', secondary: ['oscar', 'fhir'] } };
    expect(BuilderDocumentSchema.parse(JSON.parse(JSON.stringify(document))).epicExport).toEqual(settings);
    const workspace = { version: 3, document, fieldLinkRules: [] };
    expect(WorkspaceDocumentV3Schema.parse(JSON.parse(JSON.stringify(workspace))).document.epicExport).toEqual(settings);
    expect(normalizeExportTargetsSetting(document.exportTargets)).toEqual({ primary: 'epic', secondary: ['fhir', 'oscar'] });
    expect(BuilderDocumentSchema.parse({ ...document, epicExport: undefined }).epicExport).toBeUndefined();
    expect(BuilderDocumentSchema.parse({ ...document, epicExport: null }).epicExport).toBeNull();
  });

  it('returns independent copies so one edit cannot change an earlier document or a future default', () => {
    const input = configuredSettings();
    const before = JSON.stringify(input);
    const normalized = normalizeEpicExportSettings(input)!;
    normalized.site.authorizationOrigins.push('https://second.example.org');
    normalized.observationMappings[0].coding.code = 'changed';
    normalized.questionnaire.questions[0].answers![0].value = 'changed';
    expect(JSON.stringify(input)).toBe(before);
    readEpicExportSettings(undefined).note.fieldIds.push('not-a-default');
    expect(readEpicExportSettings(undefined).note.fieldIds).toEqual([]);
  });
});
