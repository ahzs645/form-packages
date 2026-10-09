import type { CodeValueRow, Effective, MillenniumTables } from "./types";

/** Millennium's open-ended effective date. */
export const END_OF_TIME = new Date("2100-12-31T23:59:59.000Z");

/** Row is active and inside its effective window at `now`. */
export function isCurrent(row: Effective, now: Date): boolean {
  if (!row.active) return false;
  if (row.begEffective.getTime() > now.getTime()) return false;
  return row.endEffective === null || row.endEffective.getTime() > now.getTime();
}

export function emptyTables(): MillenniumTables {
  return {
    codeValues: [], prsnl: [], persons: [], personAliases: [], personNames: [],
    personPrsnlReltns: [], personPersonReltns: [], encounters: [], encntrAliases: [],
    encntrPrsnlReltns: [], encntrDomains: [], organizations: [], addresses: [], phones: [],
    nomenclature: [], allergies: [], problems: [], diagnoses: [], locations: [],
    dmInfo: [], longText: [], refData: [], documents: [], bedrockComponents: [], patientLists: [],
  };
}

/** Upper-case, alphanumerics only: Millennium's display_key / name_key rule. */
export function toKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * The synthetic database plus the lookups every program needs.
 *
 * Code values are indexed by id and by (set, meaning) / (set, display key), the
 * three ways CCL reaches them (uar_get_code_display, uar_get_code_by MEANING /
 * DISPLAYKEY). Ids come from one allocator so nothing collides across tables.
 */
export class MillenniumDb {
  readonly tables: MillenniumTables;
  private nextId: number;
  private byId = new Map<number, CodeValueRow>();

  constructor(tables: MillenniumTables = emptyTables(), firstId = 90_000_000) {
    this.tables = tables;
    this.nextId = firstId;
    for (const row of tables.codeValues) this.byId.set(row.codeValue, row);
  }

  allocateId(): number {
    return this.nextId++;
  }

  addCode(row: Omit<CodeValueRow, "codeValue" | "displayKey" | "description" | "definition" | "cki" | "conceptCki" | "collationSeq" | "active" | "endEffective"> & Partial<CodeValueRow>): number {
    const codeValue = row.codeValue ?? this.allocateId();
    const full: CodeValueRow = {
      codeValue,
      codeSet: row.codeSet,
      cdfMeaning: row.cdfMeaning,
      display: row.display,
      displayKey: row.displayKey ?? toKey(row.display),
      description: row.description ?? row.display,
      definition: row.definition ?? row.display,
      cki: row.cki ?? "",
      conceptCki: row.conceptCki ?? "",
      collationSeq: row.collationSeq ?? 0,
      active: row.active ?? true,
      endEffective: row.endEffective ?? null,
    };
    this.tables.codeValues.push(full);
    this.byId.set(codeValue, full);
    return codeValue;
  }

  code(codeValue: number): CodeValueRow | undefined {
    return codeValue ? this.byId.get(codeValue) : undefined;
  }

  /** uar_get_code_display: "" for 0 or an unknown code. */
  display(codeValue: number): string {
    return this.code(codeValue)?.display ?? "";
  }

  meaning(codeValue: number): string {
    return this.code(codeValue)?.cdfMeaning ?? "";
  }

  description(codeValue: number): string {
    return this.code(codeValue)?.description ?? "";
  }

  /** uar_get_code_by("MEANING", set, meaning): 0 when absent. */
  byMeaning(codeSet: number, cdfMeaning: string): number {
    const wanted = cdfMeaning.toUpperCase();
    return this.tables.codeValues.find((row) => row.codeSet === codeSet && row.active && row.cdfMeaning.toUpperCase() === wanted)?.codeValue ?? 0;
  }

  /** uar_get_code_by("DISPLAYKEY", set, key): 0 when absent. */
  byDisplayKey(codeSet: number, displayKey: string): number {
    const wanted = toKey(displayKey);
    return this.tables.codeValues.find((row) => row.codeSet === codeSet && row.active && row.displayKey === wanted)?.codeValue ?? 0;
  }

  codeSet(codeSet: number): CodeValueRow[] {
    return this.tables.codeValues.filter((row) => row.codeSet === codeSet);
  }

  /** DM_INFO INS / CONTENT_SERVICE_URL, the root every static-content URL hangs off. */
  contentServiceUrl(): string {
    return this.tables.dmInfo.find((row) => row.infoDomain === "INS" && row.infoName === "CONTENT_SERVICE_URL")?.infoChar ?? "";
  }

  prsnlName(personId: number): string {
    return this.tables.prsnl.find((row) => row.personId === personId)?.nameFullFormatted ?? "";
  }
}
