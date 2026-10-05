import { subformDataEntryOf } from "./field-group";
import type { ModuleConfig } from "./layout";

/** Declared backing destinations, not inferred from similar PDF field names. */
export function subformPdfDestinationIds(module: ModuleConfig | null | undefined): Set<string> {
  const ids = new Set<string>();
  if (!module?.enabled) return ids;
  const add = (id: string | null | undefined) => { if (id) ids.add(id); };
  if (module.kind === "subform-scoring") {
    module.scoring?.questions.forEach(question => {
      add(question.fieldId);
      question.childFieldIds?.forEach(add);
    });
    module.scoring?.totals.forEach(total => {
      add(total.targetFieldId);
      total.targetFieldIds?.forEach(add);
    });
    module.subformScoring?.formDataOutputs?.forEach(output => add(output.targetPath));
  } else if (module.kind === "subform-data-entry" || module.kind === "subform-calculator") {
    subformDataEntryOf(module.subformDataEntry)?.fields.forEach(field => add(field.id));
    module.subformDataEntry?.formDataOutputs?.forEach(output => add(output.targetPath));
  }
  return ids;
}

/** First declared owner wins; additional modules do not duplicate a destination. */
export function sectionSubformPdfOwners(root: ModuleConfig | null | undefined): Map<string, number> {
  const owners = new Map<string, number>();
  if (!root?.enabled) return owners;
  [root, ...(root.additionalSubformModules ?? [])].forEach((module, index) => {
    subformPdfDestinationIds(module).forEach(id => { if (!owners.has(id)) owners.set(id, index); });
  });
  return owners;
}
