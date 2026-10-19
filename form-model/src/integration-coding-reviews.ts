import type { BuilderField, BuilderFhirCoding } from "./index";
import { normalizeOption } from "./values";

/** Authoring evidence only. No exporter or runtime resolves these records. */
export const INTEGRATION_CODING_DOMAINS = ["observation", "vaccine", "route", "site", "provider", "lot", "other"] as const;
export type IntegrationCodingDomain = (typeof INTEGRATION_CODING_DOMAINS)[number];
export const INTEGRATION_CODING_REVIEW_STATUSES = ["pending", "reviewed", "unmapped", "rejected"] as const;
export type IntegrationCodingReviewStatus = (typeof INTEGRATION_CODING_REVIEW_STATUSES)[number];

export interface IntegrationCodingReviewScope {
  source: { system: "mois"; environment: string; version: string };
  target: { system: "panorama"; environment: string; version: string };
}

export interface BuilderIntegrationCodingReview {
  version: 1;
  id: string;
  domain: IntegrationCodingDomain;
  /** The enclosing field's stable id anchors the question. Labels never identify an answer. */
  subject: { kind: "field" } | { kind: "answer"; storedValue: string };
  scope: IntegrationCodingReviewScope;
  sourceCoding?: BuilderFhirCoding;
  targetCoding?: BuilderFhirCoding;
  status: IntegrationCodingReviewStatus;
  /** A terminology/schema reference, not patient or entered-answer data. */
  evidenceReference?: string;
  reviewedOn?: string;
  note?: string;
}

export interface IntegrationCodingReviewIssue {
  reviewId: string;
  code: string;
  severity: "error" | "information";
  message: string;
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const nonblank = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const codingShape = (value: unknown) => value === undefined || record(value)
  && ["system", "code", "display"].every(key => value[key] === undefined || typeof value[key] === "string");
function reviewShape(value: unknown): value is BuilderIntegrationCodingReview {
  if (!record(value) || value.version !== 1 || typeof value.id !== "string"
    || !INTEGRATION_CODING_DOMAINS.includes(value.domain as IntegrationCodingDomain)
    || !INTEGRATION_CODING_REVIEW_STATUSES.includes(value.status as IntegrationCodingReviewStatus)
    || !record(value.subject) || !(value.subject.kind === "field" || value.subject.kind === "answer" && typeof value.subject.storedValue === "string")
    || !record(value.scope) || !record(value.scope.source) || !record(value.scope.target)) return false;
  return value.scope.source.system === "mois" && value.scope.target.system === "panorama"
    && [value.scope.source, value.scope.target].every(endpoint => typeof endpoint.environment === "string" && typeof endpoint.version === "string")
    && codingShape(value.sourceCoding) && codingShape(value.targetCoding)
    && ["evidenceReference", "reviewedOn", "note"].every(key => value[key] === undefined || typeof value[key] === "string");
}

/** Unknown persisted records stay in storage; callers report them instead of activating them. */
export function readIntegrationCodingReviews(field: Pick<BuilderField, "integrationCodingReviews">): BuilderIntegrationCodingReview[] {
  return Array.isArray(field.integrationCodingReviews) ? field.integrationCodingReviews.filter(reviewShape) : [];
}

export function sameIntegrationCodingReviewScope(left: IntegrationCodingReviewScope, right: IntegrationCodingReviewScope): boolean {
  return left.source.system === right.source.system && left.target.system === right.target.system
    && left.source.environment === right.source.environment && left.source.version === right.source.version
    && left.target.environment === right.target.environment && left.target.version === right.target.version;
}

/** Exact environments and releases only. No fallback across sites or versions. */
export function integrationCodingReviewsForScope(field: Pick<BuilderField, "integrationCodingReviews">, scope: IntegrationCodingReviewScope): BuilderIntegrationCodingReview[] {
  return readIntegrationCodingReviews(field).filter(review => sameIntegrationCodingReviewScope(review.scope, scope));
}

function validDate(value: string | undefined): boolean {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function reviewIssues(field: BuilderField, review: BuilderIntegrationCodingReview): IntegrationCodingReviewIssue[] {
  const issues: IntegrationCodingReviewIssue[] = [];
  const error = (code: string, message: string) => issues.push({ reviewId: review.id, code, message, severity: "error" });
  if (!nonblank(review.id)) error("missing-id", "Give this review a stable review ID.");
  if (![review.scope.source, review.scope.target].every(endpoint => nonblank(endpoint.environment) && nonblank(endpoint.version))) {
    error("missing-scope", "Specify both environments and both source/target versions.");
  }
  if (review.subject.kind === "answer") {
    const storedValue = review.subject.storedValue;
    const matches = (field.options ?? []).filter(option => normalizeOption(option).code === storedValue);
    if (!nonblank(storedValue) || matches.length !== 1) error("answer-identity", "The stored answer value must identify exactly one current option; labels are not used to repair it.");
  }
  if (review.status === "reviewed") {
    if (![review.sourceCoding, review.targetCoding].every(coding => nonblank(coding?.system) && nonblank(coding?.code))) {
      error("missing-codings", "Reviewed evidence needs explicit source and target code systems and codes.");
    }
    if (!nonblank(review.evidenceReference)) error("missing-evidence", "Reviewed evidence needs a terminology or schema reference.");
    if (!validDate(review.reviewedOn)) error("missing-review-date", "Reviewed evidence needs a valid YYYY-MM-DD review date.");
  }
  if (review.reviewedOn && !validDate(review.reviewedOn)) error("invalid-review-date", "Use a valid YYYY-MM-DD review date.");
  return issues;
}

/** Author-facing review/loss information; reviewed is never runtime activation. */
export function integrationCodingReviewIssues(field: BuilderField): IntegrationCodingReviewIssue[] {
  const raw: unknown = field.integrationCodingReviews;
  const reviews = readIntegrationCodingReviews(field);
  const issues: IntegrationCodingReviewIssue[] = [];
  if (raw != null && (!Array.isArray(raw) || raw.length !== reviews.length)) issues.push({
    reviewId: "", code: "unsupported-record", severity: "error", message: "Unsupported coding review metadata is preserved. Resolve it before editing this review list.",
  });
  const ids = new Set<string>();
  for (const review of reviews) {
    issues.push(...reviewIssues(field, review));
    if (ids.has(review.id)) issues.push({ reviewId: review.id, code: "duplicate-id", severity: "error", message: "Review IDs must be unique on this field." });
    ids.add(review.id);
    issues.push({ reviewId: review.id, code: "panorama.integrationCodingReview.unsupported", severity: "information",
      message: "Stored review evidence only. No Panorama export, transmission or runtime code conversion is implemented." });
  }
  return issues;
}

/** Upsert only this metadata. Field id/label, stored answers and active clinical bindings stay unchanged. */
export function withIntegrationCodingReview<T extends BuilderField>(field: T, review: BuilderIntegrationCodingReview): T {
  if (!reviewShape(review)) throw new Error("Unsupported integration coding review shape.");
  if (integrationCodingReviewIssues(field).some(issue => ["unsupported-record", "duplicate-id"].includes(issue.code))) throw new Error("Resolve unsupported or duplicate review records before editing.");
  const issues = reviewIssues(field, review);
  if (issues.length) throw new Error(issues.map(issue => issue.message).join(" "));
  const current = readIntegrationCodingReviews(field);
  const index = current.findIndex(item => item.id === review.id);
  const next = [...current];
  if (index < 0) next.push(review); else next[index] = review;
  return { ...field, integrationCodingReviews: next };
}

export function withoutIntegrationCodingReview<T extends BuilderField>(field: T, reviewId: string): T {
  if (integrationCodingReviewIssues(field).some(issue => issue.code === "unsupported-record")) throw new Error("Resolve unsupported review records before editing.");
  return { ...field, integrationCodingReviews: readIntegrationCodingReviews(field).filter(review => review.id !== reviewId) };
}
