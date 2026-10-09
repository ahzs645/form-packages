import type { MillenniumDb } from "../db/db";
import type { CclNotice } from "../ccl/types";

/**
 * Shared state and helpers for the Clinical Office v5 entry simulation.
 * Behaviour follows the written spec (packages/cerner-sim/SPEC.md), not the
 * vendor source.
 */

export type Json = Record<string, unknown>;

/** CCL record field access ignores case, so payload keys do too. */
export function pick(source: unknown, key: string): unknown {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Json;
  if (key in record) return record[key];
  const lower = key.toLowerCase();
  for (const name of Object.keys(record)) if (name.toLowerCase() === lower) return record[name];
  return undefined;
}

export function present(source: unknown, key: string): boolean {
  return pick(source, key) !== undefined;
}

/** `validate(x, 0) = 1`: JSON true or 1. A flag sent as an object or false is off. */
export function flag(source: unknown, key: string): boolean {
  const value = pick(source, key);
  return value === true || value === 1 || value === "1";
}

export function num(value: unknown): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function str(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

export function list(value: unknown): Json[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as Json[]) : [];
}

export interface Visit { personId: number; encntrId: number }

/** Everything one entry run shares between its programs (the CCL globals). */
export interface EntryState {
  payload: Json;
  mode: "CHART" | "ORGANIZER" | "";
  visits: Visit[];
  patients: number[];
  prsnlSource: number[];
  parents: { id: number; name: "PERSON" | "ORGANIZATION" }[];
  refCodeSet: { objectName: string; columnName: string; description: string; codeSet: number }[];
  reference: boolean;
  errors: { code: number; message: string }[];
  notices: CclNotice[];
  /** Index of the custom script running now (CCL's nScript). */
  scriptIndex: number;
}

export function addPatient(state: EntryState, personId: number) {
  if (!state.patients.includes(personId)) state.patients.push(personId);
}

export function addPrsnl(state: EntryState, personId: number) {
  if (personId > 0 && !state.prsnlSource.includes(personId)) state.prsnlSource.push(personId);
}

export function addParent(state: EntryState, id: number, name: "PERSON" | "ORGANIZATION") {
  if (!state.parents.some((parent) => parent.id === id && parent.name === name)) state.parents.push({ id, name });
}

/**
 * typeList filtering: a code value list per code set, or null for "no
 * filter". An entry whose type/typeCd matches nothing contributes nothing,
 * and a code set with no matches is unfiltered — the real scripts behave so.
 */
export function typeFilter(db: MillenniumDb, state: EntryState, codeSet: number): Set<number> | null {
  const entries = list(pick(state.payload, "typeList")).filter((entry) => num(pick(entry, "codeSet")) === codeSet);
  if (!entries.length) return null;
  const allowed = new Set<number>();
  for (const entry of entries) {
    const typeCd = num(pick(entry, "typeCd"));
    if (typeCd > 0 && db.code(typeCd)) allowed.add(typeCd);
    const type = str(pick(entry, "type")).trim();
    if (type) {
      for (const row of db.codeSet(codeSet)) {
        if (!row.active || row.endEffective || row.codeValue <= 0) continue;
        if ((row.cdfMeaning && row.cdfMeaning === type) || row.displayKey === type) allowed.add(row.codeValue);
      }
    }
  }
  return allowed.size ? allowed : null;
}

export function allowedBy(filter: Set<number> | null, codeValue: number): boolean {
  return filter === null || filter.has(codeValue);
}

/** Section options object (`person: {aliases: true}`); `true` alone means no options. */
export function options(state: EntryState, key: string): Json {
  const value = pick(state.payload, key);
  return value && typeof value === "object" ? (value as Json) : {};
}

/** Every domain script's skipJSON check, on its own section. */
export function skipJson(state: EntryState, key: string): boolean {
  return flag(options(state, key), "skipJSON");
}

/** Record a reference-mode code-set row. */
export function refRows(state: EntryState, objectName: string, columns: [string, number, string][]) {
  for (const [columnName, codeSet, description] of columns) state.refCodeSet.push({ objectName, columnName, description, codeSet });
}
