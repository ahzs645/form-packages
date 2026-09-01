import type { BuilderField, BuilderFieldType } from "@webforms/form-model";

/**
 * The Terra control vocabulary a form field can map to — the Cerner analogue
 * of AlayaCare's `AlayaCareFieldType`.
 */
export type TerraControl =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "datetime"
  | "time"
  | "checkbox"
  | "radio-group"
  | "checkbox-group"
  | "select"
  | "select-search"
  | "section"
  | "heading"
  | "hyperlink"
  | "rich-text"
  | "computed-display"
  | "table"
  | "component-placeholder";

export type TerraControlSource =
  | "override"
  | "choice-style"
  | "type"
  | "unsupported";

export interface ResolvedTerraControl {
  control: TerraControl | null;
  source: TerraControlSource;
  /** Present when control is null. */
  reason?: string;
}

/**
 * Per-field escape hatch for this target.
 *
 * AlayaCare keeps its equivalent (`BuilderAlayaCareConfig`) on `BuilderField`
 * in the shared model, which is what makes author overrides and lossless
 * round-tripping possible. We read it structurally for now so the target can
 * mature without churning the shared package; hoist it into form-model as
 * `terraConfig` when this graduates.
 */
export interface TerraFieldConfig {
  /** Force a specific control, bypassing style and type inference. */
  control?: TerraControl;
  /** Render a searchable select even for short option lists. */
  searchable?: boolean;
  /** Terra Button variant for action-like fields. */
  buttonVariant?: string;
}

export function getTerraFieldConfig(field: BuilderField): TerraFieldConfig | undefined {
  return (field as BuilderField & { terraConfig?: TerraFieldConfig | null }).terraConfig ?? undefined;
}

/**
 * Why a field cannot be rendered by this target. Mirrors AlayaCare's
 * UNSUPPORTED_FIELD_TYPE_REASONS so the compatibility report can explain
 * itself rather than silently dropping fields.
 */
export const UNSUPPORTED_REASONS: Partial<Record<BuilderFieldType, string>> = {
  signature: "Signature capture has no Terra equivalent; use a PowerForm signature or an attestation field.",
  file: "File upload has no Terra equivalent in the vendored component set.",
  rating: "Rating has no Terra equivalent; model it as a choice or a scale.",
  slider: "Slider has no Terra equivalent; model it as a number or a choice.",
  scale: "Scale has no Terra equivalent yet; model it as a radio group.",
  matrix: "Matrix questions are not supported; split them into individual choice fields.",
  barcode: "Barcode capture has no Terra equivalent.",
  password: "Password fields are not meaningful in a clinical form.",
  layoutTable: "Layout tables are not supported yet; the Terra table renders data rows only.",
};

/**
 * Choice style → Terra control. This is the single most consequential mapping
 * in the target: `choice` is by far the most common field kind in real forms,
 * and its style decides between four different Terra controls.
 */
export function resolveChoiceControl(field: BuilderField): TerraControl {
  const optionCount = field.options?.length ?? 0;
  switch (field.choiceStyle) {
    case "radio":
      return "radio-group";
    case "checkbox":
      return "checkbox-group";
    case "dropdown":
    case "simpleCodeSelect":
      return "select";
    case "multiselect":
    case "findCode":
      return "select-search";
    default:
      // Unstyled choices follow MOIS's own default (findCode) once the list is
      // long enough to be worth searching, and stay a radio group when short.
      return optionCount > 8 ? "select-search" : "radio-group";
  }
}

/**
 * Resolve a builder field to a Terra control.
 *
 * Precedence mirrors the AlayaCare target: an explicit author override wins,
 * then choice-style inference, then the type switch.
 */
export function resolveTerraControl(field: BuilderField): ResolvedTerraControl {
  const override = getTerraFieldConfig(field)?.control;
  if (override) return { control: override, source: "override" };

  if (field.type === "choice") {
    return { control: resolveChoiceControl(field), source: "choice-style" };
  }

  switch (field.type) {
    case "section":
      return { control: "section", source: "type" };
    case "heading":
      return { control: "heading", source: "type" };
    case "text":
    case "email":
    case "phone":
    case "url":
      return { control: "text", source: "type" };
    case "textarea":
      return { control: "textarea", source: "type" };
    case "number":
      return { control: "number", source: "type" };
    case "date":
      return { control: "date", source: "type" };
    case "datetime":
      return { control: "datetime", source: "type" };
    case "time":
      return { control: "time", source: "type" };
    case "booleanSingle":
      return { control: "checkbox", source: "type" };
    case "booleanYesNo":
      return { control: "radio-group", source: "type" };
    case "computed":
      return { control: "computed-display", source: "type" };
    case "hyperlink":
      return { control: "hyperlink", source: "type" };
    case "richText":
      return { control: "rich-text", source: "type" };
    case "table":
      return { control: "table", source: "type" };
    case "component":
      // Graceful degradation: a placeholder naming the component beats
      // dropping a field the author deliberately placed.
      return { control: "component-placeholder", source: "type" };
    default:
      return {
        control: null,
        source: "unsupported",
        reason:
          UNSUPPORTED_REASONS[field.type] ??
          `Field type "${field.type}" has no Terra equivalent.`,
      };
  }
}
