import { z } from "zod";
import type { BuilderDocument, BuilderField, WorkspaceDocumentV3 } from "./index";
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

const FieldLinkConditionSchema = z.object({
  type: z.enum([
    "boolean-yes",
    "boolean-no",
    "choice-selected",
    "choice-not-selected",
    "number-gt",
    "number-gte",
    "number-lt",
    "number-lte",
    "number-equals",
    "equals",
    "not-equals",
    "filled",
    "empty",
  ]),
  optionValues: z.array(z.string()).optional(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
}).passthrough();

const FieldLinkRuleSchema = z.object({
  id: z.string(),
  controllerFieldId: z.string(),
  condition: FieldLinkConditionSchema,
  additionalConditions: z.array(z.object({
    controllerFieldId: z.string(),
    condition: FieldLinkConditionSchema,
  }).passthrough()).optional(),
  conditionMatch: z.enum(["all", "any"]).optional(),
  targetFieldIds: z.array(z.string()),
  action: z.enum([
    "show",
    "hide",
    "copy-value",
    "set-required",
    "clear-required",
    "set-readonly",
    "clear-readonly",
  ]),
  protectionMode: z.enum(["readOnly", "disabled", "both"]).optional(),
  copyFromFieldId: z.string().optional(),
  description: z.string().optional(),
}).passthrough();

export const WorkspaceDocumentV3Schema = z.object({
  version: z.literal(3),
  document: BuilderDocumentSchema,
  fieldLinkRules: z.array(FieldLinkRuleSchema),
  preview: z.unknown().optional(),
});

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

export function parseWorkspaceDocumentV3<
  TLayoutDraft = unknown,
  TPreviewSettings = unknown,
>(value: unknown): WorkspaceDocumentV3<TLayoutDraft, TPreviewSettings> {
  const parsed = WorkspaceDocumentV3Schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid workspace document: ${formatIssues(parsed.error)}`);
  }
  return parsed.data as unknown as WorkspaceDocumentV3<TLayoutDraft, TPreviewSettings>;
}
