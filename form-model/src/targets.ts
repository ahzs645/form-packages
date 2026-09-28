import type {
  BranchingRule,
  BuilderDocument,
  BuilderFormPresentation,
  BuilderPageFlowConfig,
  BuilderWorkflowConfig,
  FieldLinkRule,
} from "./index";

/**
 * The converter contract of the neutral form model
 * (docs/.../proposals/neutral-form-model.md, "The converter contract").
 *
 * A form stores what the author means once; each export target has one
 * converter that turns the form into that target's artifact and reports what
 * it dropped or changed on the way. The Export review is the converters run in
 * report mode. Implementations live in the app (`lib/targets`); this module is
 * only the vocabulary, so it stays free of app imports.
 */

/**
 * Every export target. The EMR targets are covered by Export review (`ExportTargetId` in lib/export-compatibility); `documents`
 * is PDF, XFA and Word fill.
 */
export const TARGET_IDS = ["mois", "cerner", "alayacare", "fhir", "oscar", "documents"] as const;
export type TargetId = (typeof TARGET_IDS)[number];

/** The concepts a converter honours or reports a loss for, in the proposal's order. */
export const FORM_CONCEPTS = [
  "type",
  "options",
  "condition",
  "formula",
  "required",
  "validation",
  "default",
  "binding",
  "structure",
  "presentation",
  "lifecycle",
  "workflow",
  "translation",
] as const;
export type FormConcept = (typeof FORM_CONCEPTS)[number];

/**
 * - `native`: the target expresses the concept as authored.
 * - `changed`: the target approximates it (a fallback, reported as changed).
 * - `unsupported`: the target has no way to express it (reported as dropped).
 */
export type Support = "native" | "changed" | "unsupported";

/** One thing a converter could not carry exactly. */
export interface ConversionLoss {
  target: TargetId;
  /** Field (or section) the loss is about; absent for form-wide losses. */
  fieldId?: string;
  concept: FormConcept;
  level: "changed" | "dropped";
  /** Stable, e.g. "alayacare.field-type.rating". */
  code: string;
  /** Plain language: what happens on export. */
  detail: string;
  /**
   * `meaning`: the answer, the rule or the result is not what the author meant
   * (a dropped condition leaves a field always visible). `presentation`: the
   * same answer is drawn or laid out differently (radio buttons become a list).
   */
  severity: "meaning" | "presentation";
}

export interface ConceptCapability {
  support: Support;
  /** Why, in plain language; expected unless `native`. */
  note?: string;
}

/** What a target can express, per concept and, where known, per field type and formula function. */
export interface TargetCapabilities {
  target: TargetId;
  concepts: Partial<Record<FormConcept, ConceptCapability>>;
  /** Keyed by builder field type. */
  fieldTypes?: Record<string, Support>;
  /** Keyed by formula function name, as authors write it. */
  functions?: Record<string, Support>;
}

export interface ConversionResult<Artifact> {
  artifact: Artifact;
  losses: ConversionLoss[];
}

/**
 * The form's logic outside its fields, as every converter and the Export
 * review read it: the Logic-tab rules, which the workspace keeps beside the
 * document (`WorkspaceDocumentV3.fieldLinkRules`), and the subgroup gates,
 * page flow and pagination the document holds, with its workflow (the
 * submit actions it runs, read by `readSubmitActions` in ./workflow).
 *
 * `fieldLinkRules` absent means the caller does not know them (a review of
 * the fields alone), not that there are none: FHIR then judges each field's
 * own show-when rule, and Cerner assumes imported conditions are unchanged.
 * A caller holding the form passes its rules, even an empty list.
 */
export interface FormLogicInput {
  fieldLinkRules?: FieldLinkRule[];
  /** Subgroup gates, keyed `sectionKey::subgroupId`. */
  branchingRules?: Record<string, BranchingRule>;
  pageFlow?: BuilderPageFlowConfig | null;
  /** Section group key (`builder-section-<id>`, or `builder-preview`) → 1-based page. */
  pageAssignments?: Record<string, number | null>;
  paginationEnabled?: boolean;
  pageCount?: number;
  pageNames?: string[];
  /** "investigation" forms use tabs, not pages, so page flow does not apply. */
  formPresentation?: BuilderFormPresentation | null;
  /** The document's workflow: its outputs are submit actions (./workflow.ts). */
  workflow?: BuilderWorkflowConfig | null;
}

/**
 * The author's saved export choices per target, keyed by review issue
 * (`ExportDecisions` in lib/export-compatibility, chosen in the Export review).
 */
export type TargetExportDecisions = Partial<Record<TargetId, Record<string, string>>>;

/**
 * The whole form a converter reads: the document, the Logic-tab rules the
 * workspace keeps beside it, and the saved export decisions. Every converter,
 * `convertAll` and the Export review take the form this way, so no target is
 * handed only part of what the author meant.
 */
export interface NeutralFormInput {
  document: BuilderDocument;
  /** Logic-tab rules (see `FormLogicInput.fieldLinkRules` for what absent means). */
  fieldLinkRules?: FieldLinkRule[];
  decisions?: TargetExportDecisions;
}

/** What `formLogicOf` reads from a document: the parts that hold logic. */
export type FormLogicDocument = Pick<BuilderDocument, "branchingRules"> &
  Partial<Pick<BuilderDocument, "pageFlow" | "pageAssignments" | "paginationEnabled" | "pageCount" | "pageNames" | "formPresentation" | "workflow">>;

/** The form's logic outside its fields: the Logic-tab rules, subgroup gates, page flow and pagination. */
export function formLogicOf(form: { document: FormLogicDocument; fieldLinkRules?: FieldLinkRule[] }): FormLogicInput {
  const { document } = form;
  return {
    ...(form.fieldLinkRules ? { fieldLinkRules: form.fieldLinkRules } : {}),
    branchingRules: document.branchingRules,
    pageFlow: document.pageFlow ?? null,
    ...(document.pageAssignments ? { pageAssignments: document.pageAssignments } : {}),
    ...(document.paginationEnabled !== undefined ? { paginationEnabled: document.paginationEnabled } : {}),
    ...(document.pageCount !== undefined ? { pageCount: document.pageCount } : {}),
    ...(document.pageNames ? { pageNames: document.pageNames } : {}),
    formPresentation: document.formPresentation ?? null,
    ...(document.workflow ? { workflow: document.workflow } : {}),
  };
}

/**
 * A pure function from the whole form to what the target's renderer ingests,
 * plus what it lost. Options carry what the form does not hold (session
 * settings, file ids, a release); every option is optional.
 */
export interface TargetConverter<Artifact = unknown, Options extends object = Record<string, never>> {
  target: TargetId;
  capabilities: TargetCapabilities;
  convert(form: NeutralFormInput, options?: Options): ConversionResult<Artifact>;
  /** The losses alone, without building the artifact: the Export review's report mode. */
  report?(form: NeutralFormInput, options?: Options): ConversionLoss[];
}

/** An importer's output: neutral intent, the source's own data kept for a round trip, and what it could not read. */
export interface ImporterResult<Source = unknown> {
  document: BuilderDocument;
  provenance?: Source;
  losses: ConversionLoss[];
}

/**
 * The targets a form is exported to. The primary target does not change the
 * stored intent; it decides which losses block export and which only warn.
 */
export interface ExportTargetsSetting {
  primary: TargetId;
  secondary?: TargetId[];
}

export type LossSeverity = "block" | "warn" | "info";

export function isTargetId(value: unknown): value is TargetId {
  return typeof value === "string" && (TARGET_IDS as readonly string[]).includes(value);
}

/**
 * How much one loss matters for this form: a meaning loss blocks export on the
 * primary target and warns on any other; a presentation loss is information.
 */
export function lossSeverityFor(
  loss: Pick<ConversionLoss, "target" | "severity">,
  setting: ExportTargetsSetting
): LossSeverity {
  if (loss.severity === "presentation") return "info";
  return loss.target === setting.primary ? "block" : "warn";
}

/**
 * A saved setting, cleaned: unknown targets are dropped, the primary never
 * repeats among the secondaries, and secondaries keep `TARGET_IDS` order.
 * Null when there is no usable primary.
 */
export function normalizeExportTargetsSetting(value: unknown): ExportTargetsSetting | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!isTargetId(record.primary)) return null;
  const primary = record.primary;
  const listed = Array.isArray(record.secondary) ? record.secondary.filter(isTargetId) : [];
  const secondary = TARGET_IDS.filter((target) => target !== primary && listed.includes(target));
  return secondary.length > 0 ? { primary, secondary } : { primary };
}

/**
 * The form's export targets. A form that has not chosen any uses the current
 * preview/export mode as its primary target when there is one, else MOIS.
 */
export function resolveExportTargets(
  document: Pick<BuilderDocument, "exportTargets"> | null | undefined,
  currentMode?: string | null
): ExportTargetsSetting {
  const saved = normalizeExportTargetsSetting(document?.exportTargets);
  if (saved) return saved;
  return { primary: isTargetId(currentMode) ? currentMode : "mois" };
}

/** Primary first, then the secondaries: every target this form exports to. */
export function enabledExportTargets(setting: ExportTargetsSetting): TargetId[] {
  return [setting.primary, ...(setting.secondary ?? []).filter((target) => target !== setting.primary)];
}

/** "primary", "secondary", or null for a target the form does not export to. */
export function exportTargetRole(target: TargetId, setting: ExportTargetsSetting): "primary" | "secondary" | null {
  if (target === setting.primary) return "primary";
  return setting.secondary?.includes(target) ? "secondary" : null;
}
