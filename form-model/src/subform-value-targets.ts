/**
 * Which form field a subform value fills.
 *
 * A subform's totals, calculations and fields can each write their value
 * into a field of the form (a scoring total's `targetFieldId` /
 * `targetFieldIds`, or a `formDataOutputs` entry). The field may be a
 * combined field holding several PDF boxes: the value then prints in every
 * box, because a combined field fills all of its PDF destinations from its
 * one value. The link is stored once, on the subform; a field reads it back
 * here ("calculated from …").
 *
 * When fields are combined, the outputs that filled the members fill the
 * combined field instead; uncombining gives each member its outputs back.
 */
import { subformDataEntryOf } from "./field-group";
import type { GroupLayoutDraft, ModuleConfig, SubformFormDataOutput } from "./layout";

export type SubformValueKind = "total" | "calculation" | "field";

export interface SubformValueRef {
  draftKey: string;
  /** 0 = the draft's moduleConfig, n = its n-th additional subform. */
  moduleIndex: number;
  moduleTitle: string;
  kind: SubformValueKind;
  /** The total, calculation or subform field id. */
  id: string;
  label: string;
}

type DraftLike = Pick<GroupLayoutDraft, "key" | "moduleConfig">;

function modulesOf(draft: DraftLike): ModuleConfig[] {
  const root = draft.moduleConfig;
  if (!root) return [];
  return [root, ...(root.additionalSubformModules ?? [])];
}

function isScoringModule(module: ModuleConfig): boolean {
  return module.kind === "subform-scoring" || (!module.kind && Boolean(module.scoring) && Boolean(module.subformScoring));
}

function isDataEntryModule(module: ModuleConfig): boolean {
  return module.kind === "subform-data-entry" || module.kind === "subform-calculator";
}

export function subformValueKey(ref: Pick<SubformValueRef, "draftKey" | "moduleIndex" | "kind" | "id">): string {
  return `${ref.draftKey}#${ref.moduleIndex}:${ref.kind}:${ref.id}`;
}

/** Every subform value in these drafts that can fill a form field. */
export function listSubformValues(drafts: readonly DraftLike[]): SubformValueRef[] {
  const refs: SubformValueRef[] = [];
  for (const draft of drafts) {
    modulesOf(draft).forEach((module, moduleIndex) => {
      if (!module.enabled) return;
      const moduleTitle = module.title || "Subform";
      const base = { draftKey: draft.key, moduleIndex, moduleTitle };
      if (isScoringModule(module)) {
        (module.scoring?.totals ?? []).forEach((total) =>
          refs.push({ ...base, kind: "total", id: total.id, label: total.label || total.id }));
      } else if (isDataEntryModule(module)) {
        const dataEntry = subformDataEntryOf(module.subformDataEntry);
        (dataEntry?.calculations ?? []).forEach((calculation) =>
          refs.push({ ...base, kind: "calculation", id: calculation.id, label: calculation.label || calculation.id }));
        (dataEntry?.fields ?? [])
          .filter((entry) => entry.type !== "heading")
          .forEach((entry) => refs.push({ ...base, kind: "field", id: entry.id, label: entry.label || entry.id }));
      }
    });
  }
  return refs;
}

function outputSourceRef(output: SubformFormDataOutput): { kind: SubformValueKind; id: string } | null {
  const source = output.source ?? "field";
  if (source === "total" && output.totalId) return { kind: "total", id: output.totalId };
  if (source === "calculation" && output.calculationId) return { kind: "calculation", id: output.calculationId };
  if (source === "field" && output.fieldId) return { kind: "field", id: output.fieldId };
  return null;
}

function formDataOutputsOf(module: ModuleConfig): SubformFormDataOutput[] {
  return (isScoringModule(module) ? module.subformScoring?.formDataOutputs : module.subformDataEntry?.formDataOutputs) ?? [];
}

/** The subform values that write into this field. Usually one; more is a conflict the author should resolve. */
export function subformValuesWritingTo(drafts: readonly DraftLike[], fieldId: string): SubformValueRef[] {
  const byKey = new Map(listSubformValues(drafts).map((ref) => [subformValueKey(ref), ref]));
  const found = new Map<string, SubformValueRef>();
  const record = (draftKey: string, moduleIndex: number, kind: SubformValueKind, id: string) => {
    const ref = byKey.get(subformValueKey({ draftKey, moduleIndex, kind, id }));
    if (ref) found.set(subformValueKey(ref), ref);
  };
  for (const draft of drafts) {
    modulesOf(draft).forEach((module, moduleIndex) => {
      if (!module.enabled) return;
      if (isScoringModule(module)) {
        (module.scoring?.totals ?? []).forEach((total) => {
          if (total.targetFieldId === fieldId || total.targetFieldIds?.includes(fieldId)) {
            record(draft.key, moduleIndex, "total", total.id);
          }
        });
      }
      formDataOutputsOf(module).forEach((output) => {
        const source = output.targetPath === fieldId ? outputSourceRef(output) : null;
        if (source) record(draft.key, moduleIndex, source.kind, source.id);
      });
    });
  }
  return [...found.values()];
}

/** A module with every output target id mapped (`map` returns the ids that replace one, possibly none). */
function mapModuleTargets(module: ModuleConfig, map: (id: string) => string[]): ModuleConfig {
  let changed = false;
  const mapList = (ids: readonly string[]) => {
    const next = Array.from(new Set(ids.flatMap(map)));
    if (next.length !== ids.length || next.some((id, index) => id !== ids[index])) changed = true;
    return next;
  };
  let scoring = module.scoring;
  if (scoring?.totals?.length) {
    const totals = scoring.totals.map((total) => {
      const targets = [
        ...(total.targetFieldId ? [total.targetFieldId] : []),
        ...(total.targetFieldIds ?? []),
      ];
      if (targets.length === 0) return total;
      const next = mapList(Array.from(new Set(targets)));
      const { targetFieldId: _single, targetFieldIds: _list, ...rest } = total;
      return {
        ...rest,
        ...(next.length > 0 ? { targetFieldId: next[0] } : { targetFieldId: null }),
        ...(next.length > 1 ? { targetFieldIds: next } : total.targetFieldIds ? { targetFieldIds: next } : {}),
      };
    });
    scoring = { ...scoring, totals };
  }
  const mapOutputs = (outputs: SubformFormDataOutput[] | undefined) => {
    if (!outputs?.length) return outputs;
    const seen = new Set<string>();
    const next: SubformFormDataOutput[] = [];
    for (const output of outputs) {
      const targets = map(output.targetPath);
      if (targets.length !== 1 || targets[0] !== output.targetPath) changed = true;
      targets.forEach((targetPath, index) => {
        const source = outputSourceRef(output);
        const signature = `${targetPath}|${source ? `${source.kind}:${source.id}` : output.id}`;
        if (seen.has(signature)) {
          changed = true;
          return;
        }
        seen.add(signature);
        next.push({ ...output, targetPath, ...(index > 0 ? { id: `${output.id}_${index + 1}` } : {}) });
      });
    }
    return next;
  };
  const subformScoring = module.subformScoring
    ? { ...module.subformScoring, formDataOutputs: mapOutputs(module.subformScoring.formDataOutputs) }
    : module.subformScoring;
  const subformDataEntry = module.subformDataEntry
    ? { ...module.subformDataEntry, formDataOutputs: mapOutputs(module.subformDataEntry.formDataOutputs) }
    : module.subformDataEntry;
  if (!changed) return module;
  return {
    ...module,
    ...(scoring ? { scoring } : {}),
    ...(subformScoring ? { subformScoring } : {}),
    ...(subformDataEntry ? { subformDataEntry } : {}),
  };
}

function mapDraftTargets<T extends DraftLike>(drafts: readonly T[], map: (id: string) => string[]): T[] {
  let changed = false;
  const next = drafts.map((draft) => {
    const root = draft.moduleConfig;
    if (!root) return draft;
    const mappedRoot = mapModuleTargets(root, map);
    const extras = root.additionalSubformModules?.map((extra) => mapModuleTargets(extra, map));
    const extrasChanged = Boolean(extras?.some((extra, index) => extra !== root.additionalSubformModules![index]));
    if (mappedRoot === root && !extrasChanged) return draft;
    changed = true;
    return {
      ...draft,
      moduleConfig: { ...mappedRoot, ...(extras ? { additionalSubformModules: extras } : {}) },
    };
  });
  return changed ? next : (drafts as T[]);
}

/**
 * Fields were combined: every subform output that filled one of the members
 * fills the combined field instead (once). The same array when no output
 * named a member.
 */
export function retargetSubformOutputsToCombined<T extends DraftLike>(
  drafts: readonly T[],
  memberIds: readonly string[],
  combinedId: string,
): T[] {
  const members = new Set(memberIds);
  return mapDraftTargets(drafts, (id) => (members.has(id) ? [combinedId] : [id]));
}

/**
 * A combined field was split: every subform output that filled it fills
 * each member again, so every PDF box keeps its value.
 */
export function retargetSubformOutputsToMembers<T extends DraftLike>(
  drafts: readonly T[],
  combinedId: string,
  memberIds: readonly string[],
): T[] {
  return mapDraftTargets(drafts, (id) => (id === combinedId ? [...memberIds] : [id]));
}

let outputCounter = 0;
function newOutputId(fieldId: string): string {
  outputCounter += 1;
  return `fill_${fieldId}_${Date.now().toString(36)}_${outputCounter}`;
}

/**
 * Make `ref` the one subform value that fills `fieldId` (null: none). Any
 * other output writing into the field stops. A total writes through its
 * targets; a calculation or subform field through a form-data output. When
 * the subform keeps only its declared outputs (`persistNestedFields: false`),
 * a total gets a form-data output too, so the value still reaches the form.
 */
export function setSubformValueForField<T extends DraftLike>(
  drafts: readonly T[],
  fieldId: string,
  ref: Pick<SubformValueRef, "draftKey" | "moduleIndex" | "kind" | "id"> | null,
): T[] {
  const cleared = mapDraftTargets(drafts, (id) => (id === fieldId ? [] : [id]));
  if (!ref) return cleared;
  return cleared.map((draft) => {
    if (draft.key !== ref.draftKey || !draft.moduleConfig) return draft;
    const root = draft.moduleConfig;
    const modules = modulesOf(draft);
    const module = modules[ref.moduleIndex];
    if (!module) return draft;
    let next: ModuleConfig = module;
    if (ref.kind === "total" && module.scoring) {
      next = {
        ...module,
        scoring: {
          ...module.scoring,
          totals: module.scoring.totals.map((total) => {
            if (total.id !== ref.id) return total;
            const targets = Array.from(new Set([
              ...(total.targetFieldId ? [total.targetFieldId] : []),
              ...(total.targetFieldIds ?? []),
              fieldId,
            ]));
            return { ...total, targetFieldId: targets[0], ...(targets.length > 1 ? { targetFieldIds: targets } : {}) };
          }),
        },
      };
      if (module.subformScoring?.persistNestedFields === false) {
        next = {
          ...next,
          subformScoring: {
            ...module.subformScoring,
            formDataOutputs: [
              ...(module.subformScoring.formDataOutputs ?? []),
              { id: newOutputId(fieldId), targetPath: fieldId, source: "total", totalId: ref.id },
            ],
          },
        };
      }
    } else if ((ref.kind === "calculation" || ref.kind === "field") && module.subformDataEntry) {
      const output: SubformFormDataOutput = ref.kind === "calculation"
        ? { id: newOutputId(fieldId), targetPath: fieldId, source: "calculation", calculationId: ref.id }
        : { id: newOutputId(fieldId), targetPath: fieldId, source: "field", fieldId: ref.id };
      next = {
        ...module,
        subformDataEntry: {
          ...module.subformDataEntry,
          formDataOutputs: [...(module.subformDataEntry.formDataOutputs ?? []), output],
        },
      };
    }
    if (next === module) return draft;
    const moduleConfig: ModuleConfig = ref.moduleIndex === 0
      ? { ...next, additionalSubformModules: root.additionalSubformModules }
      : {
          ...root,
          additionalSubformModules: (root.additionalSubformModules ?? []).map((extra, index) =>
            index === ref.moduleIndex - 1 ? next : extra),
        };
    return { ...draft, moduleConfig };
  });
}
