/** Portable authoring contract; native Bedrock serialization is a separate adapter. */
export type SmartTemplateLayout = "bordered" | "borderless" | "horizontal" | "vertical" | "table-list";
export type SmartTemplateKind = "clinical-events" | "allergies" | "problems" | "reports" | "orders" | "io" | "care-pathways";
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
  /**
   * Reports filters. `dateFormat` is the Reports "Date Time Format": 1 short
   * numeric, 2 abbreviated ("medium"), 3 long. `parentTypes` is "Parent
   * Types" (report groupers by event class, independent of the event set).
   */
  report: { currentUserOnly: boolean; signer: boolean; preliminary: boolean; start: string; end: string; caseSensitive: boolean; dateFormat: "short" | "medium" | "long"; parentTypes?: string[] };
  /** Non-Medication Orders: "Order Status Options" and "Synonym Selection Options" (display names). */
  order: { statuses: string[]; synonyms?: string[] };
  /** Intake and Output "Output Count Data": outputs shown as a count of entries rather than volume (names or codes). */
  io: { countCodes: string[] };
  /**
   * Source Wizard settings an import could not translate for this component,
   * kept verbatim so BEDROCK-REVIEW.csv can hand them to the analyst.
   */
  unmappedSettings?: { filter: string; value: string }[];
  /**
   * A View Builder component with no documented Wizard filters to map
   * (Care Pathways, or a component name the importer does not recognise):
   * named, with the source's raw settings, and handed to the analyst in
   * BEDROCK-REVIEW.csv. Allergies, Problems, Reports, Non-Medication Orders
   * and Intake and Output are mapped from their documented filter names.
   */
  nativeSetup?: { status: "unconfigured"; component: string; reportMean?: string; settings: { filter: string; value: string }[] };
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
  /** Source evidence only; retained when a draft is edited, never executed. */
  provenance?: {
    kind: "workbook" | "bedrock";
    sourceName: string;
    sheet?: string;
    notes: string[];
    settings?: { component: string; filter: string; value: string; row?: number }[];
  };
  native: {
    wizardIdentifier?: string;
    cki?: string;
    begin?: string;
    end?: string;
    packageVersion?: string;
    codeValueActive?: boolean;
    scriptInstalled?: boolean;
    documentTemplateActive?: boolean;
    /** PowerNote term association in Knowledge Editor; separate from a PowerForm placement. */
    powerNoteTerm?: { canonicalSentence?: string; term?: string; conceptCki?: string };
  };
}
