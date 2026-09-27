import type { FieldConditionGroup } from "./index";
import { readLockCondition } from "./conditions";
import { FIELD_TYPE_PROFILES, neutralAnswerTypeOf, type FieldTypeInput } from "./field-types";

/**
 * Where a form is in its life: still being written, live in the EMR, or
 * withdrawn — plus the dates a governance review cares about and a log of how
 * it got there.
 *
 * This is deliberately not part of `BuilderMoisIdentityMetadata`. That block is
 * MOIS's own identity contract (author, owner, publisher, the semver triple it
 * ships in a package), whereas a lifecycle is a property of the form itself and
 * every target has its own name for it — FHIR calls the middle state `active`.
 * Keeping it separate means the MOIS block stays a faithful mirror of what MOIS
 * accepts.
 *
 * The author-facing word is "published" rather than FHIR's "active", because an
 * author publishes a form; `toFhirQuestionnaireStatus` does the translation at
 * the boundary.
 */

/** Author-facing lifecycle states. */
export type BuilderFormStatus = "draft" | "published" | "retired";

export const BUILDER_FORM_STATUSES: readonly BuilderFormStatus[] = [
  "draft",
  "published",
  "retired",
] as const;

/**
 * One line of history. Appended when the status changes or a version is
 * stamped; never rewritten, so the list reads as what happened in order.
 */
export interface BuilderFormLifecycleEntry {
  /** ISO 8601 instant the entry was recorded. */
  at: string;
  status: BuilderFormStatus;
  /** The form's version at the time, if one was stamped. */
  version?: string;
  /** Who made the change, when the host knows. */
  by?: string;
  /** The author's own note — what changed and why. */
  note?: string;
}

export interface BuilderFormLifecycle {
  status: BuilderFormStatus;
  /** Date the form was approved for use (FHIR `approvalDate`), as YYYY-MM-DD. */
  approvalDate?: string;
  /** Date it was last reviewed (FHIR `lastReviewDate`), as YYYY-MM-DD. */
  lastReviewDate?: string;
  /** First day the form should be used (FHIR `effectivePeriod.start`). */
  effectiveStart?: string;
  /** Last day the form should be used (FHIR `effectivePeriod.end`). */
  effectiveEnd?: string;
  /** Append-only, oldest first. */
  changeLog?: BuilderFormLifecycleEntry[];
}

/**
 * A form with no lifecycle recorded is a draft, not a published one. Anything
 * that gates on "is this live" has to fail closed, or every legacy document
 * silently counts as approved for clinical use.
 */
export const DEFAULT_BUILDER_FORM_STATUS: BuilderFormStatus = "draft";

export function isBuilderFormStatus(value: unknown): value is BuilderFormStatus {
  return typeof value === "string" && (BUILDER_FORM_STATUSES as readonly string[]).includes(value);
}

/** The status of a document, defaulting an absent or unrecognised one to draft. */
export function resolveBuilderFormStatus(
  lifecycle: BuilderFormLifecycle | null | undefined,
): BuilderFormStatus {
  return isBuilderFormStatus(lifecycle?.status) ? lifecycle.status : DEFAULT_BUILDER_FORM_STATUS;
}

/** Only a published form is live; draft and retired both mean "do not use". */
export function isPublishedForm(lifecycle: BuilderFormLifecycle | null | undefined): boolean {
  return resolveBuilderFormStatus(lifecycle) === "published";
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Keeps YYYY-MM-DD and drops anything else, so a bad value cannot reach FHIR. */
function normalizeDateOnly(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return DATE_ONLY.test(trimmed) ? trimmed : undefined;
}

function normalizeEntry(value: unknown): BuilderFormLifecycleEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  if (!isBuilderFormStatus(entry.status)) return null;
  const at = typeof entry.at === "string" && entry.at.trim() ? entry.at.trim() : null;
  if (!at) return null;
  return {
    at,
    status: entry.status,
    ...(typeof entry.version === "string" && entry.version.trim() ? { version: entry.version.trim() } : {}),
    ...(typeof entry.by === "string" && entry.by.trim() ? { by: entry.by.trim() } : {}),
    ...(typeof entry.note === "string" && entry.note.trim() ? { note: entry.note.trim() } : {}),
  };
}

/**
 * Coerce whatever a document carries into a lifecycle, dropping values that are
 * not usable rather than passing them on. Returns undefined when there is
 * nothing to keep, so an untouched document stays untouched.
 */
export function normalizeBuilderFormLifecycle(value: unknown): BuilderFormLifecycle | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const changeLog = Array.isArray(source.changeLog)
    ? source.changeLog.map(normalizeEntry).filter((entry): entry is BuilderFormLifecycleEntry => entry !== null)
    : [];

  const lifecycle: BuilderFormLifecycle = {
    status: isBuilderFormStatus(source.status) ? source.status : DEFAULT_BUILDER_FORM_STATUS,
    ...(normalizeDateOnly(source.approvalDate) ? { approvalDate: normalizeDateOnly(source.approvalDate) } : {}),
    ...(normalizeDateOnly(source.lastReviewDate) ? { lastReviewDate: normalizeDateOnly(source.lastReviewDate) } : {}),
    ...(normalizeDateOnly(source.effectiveStart) ? { effectiveStart: normalizeDateOnly(source.effectiveStart) } : {}),
    ...(normalizeDateOnly(source.effectiveEnd) ? { effectiveEnd: normalizeDateOnly(source.effectiveEnd) } : {}),
    ...(changeLog.length > 0 ? { changeLog } : {}),
  };
  return lifecycle;
}

/**
 * Record a transition. Returns a new lifecycle — the caller owns persisting it —
 * with the entry appended rather than replacing what is there.
 */
export function appendLifecycleEntry(
  lifecycle: BuilderFormLifecycle | null | undefined,
  entry: Omit<BuilderFormLifecycleEntry, "at"> & { at?: string },
): BuilderFormLifecycle {
  const base = normalizeBuilderFormLifecycle(lifecycle) ?? { status: DEFAULT_BUILDER_FORM_STATUS };
  const recorded: BuilderFormLifecycleEntry = {
    at: entry.at ?? new Date().toISOString(),
    status: entry.status,
    ...(entry.version ? { version: entry.version } : {}),
    ...(entry.by ? { by: entry.by } : {}),
    ...(entry.note ? { note: entry.note } : {}),
  };
  return {
    ...base,
    status: entry.status,
    changeLog: [...(base.changeLog ?? []), recorded],
  };
}

/** FHIR's Questionnaire.status. Ours differ only in the word for "live". */
export type FhirPublicationStatus = "draft" | "active" | "retired" | "unknown";

export function toFhirQuestionnaireStatus(
  lifecycle: BuilderFormLifecycle | null | undefined,
): FhirPublicationStatus {
  switch (resolveBuilderFormStatus(lifecycle)) {
    case "published":
      return "active";
    case "retired":
      return "retired";
    default:
      return "draft";
  }
}

/**
 * The reverse, for import. FHIR's `unknown` carries no claim that the form is
 * live, so it lands on draft alongside anything unrecognised.
 */
export function fromFhirQuestionnaireStatus(status: unknown): BuilderFormStatus {
  switch (status) {
    case "active":
      return "published";
    case "retired":
      return "retired";
    default:
      return "draft";
  }
}

// ---------------------------------------------------------------------------
// Locks, signing, authorship and approval
// ---------------------------------------------------------------------------
//
// The "Lifecycle" concept of the neutral form model
// (docs/.../proposals/neutral-form-model.md, and the contract in
// docs/.../architecture/form-lifecycle.md): when a form's answers stop being
// editable, who owns them, and how a filled form is finished. Each product
// stores part of it today: the fields hold their locks, MOIS sections their
// multi-author policy, the MOIS footer (a session setting) its sign buttons,
// an imported PowerForm its required hard stop, an imported FHIR
// Questionnaire its signature requirement, and the AlayaCare form settings
// (a session setting) the approval step. `readFormLifecycle` reads all of
// them into one value without changing how anything is stored; converters
// realise it per target and report what a target cannot carry.

/**
 * How a filled form is finished:
 * - `with-submit`: submitting it signs it (MOIS "Sign & Save"; a FHIR
 *   Questionnaire that requires a signature).
 * - `after-submit`: it is submitted first and signed as its own step (a
 *   MOIS Sign button beside a Submit that does not sign).
 * - `none`: it is submitted, or only saved, without a signature.
 */
export type FormSigningMode = "with-submit" | "after-submit" | "none";

export const FORM_SIGNING_MODES: readonly FormSigningMode[] = ["with-submit", "after-submit", "none"];

/** The FHIR extension that says a Questionnaire (or one item) needs a signature. */
export const FHIR_SIGNATURE_REQUIRED_URL = "http://hl7.org/fhir/StructureDefinition/questionnaire-signatureRequired";

/** The MOIS authorship runtime's edit window when a policy names none (packages/form-components/src/authorship.ts). */
export const DEFAULT_AUTHORSHIP_EDITABLE_WINDOW_HOURS = 72;

/** A coding as FHIR writes it (a signature type). */
export interface LifecycleCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FormLifecycleSigning {
  /**
   * Null when no store says. Each target then keeps its own workflow: the
   * MOIS footer's default signs on submit, a PowerForm always signs, a FHIR
   * Questionnaire asks for no signature and AlayaCare has none.
   */
  mode: FormSigningMode | null;
  /**
   * `true`: the form can't be signed while a required answer is missing (a
   * PowerForm's required hard stop, `FORM_FLAGS` bit 1). `false`: no store
   * asks for it and each target keeps its own rule. A stored "off" is not
   * read as a choice, because the PowerForm settings write it by default.
   */
  requireRequiredAnswers: boolean;
  /** The signature types a FHIR Questionnaire names; empty when it names none. */
  signatureTypes: LifecycleCoding[];
}

/** The locks one field carries. */
export interface FieldLifecycleLocks {
  fieldId: string;
  /** Read-only once the form is signed (`lockWhenSigned`: on unless `false`). */
  whenSigned: boolean;
  /**
   * Read-only once its section is complete (`lockWhenSectionComplete`: on
   * unless `false`). An exported MOIS form marks its sections complete when
   * it is submitted, until Edit reopens them.
   */
  whenSectionComplete: boolean;
  /** Read-only while this holds: `readLockCondition` (`lockCondition`, else the legacy `lockWhen`). */
  condition: FieldConditionGroup | null;
  /** The section whose field-level authorship owns this answer, or null. */
  ownedBy: string | null;
}

export type LifecycleAuthorshipGranularity = "field" | "row";
export type LifecycleAuthorshipLockOn = "save" | "submit" | "sign";

/**
 * Multi-author ownership (docs/.../architecture/runtime/authorship-model.md):
 * each answer, or each table row, belongs to the person who saved it. Others
 * see it read-only, and its author can change it for `editableWindowHours`.
 * Only enabled policies are read.
 */
export interface LifecycleAuthorship {
  /** Set on a section (its answers, or the rows of its tables) or on one component (its rows). */
  scope: "section" | "component";
  /** The section's or the component field's id. */
  id: string;
  /** The fields it covers: a section's fields, or the component itself. */
  fieldIds: string[];
  granularity: LifecycleAuthorshipGranularity;
  /** When a change becomes its author's: on save, submit or sign. */
  lockOn: LifecycleAuthorshipLockOn;
  editableWindowHours: number;
  /** Show each row's author in a status column (row ownership). */
  showStatusColumn: boolean;
}

/**
 * A reviewer's approval of each submitted form. Not the governance
 * `approvalDate` above, which dates the approval of the form definition.
 * `reviewer`: a submitted form waits for approval before it is final.
 * `automatic`: it is final when submitted.
 */
export interface FormLifecycleApproval {
  mode: "reviewer" | "automatic";
}

export type LifecycleTarget = "mois" | "cerner" | "alayacare" | "fhir";

/** A lifecycle setting only one product has, kept as that product's option. */
export interface LifecycleTargetOption {
  target: LifecycleTarget;
  setting: string;
  value: unknown;
  /** The field it sits on, for a field-level setting. */
  fieldId?: string;
}

export interface FormLifecycle {
  /** Draft, published or retired: the form's publication status (`document.lifecycle`). */
  status: BuilderFormStatus;
  signing: FormLifecycleSigning;
  /** Every field that holds an answer or contains answers, in document order. */
  fields: FieldLifecycleLocks[];
  /** Enabled authorship policies: sections in document order, then components. */
  authorship: LifecycleAuthorship[];
  /** Null when no store says (only the AlayaCare form settings do today). */
  approval: FormLifecycleApproval | null;
  targetOptions: LifecycleTargetOption[];
}

/** Where a part of the lifecycle was read from. */
export type FormLifecycleStore =
  | "document.lifecycle"
  | "field.lockWhenSigned"
  | "field.lockWhenSectionComplete"
  | "field.lockCondition"
  | "field.lockWhen"
  | "sectionConfig.authorshipPolicy"
  | "layoutDraft.authorshipPolicy"
  | "componentProps.authorshipPolicy"
  | "preview.footerButtons"
  | "preview.lockPolicy"
  | "cernerConfig.formRoot"
  | "fhirConfig.questionnaireRoot"
  | "fhirConfig.preservedExtensions"
  | "alayaCareFormSettings";

export interface FormLifecycleUnknown {
  store: FormLifecycleStore;
  fieldId?: string;
  key: string;
  value: unknown;
}

export interface FormLifecycleDetails {
  lifecycle: FormLifecycle;
  /** The stores something was read from, each once, in the order read. */
  sources: FormLifecycleStore[];
  /** Stored values the reader did not understand; they are left as they are. */
  unknown: FormLifecycleUnknown[];
}

/** What the reader uses of a document (a `BuilderDocument` fits); any part may be missing. */
export interface FormLifecycleDocument {
  fields?: unknown;
  drafts?: unknown;
  lifecycle?: unknown;
}

/** Lifecycle stores kept in the workspace session rather than the document. */
export interface FormLifecycleSources {
  /**
   * The session's MOIS preview settings (`WorkspaceDocumentV3.preview`): the
   * footer's submit and sign buttons, and the form lock. Pass them only when
   * the form's MOIS footer is known: its defaults sign on submit, so passing
   * them says the form is signed.
   */
  preview?: { footerButtons?: unknown; lockPolicy?: unknown } | null;
  /** The session's AlayaCare form settings (`SessionPayload.alayaCareFormSettings`). */
  alayaCareFormSettings?: unknown;
}

type LifecycleRecord = Record<string, unknown>;

function isLifecycleRecord(value: unknown): value is LifecycleRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordsOf(value: unknown): LifecycleRecord[] {
  return Array.isArray(value) ? value.filter(isLifecycleRecord) : [];
}

function idOf(record: LifecycleRecord): string | null {
  return typeof record.id === "string" && record.id.trim() ? record.id : null;
}

/** A field that holds an answer (or contains answers: a table, a layout table, a component). */
function holdsAnswers(field: LifecycleRecord): boolean {
  const type = field.type;
  if (typeof type !== "string") return false;
  const profile = (FIELD_TYPE_PROFILES as Record<string, { role: string } | undefined>)[type];
  if (profile?.role === "answer" || profile?.role === "container") return true;
  // An editable rich-text block is a long-text answer.
  return type === "richText" && neutralAnswerTypeOf(field as unknown as FieldTypeInput) !== null;
}

/**
 * The controller kinds a legacy `lockWhen` converts with: Yes/No and choice
 * controllers get the operators that normalise stored answers, as the MOIS
 * export's `withResolvedLockConditions` does.
 */
function lockControllerKinds(fields: LifecycleRecord[]): (id: string) => string | undefined {
  const byId = new Map<string, LifecycleRecord>();
  for (const field of fields) {
    const id = idOf(field);
    if (id && !byId.has(id)) byId.set(id, field);
  }
  return (id) => {
    const field = byId.get(id);
    if (!field || typeof field.type !== "string") return undefined;
    const answer = neutralAnswerTypeOf(field as unknown as FieldTypeInput);
    if (answer === "yesNo" || answer === "boolean") return "boolean";
    if (answer === "singleChoice" || answer === "multipleChoice") return "choice";
    return undefined;
  };
}

/**
 * Each section's fields, as the MOIS export groups them
 * (`buildPreviewGroups`): its `childFieldIds`, or with none the fields that
 * follow it up to the next section; a field claimed by an earlier section
 * stays there.
 */
function sectionMembers(fields: LifecycleRecord[]): Map<string, string[]> {
  const byId = new Map<string, LifecycleRecord>();
  for (const field of fields) {
    const id = idOf(field);
    if (id && !byId.has(id)) byId.set(id, field);
  }
  const claimed = new Set<string>();
  const members = new Map<string, string[]>();
  fields.forEach((field, index) => {
    const sectionId = idOf(field);
    if (field.type !== "section" || !sectionId || members.has(sectionId)) return;
    const config = isLifecycleRecord(field.sectionConfig) ? field.sectionConfig : {};
    let declared = Array.isArray(config.childFieldIds)
      ? config.childFieldIds.filter((id): id is string => typeof id === "string" && id.trim() !== "")
      : [];
    if (declared.length === 0) {
      declared = [];
      for (const next of fields.slice(index + 1)) {
        if (next.type === "section") break;
        const nextId = idOf(next);
        if (nextId) declared.push(nextId);
      }
    }
    const childIds = declared.filter((id) => !claimed.has(id));
    childIds.forEach((id) => claimed.add(id));
    members.set(sectionId, childIds.filter((id) => {
      const child = byId.get(id);
      return Boolean(child) && child!.type !== "section";
    }));
  });
  return members;
}

type AuthorshipPolicyReading = Omit<LifecycleAuthorship, "scope" | "id" | "fieldIds">;

/** An enabled policy, normalised as the MOIS runtime does (`normalizeAuthorshipPolicy`); null when off. */
function readAuthorshipPolicy(value: LifecycleRecord): AuthorshipPolicyReading | null {
  if (value.enabled !== true) return null;
  const hours = value.editableWindowHours;
  return {
    granularity: value.granularity === "row" ? "row" : "field",
    lockOn: value.lockOn === "sign" || value.lockOn === "submit" ? value.lockOn : "save",
    editableWindowHours:
      typeof hours === "number" && Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_AUTHORSHIP_EDITABLE_WINDOW_HOURS,
    showStatusColumn: value.showStatusColumn === true,
  };
}

function codingsOf(value: unknown): LifecycleCoding[] {
  if (!isLifecycleRecord(value)) return [];
  return recordsOf(value.coding).map((coding) => ({
    ...(typeof coding.system === "string" ? { system: coding.system } : {}),
    ...(typeof coding.code === "string" ? { code: coding.code } : {}),
    ...(typeof coding.display === "string" ? { display: coding.display } : {}),
  }));
}

/**
 * The signature requirement in a list of FHIR extensions: null without one,
 * otherwise the signature types it names (possibly none).
 */
export function readFhirSignatureRequirement(extensions: unknown): LifecycleCoding[] | null {
  const found = recordsOf(extensions).filter((extension) => extension.url === FHIR_SIGNATURE_REQUIRED_URL);
  if (found.length === 0) return null;
  return found.flatMap((extension) => codingsOf(extension.valueCodeableConcept));
}

/** The MOIS footer's signing: Submit signs unless `submitAutoSign` is off; otherwise a Sign button signs after it. */
function footerSigningMode(footer: LifecycleRecord): FormSigningMode {
  const submits = footer.showSubmit !== false;
  if (submits && footer.submitAutoSign !== false) return "with-submit";
  if (footer.showSign === true || (submits && footer.signedSignButton === true)) return "after-submit";
  return "none";
}

/** `FORM_FLAGS` bit 1, the PowerForm's required hard stop (lib/cerner-export-settings.ts `powerFormFlag`). */
function powerFormHardStop(flags: unknown): boolean {
  const value = Number(typeof flags === "string" || typeof flags === "number" ? flags || 0 : 0);
  return Number.isSafeInteger(value) && value >= 0 && value % 2 === 1;
}

/** True when the form's signing (as read) asks for a signature. */
export function lifecycleRequiresSignature(lifecycle: Pick<FormLifecycle, "signing">): boolean {
  return lifecycle.signing.mode === "with-submit" || lifecycle.signing.mode === "after-submit";
}

/**
 * The form's lifecycle, read from every store, with where each part came
 * from and anything the reader did not understand. Never throws: a store of
 * the wrong shape is skipped (and listed in `unknown` when it holds a value).
 */
export function readFormLifecycleDetails(
  document: FormLifecycleDocument | null | undefined,
  sources: FormLifecycleSources = {},
): FormLifecycleDetails {
  const doc = isLifecycleRecord(document) ? (document as LifecycleRecord) : {};
  const fields = recordsOf(doc.fields);
  const read: FormLifecycleStore[] = [];
  const unknown: FormLifecycleUnknown[] = [];
  const note = (store: FormLifecycleStore) => {
    if (!read.includes(store)) read.push(store);
  };

  // Publication status.
  if (doc.lifecycle !== undefined && doc.lifecycle !== null) note("document.lifecycle");
  const status = resolveBuilderFormStatus(isLifecycleRecord(doc.lifecycle) ? (doc.lifecycle as unknown as BuilderFormLifecycle) : undefined);

  // Authorship: a section's policy (its layout draft's first, as the MOIS
  // export reads it), then components with their own row policy.
  const members = sectionMembers(fields);
  const drafts = recordsOf(doc.drafts);
  const authorship: LifecycleAuthorship[] = [];
  const ownedBy = new Map<string, string>();
  for (const field of fields) {
    const sectionId = idOf(field);
    if (field.type !== "section" || !sectionId) continue;
    const draft = drafts.find((entry) => entry.key === `builder-section-${sectionId}`);
    const config = isLifecycleRecord(field.sectionConfig) ? field.sectionConfig : {};
    const fromDraft = draft?.authorshipPolicy !== undefined && draft.authorshipPolicy !== null;
    const stored = fromDraft ? draft!.authorshipPolicy : config.authorshipPolicy;
    if (stored === undefined || stored === null) continue;
    const store: FormLifecycleStore = fromDraft ? "layoutDraft.authorshipPolicy" : "sectionConfig.authorshipPolicy";
    if (!isLifecycleRecord(stored)) {
      unknown.push({ store, fieldId: sectionId, key: "authorshipPolicy", value: stored });
      continue;
    }
    note(store);
    const policy = readAuthorshipPolicy(stored);
    if (!policy) continue;
    const fieldIds = members.get(sectionId) ?? [];
    authorship.push({ scope: "section", id: sectionId, fieldIds, ...policy });
    if (policy.granularity === "field") {
      for (const id of fieldIds) if (!ownedBy.has(id)) ownedBy.set(id, sectionId);
    }
  }
  for (const field of fields) {
    const id = idOf(field);
    if (!id || field.type !== "component" || !isLifecycleRecord(field.componentProps)) continue;
    const stored = field.componentProps.authorshipPolicy;
    if (stored === undefined || stored === null) continue;
    if (!isLifecycleRecord(stored)) {
      unknown.push({ store: "componentProps.authorshipPolicy", fieldId: id, key: "authorshipPolicy", value: stored });
      continue;
    }
    note("componentProps.authorshipPolicy");
    const policy = readAuthorshipPolicy(stored);
    if (policy) authorship.push({ scope: "component", id, fieldIds: [id], ...policy });
  }

  // Field locks.
  const controllerKind = lockControllerKinds(fields);
  const locks: FieldLifecycleLocks[] = [];
  for (const field of fields) {
    const id = idOf(field);
    if (!id || !holdsAnswers(field)) continue;
    for (const [key, store] of [
      ["lockWhenSigned", "field.lockWhenSigned"],
      ["lockWhenSectionComplete", "field.lockWhenSectionComplete"],
    ] as const) {
      const value = field[key];
      if (value === undefined || value === null) continue;
      if (typeof value === "boolean") note(store);
      else unknown.push({ store, fieldId: id, key, value });
    }
    let condition: FieldConditionGroup | null = null;
    try {
      condition = readLockCondition(field as Parameters<typeof readLockCondition>[0], controllerKind);
    } catch {
      unknown.push({ store: "field.lockCondition", fieldId: id, key: "lockCondition", value: field.lockCondition ?? field.lockWhen });
    }
    if (condition) note(isLifecycleRecord(field.lockCondition) ? "field.lockCondition" : "field.lockWhen");
    locks.push({
      fieldId: id,
      whenSigned: field.lockWhenSigned !== false,
      whenSectionComplete: field.lockWhenSectionComplete !== false,
      condition,
      ownedBy: ownedBy.get(id) ?? null,
    });
  }

  // Signing: the MOIS footer when the caller has it, else an imported FHIR
  // Questionnaire's requirement; the hard stop from the PowerForm settings.
  const targetOptions: LifecycleTargetOption[] = [];
  let mode: FormSigningMode | null = null;
  let signatureTypes: LifecycleCoding[] = [];
  const preview = isLifecycleRecord(sources.preview) ? sources.preview : null;
  if (preview && preview.footerButtons !== undefined && preview.footerButtons !== null) {
    if (isLifecycleRecord(preview.footerButtons)) {
      note("preview.footerButtons");
      mode = footerSigningMode(preview.footerButtons);
    } else {
      unknown.push({ store: "preview.footerButtons", key: "footerButtons", value: preview.footerButtons });
    }
  }
  if (preview && preview.lockPolicy !== undefined && preview.lockPolicy !== null) {
    if (preview.lockPolicy === "document") {
      note("preview.lockPolicy");
      targetOptions.push({ target: "mois", setting: "lockPolicy", value: "document" });
    } else {
      unknown.push({ store: "preview.lockPolicy", key: "lockPolicy", value: preview.lockPolicy });
    }
  }
  // The exporter keeps an imported Questionnaire's root on the first field.
  const first = fields[0];
  const fhirRoot = first && isLifecycleRecord(first.fhirConfig) && isLifecycleRecord(first.fhirConfig.questionnaireRoot)
    ? first.fhirConfig.questionnaireRoot
    : null;
  const rootSignature = fhirRoot ? readFhirSignatureRequirement(fhirRoot.extension) : null;
  if (rootSignature) {
    note("fhirConfig.questionnaireRoot");
    mode ??= "with-submit";
    if (mode !== "none") signatureTypes = rootSignature;
  }
  for (const field of fields) {
    const id = idOf(field);
    if (!id || !isLifecycleRecord(field.fhirConfig)) continue;
    const itemSignature = readFhirSignatureRequirement(field.fhirConfig.preservedExtensions);
    if (!itemSignature) continue;
    note("fhirConfig.preservedExtensions");
    targetOptions.push({ target: "fhir", setting: "signatureRequired", value: itemSignature, fieldId: id });
  }

  let requireRequiredAnswers = false;
  const cernerHolder = fields.find((field) => isLifecycleRecord(field.cernerConfig) && isLifecycleRecord(field.cernerConfig.formRoot));
  const cernerRoot = cernerHolder ? ((cernerHolder.cernerConfig as LifecycleRecord).formRoot as LifecycleRecord) : null;
  if (cernerRoot) {
    note("cernerConfig.formRoot");
    // As getPowerFormExportSettings: the author's PowerForm settings over the imported root.
    const settings = isLifecycleRecord(cernerRoot.exportSettings) && isLifecycleRecord(cernerRoot.exportSettings.powerform)
      ? cernerRoot.exportSettings.powerform
      : {};
    const iview = cernerRoot.kind === "iview";
    const flags = settings.formFlags !== undefined ? settings.formFlags : iview ? undefined : cernerRoot.formFlags;
    requireRequiredAnswers = settings.enforceRequired === true
      || (settings.enforceRequired === undefined && (cernerRoot.enforceRequired === true || powerFormHardStop(flags)));
    const doneCharting = settings.doneChartingAllowed !== undefined ? settings.doneChartingAllowed : iview ? undefined : cernerRoot.doneChartingAllowed;
    if (doneCharting === true) targetOptions.push({ target: "cerner", setting: "doneChartingAllowed", value: true });
  }

  // Approval and AlayaCare's own visit settings.
  let approval: FormLifecycleApproval | null = null;
  const alayaCare = sources.alayaCareFormSettings;
  if (alayaCare !== undefined && alayaCare !== null) {
    if (!isLifecycleRecord(alayaCare)) {
      unknown.push({ store: "alayaCareFormSettings", key: "alayaCareFormSettings", value: alayaCare });
    } else {
      note("alayaCareFormSettings");
      const automatic = alayaCare.approveAutomatically;
      if (typeof automatic === "boolean") approval = { mode: automatic ? "automatic" : "reviewer" };
      else if (automatic !== undefined && automatic !== null) unknown.push({ store: "alayaCareFormSettings", key: "approveAutomatically", value: automatic });
      for (const key of ["requiresClockIn", "visitLinkRequired"] as const) {
        const value = alayaCare[key];
        if (value === true) targetOptions.push({ target: "alayacare", setting: key, value: true });
        else if (value !== undefined && value !== null && typeof value !== "boolean") unknown.push({ store: "alayaCareFormSettings", key, value });
      }
    }
  }

  return {
    lifecycle: {
      status,
      signing: { mode, requireRequiredAnswers, signatureTypes },
      fields: locks,
      authorship,
      approval,
      targetOptions,
    },
    sources: read,
    unknown,
  };
}

/** The form's lifecycle, read from every store (`readFormLifecycleDetails` also says where from). */
export function readFormLifecycle(
  document: FormLifecycleDocument | null | undefined,
  sources: FormLifecycleSources = {},
): FormLifecycle {
  return readFormLifecycleDetails(document, sources).lifecycle;
}
