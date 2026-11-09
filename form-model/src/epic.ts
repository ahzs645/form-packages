/** Epic deployment overrides. Clinical intent remains in the neutral field bindings. */
export interface EpicCoding { system: string; code: string; display?: string }
export interface EpicUnit { code: string; display?: string }
export interface EpicAnswerMapping { value: string; code: string; system?: string; display?: string }

/** A reviewed scalar projection; arbitrary FHIRPath or JavaScript is never executed. */
export interface EpicReadMapping {
  fieldId: string;
  source: 'patient' | 'encounter' | 'observation';
  path: string;
  coding?: EpicCoding;
  identifierSystem?: string;
  unit?: EpicUnit;
  answers?: EpicAnswerMapping[];
}

/** Maps an existing neutral observation write to the site's actual flowsheet destination. */
export interface EpicObservationMapping {
  fieldId: string;
  coding: EpicCoding;
  valueType: 'quantity' | 'string' | 'coding' | 'time' | 'blood-pressure';
  /** The second numeric source when the mapping files a blood-pressure pair. */
  diastolicFieldId?: string;
  unit?: EpicUnit;
  answers?: EpicAnswerMapping[];
  commentsFieldId?: string;
  /** Optional local flowsheet-template identifier. Requires site support. */
  template?: { system: string; value: string };
}

export interface EpicNoteSettings {
  enabled: boolean;
  type: EpicCoding;
  docStatus: 'preliminary' | 'final';
  /** Empty means every supported, active answer. */
  fieldIds: string[];
}

export interface EpicQuestionMapping {
  fieldId: string;
  /** Epic Create linkId, supplied by the site; a Read linkId is not interchangeable. */
  linkId: string;
  answerType: 'string' | 'decimal' | 'boolean' | 'date' | 'time' | 'quantity';
  unit?: EpicUnit;
  answers?: EpicAnswerMapping[];
}

export interface EpicQuestionnaireSettings {
  enabled: boolean;
  /** Exact canonical returned by an assigned-questionnaire CarePlan. */
  canonical: string;
  status: 'in-progress' | 'completed';
  questions: EpicQuestionMapping[];
}

export interface EpicExportSettings {
  version: 1;
  site: {
    issuer: string;
    clientId: string;
    redirectUri: string;
    authorizationOrigins: string[];
    scopeVersion: 'v1' | 'v2';
    launchMode: 'ehr' | 'standalone' | 'both';
    /** Development only, limited to literal loopback hosts. */
    allowLoopbackHttp?: boolean;
    /** 60 is compatible with older Epic versions; 254 needs site verification. */
    observationNoteLimit?: 60 | 254;
  };
  readMappings: EpicReadMapping[];
  observationMappings: EpicObservationMapping[];
  note: EpicNoteSettings;
  questionnaire: EpicQuestionnaireSettings;
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const records = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter(record) : [];
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()) : [];
const coding = (value: unknown): EpicCoding => {
  const input = record(value) ? value : {};
  return { system: text(input.system), code: text(input.code), ...(text(input.display) ? { display: text(input.display) } : {}) };
};
const unit = (value: unknown): EpicUnit | undefined => record(value)
  ? { code: text(value.code), ...(text(value.display) ? { display: text(value.display) } : {}) } : undefined;
const answers = (value: unknown): EpicAnswerMapping[] | undefined => Array.isArray(value) ? records(value).map((entry) => ({
  value: typeof entry.value === 'string' ? entry.value : '', code: typeof entry.code === 'string' ? entry.code : '',
  ...(text(entry.system) ? { system: text(entry.system) } : {}), ...(text(entry.display) ? { display: text(entry.display) } : {}),
})) : undefined;

/** Keep incomplete/duplicate rows for review; remove tokens, secrets and untrusted verification claims. */
export function normalizeEpicExportSettings(value: unknown): EpicExportSettings | undefined {
  if (!record(value) || (value.version !== undefined && value.version !== 1)) return undefined;
  const site = record(value.site) ? value.site : {};
  const note = record(value.note) ? value.note : {};
  const questionnaire = record(value.questionnaire) ? value.questionnaire : {};
  return {
    version: 1,
    site: {
      issuer: text(site.issuer), clientId: text(site.clientId), redirectUri: text(site.redirectUri),
      authorizationOrigins: strings(site.authorizationOrigins),
      scopeVersion: site.scopeVersion === 'v2' ? 'v2' : 'v1',
      launchMode: site.launchMode === 'ehr' || site.launchMode === 'standalone' ? site.launchMode : 'both',
      ...(site.allowLoopbackHttp === true ? { allowLoopbackHttp: true } : {}),
      observationNoteLimit: site.observationNoteLimit === 254 ? 254 : 60,
    },
    readMappings: records(value.readMappings).map((entry) => ({
      fieldId: text(entry.fieldId), source: entry.source === 'encounter' || entry.source === 'observation' ? entry.source : 'patient', path: text(entry.path),
      ...(record(entry.coding) ? { coding: coding(entry.coding) } : {}),
      ...(text(entry.identifierSystem) ? { identifierSystem: text(entry.identifierSystem) } : {}),
      ...(unit(entry.unit) ? { unit: unit(entry.unit) } : {}), ...(answers(entry.answers) ? { answers: answers(entry.answers) } : {}),
    })),
    observationMappings: records(value.observationMappings).map((entry) => ({
      fieldId: text(entry.fieldId), coding: coding(entry.coding),
      valueType: entry.valueType === 'string' || entry.valueType === 'coding' || entry.valueType === 'time' || entry.valueType === 'blood-pressure' ? entry.valueType : 'quantity',
      ...(text(entry.diastolicFieldId) ? { diastolicFieldId: text(entry.diastolicFieldId) } : {}),
      ...(unit(entry.unit) ? { unit: unit(entry.unit) } : {}), ...(answers(entry.answers) ? { answers: answers(entry.answers) } : {}),
      ...(text(entry.commentsFieldId) ? { commentsFieldId: text(entry.commentsFieldId) } : {}),
      ...(record(entry.template) ? { template: { system: text(entry.template.system), value: text(entry.template.value) } } : {}),
    })),
    note: { enabled: note.enabled === true, type: coding(note.type), docStatus: note.docStatus === 'final' ? 'final' : 'preliminary', fieldIds: strings(note.fieldIds) },
    questionnaire: {
      enabled: questionnaire.enabled === true, canonical: text(questionnaire.canonical), status: questionnaire.status === 'in-progress' ? 'in-progress' : 'completed',
      questions: records(questionnaire.questions).map((entry) => ({
        fieldId: text(entry.fieldId), linkId: text(entry.linkId),
        answerType: ['decimal', 'boolean', 'date', 'time', 'quantity'].includes(String(entry.answerType)) ? entry.answerType as EpicQuestionMapping['answerType'] : 'string',
        ...(unit(entry.unit) ? { unit: unit(entry.unit) } : {}), ...(answers(entry.answers) ? { answers: answers(entry.answers) } : {}),
      })),
    },
  };
}

export function readEpicExportSettings(document: { epicExport?: unknown } | null | undefined): EpicExportSettings {
  return normalizeEpicExportSettings(document?.epicExport) ?? normalizeEpicExportSettings({ version: 1 })!;
}
