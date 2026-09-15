import type { BuilderField, BuilderRichTextImageAsset } from "./index";

export type RichTextTarget = "mois" | "alayacare" | "fhir" | "cerner";
export interface RichTextContent {
  source: string;
  images?: BuilderRichTextImageAsset[];
}
/** Absence means inheritance; an empty source is an intentional override. */
export type RichTextOverrides = Partial<Record<RichTextTarget, RichTextContent>>;

export function resolveRichTextContent(
  shared: RichTextContent,
  overrides: RichTextOverrides | null | undefined,
  target: RichTextTarget,
): RichTextContent {
  return overrides?.[target] ?? shared;
}

/** Export-only projection. Never replace the persisted authoring field with it. */
export function resolveRichTextField(field: BuilderField, target: RichTextTarget): BuilderField {
  // This authoring component carries the same content as a rich-text field.
  // Other targets consume the portable field representation.
  if (target !== "mois" && field.type === "component" &&
    (field.componentKey === "RichMarkdownBlock" || field.componentProps?.nhformsExport === "RichMarkdownBlock")) {
    field = {
      ...field,
      type: "richText",
      richTextConfig: {
        source: typeof field.componentProps?.source === "string" ? field.componentProps.source : "",
        images: Array.isArray(field.componentProps?.images) ? field.componentProps.images as BuilderRichTextImageAsset[] : [],
        readOnly: true,
        borderless: true,
      },
    };
  }
  if (!field.richTextOverrides) return field;
  const { richTextOverrides, ...shared } = field;
  const override = richTextOverrides[target];
  if (!override) return shared;
  if (field.type === "richText") {
    return {
      ...shared,
      prefill: override.source,
      richTextConfig: { ...field.richTextConfig, source: override.source, images: override.images ?? [], readOnly: true, startingMode: "preview" },
    };
  }
  return {
    ...shared,
    componentProps: { ...field.componentProps, source: override.source, images: override.images ?? [] },
  };
}
