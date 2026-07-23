import type {
  BranchingRule,
  BuilderField,
  BuilderFormPresentation,
  BuilderInvestigationTab,
  ParseMeta,
  WorkspaceDocumentV3,
} from "./index";
import type { ParsedField } from "./document";
import type { GroupSummary } from "./grouping";
import type { GroupLayoutDraft } from "./layout";

export interface SessionFooterButtonConfig {
  showPrint?: boolean;
  showPdfRegenerator?: boolean;
  showRefresh?: boolean;
  showSubmit?: boolean;
  showSave?: boolean;
  showSign?: boolean;
  showCancel?: boolean;
  showClose?: boolean;
  showSaveStatus?: boolean;
  draftStatusText?: string;
  submittedStatusPrefix?: string;
  showFormVersion?: boolean;
  submitText?: string;
  submitAutoSign?: boolean;
  submitCloses?: boolean;
  disableSubmitUntilValid?: boolean;
  submitOnLastPageOnly?: boolean;
  hideSaveWhenSigned?: boolean;
  signedSignButton?: boolean;
  saveText?: string;
  saveCloses?: boolean;
  printLabel?: string;
  closeText?: string;
  pdfLibStrategy?: "inline" | "cdn" | "host";
  pdfRegeneratorAction?: "print" | "save";
}

export interface SessionPreviewSettings {
  showDebugView: boolean;
  footerButtons: SessionFooterButtonConfig;
  footerButtonBarBackground: string;
  chromeColorPreset: "brightHealth" | "legacy";
  showFooterWrapper: boolean;
  showSaveOnClose: boolean;
  lockPolicy?: "document";
  submitRequiresComplete: boolean;
  showTitle: boolean;
  showNameBlock: boolean;
  showQuickNav: boolean;
  sectionFieldCount: "hidden" | "inline" | "below";
  defaultLabelPosition: "top" | "left" | "none";
}

export interface SessionPdfPayload {
  name: string;
  base64: string;
}

export interface SessionXmlAttachment {
  name: string;
  size: number;
  content: string;
}

export interface SessionWorkflowSnapshot {
  drafts: GroupLayoutDraft[];
  paginationEnabled: boolean;
  pageCount: number;
  pageNames?: string[];
  formPresentation?: BuilderFormPresentation;
  investigationTabs?: BuilderInvestigationTab[];
  investigationTabAssignments?: Record<string, string | null>;
  pageAssignments: Record<string, number | null>;
  branchingRules: Record<string, BranchingRule>;
}

/**
 * Persisted workspace-session transport contract. App-only integrations are
 * intentionally opaque at this layer; the model owns their storage envelope,
 * while application adapters validate them before use.
 */
export interface SessionPayload {
  version: 3;
  workspaceDocument: WorkspaceDocumentV3<GroupLayoutDraft, SessionPreviewSettings>;
  startMode: "initial" | "upload" | "builder";
  pipelineMode: "acroform" | "llm";
  workflowStep: string;
  builderActive: boolean;
  fields: ParsedField[];
  meta: ParseMeta | null;
  xmlAttachments: SessionXmlAttachment[];
  fieldConstraints: Record<string, unknown>;
  selectedGroups: GroupSummary[];
  decisionModel?: unknown;
  alayaCareFormSettings: unknown;
  alayaCareTemplateDoc?: unknown;
  alayaCareUseStructuredTemplate?: boolean;
  uploadWorkflow: SessionWorkflowSnapshot;
  sessionPdf: SessionPdfPayload | null;
}

/** Minimal session builder input shared by transport-oriented consumers. */
export interface SessionBuilderDocument {
  name: string;
  fields: BuilderField[];
  drafts: GroupLayoutDraft[];
}
