import { z } from "zod";
import type { BuilderDocument, BuilderField, WorkspaceDocumentV3, FieldConditionGroup } from "./index";
import { BUILDER_FIELD_TYPES } from "./field-types";

export const BuilderFieldSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string(),
  type: z.enum(BUILDER_FIELD_TYPES),
  behavior: z.lazy(() => z.object({
    validations: z.array(z.object({ id: z.string(), message: z.string(), validWhen: FieldConditionGroupSchema, translations: z.record(z.string()).optional() })).optional(),
    optionRules: z.array(z.object({ value: z.string(), showWhen: FieldConditionGroupSchema.optional(), disableWhen: FieldConditionGroupSchema.optional() })).optional(),
  })).optional(),
}).passthrough();

export const BuilderFieldsSchema = z.array(BuilderFieldSchema);

export const BuilderDocumentSchema = z.object({
  name: z.string(),
  fields: BuilderFieldsSchema,
  design: z.record(z.unknown()),
  identityType: z.enum(["ACTIVITY", "ATTACHMENT", "CALCULATOR", "FLOWSHEET", "TESTFORM", "WEBCLIENT", "TEST"]),
  identityCode: z.string(),
  identityMetadata: z.object({
    author: z.string().optional(),
    owner: z.string().optional(),
    publisher: z.string().optional(),
    validationMessage: z.string().optional(),
  description: z.string().optional(),
    globalIdentifier: z.string().optional(),
    version: z.object({ major: z.number().int().nonnegative(), minor: z.number().int().nonnegative(), patch: z.number().int().nonnegative() }).optional(),
    requiredFormViewerVersion: z.object({ major: z.number().int().nonnegative(), minor: z.number().int().nonnegative(), patch: z.number().int().nonnegative() }).optional(),
    requiredMoisVersion: z.object({ major: z.number().int().nonnegative(), minor: z.number().int().nonnegative(), patch: z.number().int().nonnegative() }).optional(),
    isEncounterRequired: z.boolean().optional(),
  }).optional(),
  lifecycle: z.object({
    status: z.enum(["draft", "published", "retired"]),
    approvalDate: z.string().optional(),
    lastReviewDate: z.string().optional(),
    effectiveStart: z.string().optional(),
    effectiveEnd: z.string().optional(),
    changeLog: z.array(z.object({
      at: z.string(),
      status: z.enum(["draft", "published", "retired"]),
      version: z.string().optional(),
      by: z.string().optional(),
      note: z.string().optional(),
    })).optional(),
  }).optional(),
  drafts: z.array(z.unknown()),
  branchingRules: z.record(z.unknown()),
  paginationEnabled: z.boolean(),
  pageCount: z.number().int().positive(),
  pageAssignments: z.record(z.number().int().nullable()),
}).passthrough();

const FieldLinkConditionSchema = z.object({
  valueFieldId: z.string().optional(),
  compareFieldId: z.string().optional(),
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

function conditionGroupSchema(depth: number): z.ZodType<FieldConditionGroup> {
  const leaf = z.object({ controllerFieldId: z.string().min(1), condition: FieldLinkConditionSchema });
  return z.object({
    match: z.enum(["all", "any"]),
    conditions: z.array(depth < 8 ? z.union([z.lazy(() => conditionGroupSchema(depth + 1)), leaf]) : leaf).min(1).max(100),
  });
}
export const FieldConditionGroupSchema = conditionGroupSchema(0);

export const FieldLinkRuleSchema = z.object({
  conditionGroup: FieldConditionGroupSchema.optional(),
  copyPolicy: z.enum(["when-empty", "until-edited", "always"]).optional(),
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
    "invalid",
  ]),
  protectionMode: z.enum(["readOnly", "disabled", "both"]).optional(),
  copyFromFieldId: z.string().optional(),
  validationMessage: z.string().optional(),
  description: z.string().optional(),
}).passthrough();

export const WorkspaceDocumentV3Schema = z.object({
  version: z.literal(3),
  document: BuilderDocumentSchema,
  fieldLinkRules: z.array(FieldLinkRuleSchema),
  preview: z.unknown().optional(),
  extensions: z.record(z.unknown()).optional(),
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
