import { z } from "zod";
import type { BuilderDocument, BuilderField } from "./index";
import { BUILDER_FIELD_TYPES } from "./field-types";

export const BuilderFieldSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string(),
  type: z.enum(BUILDER_FIELD_TYPES),
}).passthrough();

export const BuilderFieldsSchema = z.array(BuilderFieldSchema);

export const BuilderDocumentSchema = z.object({
  name: z.string(),
  fields: BuilderFieldsSchema,
  design: z.record(z.unknown()),
  identityType: z.enum(["ATTACHMENT", "CALCULATOR", "FLOWSHEET", "WEBCLIENT", "TEST"]),
  identityCode: z.string(),
  drafts: z.array(z.unknown()),
  branchingRules: z.record(z.unknown()),
  paginationEnabled: z.boolean(),
  pageCount: z.number().int().positive(),
  pageAssignments: z.record(z.number().int().nullable()),
}).passthrough();

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
    .join("; ");
}

export function parseBuilderFields(value: unknown): BuilderField[] {
  const parsed = BuilderFieldsSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid builder fields: ${formatIssues(parsed.error)}`);
  }
  return parsed.data as BuilderField[];
}

export function parseBuilderDocument<TLayoutDraft = unknown>(
  value: unknown,
): BuilderDocument<TLayoutDraft> {
  const parsed = BuilderDocumentSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid builder document: ${formatIssues(parsed.error)}`);
  }
  return parsed.data as unknown as BuilderDocument<TLayoutDraft>;
}
