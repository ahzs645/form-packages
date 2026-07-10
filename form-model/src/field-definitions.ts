import type { BuilderFieldType } from "./index";

export type BuilderFieldCategory = "input" | "selection" | "advanced" | "media";
export type BuilderFieldPalette = "primary" | "legacy" | false;

export interface BuilderFieldDefinition {
  type: BuilderFieldType;
  label: string;
  defaultLabel: string;
  description: string;
  category: BuilderFieldCategory;
  palette: BuilderFieldPalette;
}

export const BUILDER_FIELD_DEFINITIONS: readonly BuilderFieldDefinition[] = [
  { type: "text", label: "Text", defaultLabel: "Text field", description: "Short free-text input", category: "input", palette: "primary" },
  { type: "textarea", label: "Long Text", defaultLabel: "Long text", description: "Multi-line text area", category: "input", palette: "primary" },
  { type: "richText", label: "Rich Text", defaultLabel: "Rich text", description: "Formatted markdown content", category: "input", palette: "primary" },
  { type: "number", label: "Number", defaultLabel: "Number", description: "Numeric input", category: "input", palette: "primary" },
  { type: "computed", label: "Computed", defaultLabel: "Computed", description: "Read-only formula based on other fields", category: "advanced", palette: "primary" },
  { type: "email", label: "Email", defaultLabel: "Email address", description: "Email address with validation", category: "input", palette: "primary" },
  { type: "phone", label: "Phone", defaultLabel: "Phone number", description: "Phone number input", category: "input", palette: "primary" },
  { type: "url", label: "URL", defaultLabel: "Web address", description: "Web address input", category: "input", palette: "primary" },
  { type: "hyperlink", label: "Hyperlink", defaultLabel: "Hyperlink", description: "Guideline link button", category: "media", palette: "primary" },
  { type: "booleanYesNo", label: "Yes / No", defaultLabel: "Yes / No question", description: "Radio pair (mutually exclusive)", category: "selection", palette: "primary" },
  { type: "booleanSingle", label: "Checkbox", defaultLabel: "Checkbox", description: "Single checkbox toggle", category: "selection", palette: "primary" },
  { type: "choice", label: "Choice", defaultLabel: "Choice", description: "Dropdown or radio/checkbox group", category: "selection", palette: "primary" },
  { type: "date", label: "Date", defaultLabel: "Date", description: "Calendar date picker", category: "input", palette: "primary" },
  { type: "time", label: "Time", defaultLabel: "Time", description: "Time picker (currently 24-hour)", category: "input", palette: "primary" },
  { type: "datetime", label: "Date & Time", defaultLabel: "Date & time", description: "Combined date and time picker", category: "input", palette: "primary" },
  { type: "scale", label: "Scale", defaultLabel: "Scale", description: "Numbered scale with labels", category: "advanced", palette: "primary" },
  { type: "matrix", label: "Matrix", defaultLabel: "Matrix", description: "Grid selection (rows × columns)", category: "advanced", palette: "primary" },
  { type: "layoutTable", label: "Layout Table", defaultLabel: "Layout Table", description: "Exact printable table-cell layout", category: "advanced", palette: "primary" },
  { type: "signature", label: "Signature", defaultLabel: "Signature", description: "Digital signature pad", category: "media", palette: "primary" },
  { type: "table", label: "Table", defaultLabel: "Table", description: "Multi-column rows", category: "advanced", palette: "primary" },
  { type: "component", label: "Component", defaultLabel: "Component", description: "Prebuilt component placeholder", category: "advanced", palette: "primary" },
  { type: "section", label: "Section", defaultLabel: "New section", description: "Group fields into a collapsible section", category: "advanced", palette: "primary" },
  { type: "heading", label: "Heading", defaultLabel: "Heading", description: "Less prominent heading that groups indented fields", category: "advanced", palette: "primary" },
  { type: "rating", label: "Rating", defaultLabel: "Rating", description: "Star rating (1-10)", category: "advanced", palette: "legacy" },
  { type: "slider", label: "Slider", defaultLabel: "Slider", description: "Numeric range slider", category: "advanced", palette: "legacy" },
  { type: "file", label: "File", defaultLabel: "File", description: "File upload", category: "media", palette: false },
  { type: "password", label: "Password", defaultLabel: "Password", description: "Secret text input", category: "input", palette: false },
  { type: "barcode", label: "Barcode", defaultLabel: "Barcode", description: "Barcode scanner", category: "media", palette: false },
] as const;

const definitionByType = new Map(
  BUILDER_FIELD_DEFINITIONS.map((definition) => [definition.type, definition] as const),
);

export function getBuilderFieldDefinition(
  type: BuilderFieldType,
): BuilderFieldDefinition {
  const definition = definitionByType.get(type);
  if (!definition) {
    throw new Error(`Missing builder field definition for "${type}".`);
  }
  return definition;
}
