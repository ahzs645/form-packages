import type { ParsedField } from "./document";

export interface Token {
  raw: string;
  normalized: string;
}

export interface TokenizedField {
  field: ParsedField;
  tokens: Token[];
}

export interface PrefixDescriptor {
  rawTokens: string[];
  normalizedTokens: string[];
}

export interface GroupEntry {
  row: string;
  column: string;
  field: ParsedField;
}

export interface GroupSummary {
  key: string;
  prefixLabel: string;
  prefix: PrefixDescriptor;
  totalFields: number;
  rows: string[];
  columns: string[];
  entries: GroupEntry[];
  /** Section-level inline show-when rule, carried from the builder section field. */
  visibility?: ParsedField["visibility"];
  /** Section-level layout type: "grid" for Row-based side-by-side, "stacked" for Column-based vertical */
  sectionLayoutType?: "grid" | "stacked";
  /** Number of columns per row when in grid layout (1-4, default 2) */
  gridColumns?: 1 | 2 | 3 | 4;
  /** Optional vertical question-spacing override inherited from the builder section. */
  questionSpacing?: "compact" | "standard" | "comfortable" | "spacious";
  /** Whether the section is collapsible */
  collapsible?: boolean;
  /** Whether the section starts collapsed */
  defaultCollapsed?: boolean;
  /** Optional CSS background for the section subtitle bar. Supports colors and gradients. */
  sectionSubtitleBackground?: string;
  /** Optional CSS border for the section subtitle bar. */
  sectionSubtitleBorder?: string;
  /** Optional CSS padding for the section subtitle bar. */
  sectionSubtitlePadding?: string;
  /** Whether to show a scale legend at the top */
  showScaleLegend?: boolean;
  /** Scale legend options */
  scaleLegendOptions?: Array<{ value: number; label: string; description?: string }>;
  /** Optional multi-author locking policy */
  authorshipPolicy?: {
    enabled?: boolean;
    granularity?: "field" | "row";
    lockOn?: "save" | "sign" | "submit";
    editableWindowHours?: number;
    showStatusColumn?: boolean;
  };
  /** Optional MOIS module link rendered in section subtitle */
  moisNavigation?: {
    moisModule: string;
    objectIdSourcePath?: string | null;
  } | null;
  /** @deprecated Prefer moisNavigation */
  moisModule?: string | null;
}

export interface GroupingPreset {
  id: string;
  name: string;
  prefix: PrefixDescriptor;
}

export function tokenizeLabel(text: string): Token[] {
  return text
    .replace(/[_.\-/]+/g, " ")
    // Split letters from numbers (e.g., "Date14" → "Date 14")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => ({ raw: token, normalized: token.toLowerCase() }));
}

export function summarizeGroup(prefix: PrefixDescriptor, matches: TokenizedField[]): GroupSummary {
  const entries: GroupEntry[] = [];
  const columns = new Set<string>();
  const rows = new Set<string>();

  matches.forEach(({ field, tokens }) => {
    if (tokens.length < prefix.normalizedTokens.length) return;
    const remainderTokens = tokens.slice(prefix.normalizedTokens.length);
    const remainder = remainderTokens.map((token) => token.raw).join(" ").trim();
    const { columnLabel, instanceLabel } = splitColumnAndInstance(remainder);
    const column = cleanColumnLabel(columnLabel);
    const row = instanceLabel ?? "—";
    columns.add(column);
    rows.add(row);
    entries.push({ row, column, field });
  });

  return {
    key: `${prefix.normalizedTokens.join("__")}__${entries.length}`,
    prefixLabel: prefix.rawTokens.join(" "),
    prefix,
    totalFields: entries.length,
    rows: sortRowLabels(rows),
    columns: Array.from(columns),
    entries
  };
}

export function matchesPrefix(tokens: Token[], prefix: PrefixDescriptor): boolean {
  if (tokens.length < prefix.normalizedTokens.length) return false;
  return prefix.normalizedTokens.every(
    (prefixToken, index) => tokens[index]?.normalized === prefixToken
  );
}

export function splitColumnAndInstance(label: string) {
  const trimmed = label.trim();
  if (!trimmed) {
    return { columnLabel: "Value", instanceLabel: null as string | null };
  }
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (match) {
    const column = match[1].trim() || "Value";
    return { columnLabel: column, instanceLabel: match[2] };
  }
  return { columnLabel: trimmed, instanceLabel: null as string | null };
}

export function cleanColumnLabel(label: string) {
  const normalized = label.replace(/\s+/g, " ").trim();
  if (!normalized) return "Value";
  return normalized
    .split(" ")
    .map((word) => (word.length > 2 ? capitalize(word) : word.toLowerCase()))
    .join(" ");
}

export function sortRowLabels(values: Set<string>) {
  return Array.from(values).sort((a, b) => {
    if (a === "—") return 1;
    if (b === "—") return -1;
    const aNum = Number(a);
    const bNum = Number(b);
    const aIsNum = !Number.isNaN(aNum);
    const bIsNum = !Number.isNaN(bNum);
    if (aIsNum && bIsNum) {
      return aNum - bNum;
    }
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    return a.localeCompare(b);
  });
}

export function buildPrefixFromText(text: string): PrefixDescriptor | null {
  const tokens = tokenizeLabel(text);
  if (tokens.length === 0) return null;
  return {
    rawTokens: tokens.map((token) => token.raw),
    normalizedTokens: tokens.map((token) => token.normalized)
  };
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
