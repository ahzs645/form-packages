/**
 * Preview chart mutation store.
 *
 * Modeled on the FormTester's local server (smois serve-local.js), which
 * applies every targeted module-write mutation to an in-memory patient store
 * so the chart a form re-reads reflects what it wrote. The preview's
 * useMutation shim records the same applications here, useSourceData overlays
 * them onto the mock patient, and consumers re-render through the store
 * subscription — so the vendor CRUD idiom (mutate → check result.field →
 * refresh(sd)) round-trips in preview.
 *
 * Two engine contracts matter and are copied from the source:
 * - Mutation results are LIST-shaped ({ changeConnection: [{ patientId }] });
 *   the engine reads result.field[0], and a bare object stalls its save flow.
 *   addObservation is the exception: it returns the record itself.
 * - The record-id convention: id 0 (or omitted) creates, a positive id
 *   updates, a NEGATIVE id deletes. serve-local.js predates the delete
 *   convention; this store implements it (verified by the vendor's Bright
 *   Health test forms — see the write registry's recordIdKey).
 */

interface CollectionUpsertOp {
  kind: "upsert";
  collection: string;
  idKey: string;
  row: Record<string, unknown>;
}

interface CollectionDeleteOp {
  kind: "delete";
  collection: string;
  idKey: string;
  id: number;
}

interface RootMergeOp {
  kind: "merge";
  /** Nested object to merge into (e.g. "telecom"), or null for the patient root. */
  path: string | null;
  value: Record<string, unknown>;
}

type PreviewChartOp = CollectionUpsertOp | CollectionDeleteOp | RootMergeOp;

/** GraphQL field -> collection application recipe (mirrors serve-local.js). */
const COLLECTION_FIELDS: Record<
  string,
  { collection: string; idKey: string; variableKey: string }
> = {
  changeConnection: { collection: "connections", idKey: "connectionId", variableKey: "connection" },
  changeChartPreference: {
    collection: "preferences",
    idKey: "chartPreferenceId",
    variableKey: "chartPreference",
  },
  changePrescription: {
    collection: "prescriptions",
    idKey: "prescriptionId",
    variableKey: "prescription",
  },
  changeLongTermMedication: {
    collection: "longTermMedications",
    idKey: "longTermMedicationId",
    variableKey: "longTermMedication",
  },
  changePrescriptionLog: {
    collection: "prescriptionLogs",
    idKey: "prescriptionLogId",
    variableKey: "prescriptionLog",
  },
};

let ops: PreviewChartOp[] = [];
let version = 0;
/** High enough to never collide with scenario record ids. */
let nextCreatedId = 900001;
const listeners = new Set<() => void>();

/** Overlay memo: same (patient, version) in -> same object out, so consumers
 * that compare sourceData.patient by identity only re-render on real change. */
let overlayCacheBase: object | null = null;
let overlayCacheVersion = -1;
let overlayCacheResult: Record<string, unknown> | null = null;

function notify() {
  version += 1;
  overlayCacheBase = null;
  overlayCacheResult = null;
  listeners.forEach((listener) => listener());
}

export function subscribePreviewChart(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPreviewChartVersion(): number {
  return version;
}

export function resetPreviewChartMutations(): void {
  if (ops.length === 0) return;
  ops = [];
  notify();
}

/**
 * First GraphQL field a mutation document selects (e.g. "changeConnection"
 * from `mutation updateConnection(...) { changeConnection(...) { ... } }`).
 * The operation name often differs from the field; the field is what result
 * checks read.
 */
export const extractMutationFieldName = (document: string): string | null => {
  const bodyStart = document.indexOf("{");
  if (bodyStart === -1) return null;
  const match = document.slice(bodyStart + 1).match(/[A-Za-z_][A-Za-z0-9_]*/);
  return match ? match[0] : null;
};

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function listResult(field: string, variables: Record<string, unknown> | undefined) {
  return { [field]: [{ patientId: asNumber(variables?.patientId) }] };
}

function applyCollectionMutation(
  field: string,
  recipe: { collection: string; idKey: string; variableKey: string },
  variables: Record<string, unknown> | undefined
) {
  const input = isPlainObject(variables?.[recipe.variableKey])
    ? { ...(variables![recipe.variableKey] as Record<string, unknown>) }
    : {};
  const id = asNumber(input[recipe.idKey]);

  if (id < 0) {
    ops.push({ kind: "delete", collection: recipe.collection, idKey: recipe.idKey, id: -id });
  } else {
    if (id === 0) input[recipe.idKey] = nextCreatedId++;
    ops.push({ kind: "upsert", collection: recipe.collection, idKey: recipe.idKey, row: input });
  }
  notify();
  return listResult(field, variables);
}

/**
 * Apply one mutation document + variables to the preview chart and return the
 * engine-shaped result. Unknown fields change nothing but still resolve
 * list-shaped so post-mutation result checks do not stall.
 */
export function applyPreviewChartMutation(
  document: string,
  variables?: Record<string, unknown>
): Record<string, unknown> {
  const field = extractMutationFieldName(document);
  if (!field) return {};

  const collectionRecipe = COLLECTION_FIELDS[field];
  if (collectionRecipe) return applyCollectionMutation(field, collectionRecipe, variables);

  switch (field) {
    case "addObservation": {
      const input = isPlainObject(variables?.observation)
        ? { ...(variables!.observation as Record<string, unknown>) }
        : isPlainObject(variables)
          ? { ...variables }
          : {};
      const id = asNumber(input.observationId);
      if (id < 0) {
        ops.push({ kind: "delete", collection: "observations", idKey: "observationId", id: -id });
        notify();
        return { addObservation: null };
      }
      const record: Record<string, unknown> = {
        status: "F",
        collectedDateTime: new Date().toISOString(),
        ...input,
        observationId: id > 0 ? id : nextCreatedId++,
      };
      ops.push({ kind: "upsert", collection: "observations", idKey: "observationId", row: record });
      notify();
      return { addObservation: { ...record } };
    }

    case "changePatient": {
      const update = isPlainObject(variables?.patientUpdate)
        ? (variables!.patientUpdate as Record<string, unknown>)
        : isPlainObject(variables?.newPatient)
          ? (variables!.newPatient as Record<string, unknown>)
          : {};
      ops.push({ kind: "merge", path: null, value: { ...update } });
      notify();
      return listResult(field, variables);
    }

    case "changePatientContact": {
      const update = isPlainObject(variables?.newContact)
        ? (variables!.newContact as Record<string, unknown>)
        : {};
      ops.push({ kind: "merge", path: "telecom", value: { ...update } });
      notify();
      return listResult(field, variables);
    }

    case "changePatientAddress": {
      const update = isPlainObject(variables?.newAddress)
        ? (variables!.newAddress as Record<string, unknown>)
        : {};
      ops.push({ kind: "merge", path: "address", value: { ...update } });
      notify();
      return listResult(field, variables);
    }

    case "changePatientInsurance": {
      const update = isPlainObject(variables?.newInsurance)
        ? (variables!.newInsurance as Record<string, unknown>)
        : {};
      ops.push({ kind: "merge", path: null, value: { ...update } });
      notify();
      return listResult(field, variables);
    }

    case "changeDocument":
      // The engine reads result.changeDocument[0].documentId (the attach
      // flow routes on it) — serve-local.js learned this the hard way.
      return { changeDocument: [{ documentId: nextCreatedId++ }] };

    default:
      return listResult(field, variables);
  }
}

function mergeName(base: unknown, update: Record<string, unknown>): Record<string, unknown> {
  // serve-local.js recomputes name.text ("FAMILY, First Middle") after a name
  // merge so the NameBlock reflects the change.
  const merged = { ...(isPlainObject(base) ? base : {}), ...update };
  if (update.family !== undefined || update.first !== undefined || update.middle !== undefined) {
    merged.text = `${String(merged.family ?? "").toUpperCase()}, ${merged.first ?? ""}${
      merged.middle ? ` ${merged.middle}` : ""
    }`;
  }
  return merged;
}

/**
 * Apply the accumulated mutations onto a base patient object. Pure with
 * respect to the input; memoized on (patient, version) so unchanged state
 * keeps object identity.
 */
export function overlayPreviewChartMutations<T extends Record<string, unknown>>(patient: T): T {
  if (ops.length === 0) return patient;
  if (overlayCacheBase === patient && overlayCacheVersion === version && overlayCacheResult) {
    return overlayCacheResult as T;
  }

  const next: Record<string, unknown> = { ...patient };
  for (const op of ops) {
    if (op.kind === "merge") {
      if (op.path === null) {
        for (const [key, value] of Object.entries(op.value)) {
          next[key] = key === "name" && isPlainObject(value) ? mergeName(next.name, value) : value;
        }
      } else {
        next[op.path] = {
          ...(isPlainObject(next[op.path]) ? (next[op.path] as Record<string, unknown>) : {}),
          ...op.value,
        };
      }
      continue;
    }

    const rows = Array.isArray(next[op.collection])
      ? [...(next[op.collection] as Array<Record<string, unknown>>)]
      : [];
    if (op.kind === "delete") {
      next[op.collection] = rows.filter((row) => asNumber(row?.[op.idKey]) !== op.id);
    } else {
      const index = rows.findIndex(
        (row) => asNumber(row?.[op.idKey]) === asNumber(op.row[op.idKey])
      );
      if (index >= 0) {
        rows[index] = { ...rows[index], ...op.row };
      } else if (op.collection === "observations") {
        rows.unshift(op.row);
      } else {
        rows.push(op.row);
      }
      next[op.collection] = rows;
    }
  }

  overlayCacheBase = patient;
  overlayCacheVersion = version;
  overlayCacheResult = next;
  return next as T;
}
