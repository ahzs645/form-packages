import type { BuilderDocument, FieldLinkRule } from "./index";

export interface AuthoringSnapshot {
  document: Omit<BuilderDocument, "authoring">;
  rules: FieldLinkRule[];
}
export interface AuthoringRevision {
  id: string;
  label: string;
  createdAt: string;
  automatic?: boolean;
  snapshot: AuthoringSnapshot;
}
export interface AuthoringComment {
  id: string;
  fieldId?: string;
  author: string;
  text: string;
  createdAt: string;
  resolved: boolean;
}
export interface AuthoringTask {
  id: string;
  title: string;
  assignee: string;
  dueDate?: string;
  done: boolean;
}
export interface AuthoringTestCase {
  id: string;
  name: string;
  answers: Record<string, unknown>;
  expectations: Array<{
    fieldId: string;
    property: "value" | "hidden" | "required" | "readonly" | "valid";
    expected: unknown;
  }>;
}
export interface OfflineAuthoringState {
  version: 1;
  id: string;
  status: "draft" | "review" | "released";
  revisions: AuthoringRevision[];
  comments: AuthoringComment[];
  tasks: AuthoringTask[];
  tests: AuthoringTestCase[];
  releases: Array<{
    id: string;
    revisionId: string;
    reviewer: string;
    notes: string;
    createdAt: string;
  }>;
}
