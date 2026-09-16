/** Portable authoring contract; native Bedrock serialization is a separate adapter. */
export type SmartTemplateLayout = "bordered" | "borderless" | "horizontal" | "vertical" | "table-list";
export type SmartTemplateKind = "clinical-events" | "allergies" | "problems" | "reports" | "orders" | "io";
export interface SmartTemplateSelection {
  id: string;
  label: string;
  system: string;
  code: string;
  /** Optional exact aliases explicitly selected by an author; never inferred. */
  aliases?: string[];
  eventSet?: string;
}
export interface SmartTemplateComponent {
  sourcePreset?: { id: string; basis: string };
  id: string;
  kind: SmartTemplateKind;
  heading: string;
  layout: SmartTemplateLayout;
  columns: number;
  emptyMessage: string;
  showEmptyHeader: boolean;
  encounter: "any" | "selected";
  period?: { value: number; unit: "hours" | "days" | "weeks" | "months" | "years" };
  retrieval: "latest" | "all";
  /** null means all qualifying results in the available snapshot. */
  trendLimit: number | null;
  sort: "alphabetic" | "hierarchy" | "onset" | "reverse-onset" | "severity" | "classification" | "ranking";
  qualifyDate: "clinical" | "posting";
  displayDate: "clinical" | "posting";
  dateFormat: "date" | "date-time" | "time" | "none";
  groups: { id: string; heading: string; selections: SmartTemplateSelection[] }[];
  clinical: { referenceRanges: boolean; numericTag: boolean };
  allergy: { reaction: boolean; severity: boolean; onset: boolean };
  problem: { classifications: string[]; classification: boolean; comments: boolean; onset: boolean };
  report: { currentUserOnly: boolean; signer: boolean; preliminary: boolean; start: string; end: string; caseSensitive: boolean; dateFormat: "short" | "medium" | "long" };
  order: { statuses: string[] };
  io: { countCodes: string[] };
}
/** A form-local reference. The source owns the only copy of the definition. */
export interface SmartTemplateLink {
  sourceFieldId: string;
  scope?: "PERSON" | "VISIT";
  components?: Record<string, Partial<Pick<SmartTemplateComponent,
    "heading" | "layout" | "columns" | "emptyMessage" | "showEmptyHeader" | "encounter" |
    "retrieval" | "trendLimit" | "sort" | "qualifyDate" | "displayDate" | "dateFormat">> & { period?: SmartTemplateComponent["period"] | null }>;
}
export interface SmartTemplateDefinition {
  version: 1;
  id: string;
  name: string;
  target: "unknown" | "legacy" | "administration-119";
  scope: "PERSON" | "VISIT";
  mode: "display" | "documentation";
  components: SmartTemplateComponent[];
  native: {
    wizardIdentifier?: string;
    cki?: string;
    begin?: string;
    end?: string;
    packageVersion?: string;
    codeValueActive?: boolean;
    scriptInstalled?: boolean;
    documentTemplateActive?: boolean;
  };
}
