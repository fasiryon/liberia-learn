/**
 * Authorized release and deny-by-default delivery.
 *
 * A release is an explicit, immutable authorization of exact definition, form, item and scoring
 * spec hashes against an exact curriculum release. Candidate content has no release and can only be
 * previewed by reviewer roles; it can never be delivered as an official (certified) assessment.
 * This module validates and returns release records and audit events; it does not persist,
 * publish or activate anything.
 */
import { auditEvent, type AssessmentAuditEvent } from "./audit";
import { hashRelease, sealRelease } from "./hash";
import { deriveContentStatus, defaultReviewPolicy, REVIEWER_ROLES, subjectRef, type ReviewPolicy } from "./lifecycle";
import { assertIsoTimestamp, validateDefinition, validateForm, validateItem } from "./validator";
import {
  DELIVERY_MODES,
  type AssessmentDefinitionV2,
  type AssessmentFormV2,
  type AssessmentItemV2,
  type AssessmentReleaseV2,
  type AssessmentReviewV2,
  type DeliveryMode,
  type ProtectedScoringSpec,
  type ReleaseRevocation,
  type ReviewerRole,
} from "./types";

/** Roles that may authorize a release. Reviewers review; they do not also release. */
export const RELEASE_AUTHORITY_ROLES: readonly ReviewerRole[] = ["CURRICULUM_LEAD", "PLATFORM_ADMIN"];

export type ReleaseRequest = Readonly<{
  releaseId: string;
  definition: AssessmentDefinitionV2;
  form: AssessmentFormV2;
  items: readonly AssessmentItemV2[];
  specs: readonly ProtectedScoringSpec[];
  reviews: readonly AssessmentReviewV2[];
  permittedModes: readonly DeliveryMode[];
  effectiveFrom: string;
  effectiveUntil: string | null;
  schoolId: string | null;
  actor: Readonly<{ userId: string; role: string }>;
  authorizedAt: string;
  reviewPolicy?: ReviewPolicy;
}>;

export function authorizeRelease(request: ReleaseRequest): Readonly<{ release: AssessmentReleaseV2; audit: AssessmentAuditEvent }> {
  const role = request.actor.role as ReviewerRole;
  if (!RELEASE_AUTHORITY_ROLES.includes(role)) throw new Error("assessment_release_role_forbidden");
  if (request.schoolId === null && role !== "PLATFORM_ADMIN") throw new Error("assessment_national_release_requires_platform_admin");
  assertIsoTimestamp(request.effectiveFrom, "effective_from");
  assertIsoTimestamp(request.authorizedAt, "authorized_at");
  if (request.effectiveUntil !== null) {
    assertIsoTimestamp(request.effectiveUntil, "effective_until");
    if (request.effectiveUntil <= request.effectiveFrom) throw new Error("assessment_release_window_invalid");
  }
  if (request.permittedModes.length === 0 || request.permittedModes.some((mode) => !DELIVERY_MODES.includes(mode))) throw new Error("assessment_release_modes_invalid");

  const { definition, form } = request;
  const policy = request.reviewPolicy ?? defaultReviewPolicy(definition.purpose);
  const authors = new Set(definition.provenance.authors.map((author) => author.id));
  if (authors.has(request.actor.userId)) throw new Error("assessment_author_cannot_release");

  const definitionValidation = validateDefinition(definition);
  const definitionState = deriveContentStatus({
    current: { kind: "DEFINITION", definitionId: definition.definitionId, version: definition.version, hash: definition.contentHash },
    provenance: definition.provenance, validation: definitionValidation, reviews: request.reviews, policy,
  });
  if (definitionState.status !== "APPROVED") throw new Error(`assessment_release_definition_not_approved:${definitionState.status}`);

  const itemMap = new Map(request.items.map((item) => [`${item.itemId}@${item.version}`, item]));
  const specMap = new Map(request.specs.map((spec) => [`${spec.itemId}@${spec.itemVersion}`, spec]));
  const formValidation = validateForm(form, definition, itemMap);
  if (!formValidation.ok) throw new Error(`assessment_release_form_invalid:${formValidation.issues[0]?.code}`);
  const formState = deriveContentStatus({
    current: { kind: "FORM", formId: form.formId, version: form.version, hash: form.formHash },
    provenance: definition.provenance, validation: formValidation, reviews: request.reviews, policy,
  });
  if (formState.status !== "APPROVED") throw new Error(`assessment_release_form_not_approved:${formState.status}`);

  const releasedItems = form.items.map((ref) => {
    const key = `${ref.itemId}@${ref.itemVersion}`;
    const item = itemMap.get(key);
    const spec = specMap.get(key);
    if (!item || !spec) throw new Error("assessment_release_item_or_spec_missing");
    for (const author of item.provenance.authors) if (author.id === request.actor.userId) throw new Error("assessment_author_cannot_release");
    const state = deriveContentStatus({
      current: { kind: "ITEM", itemId: item.itemId, version: item.version, hash: item.itemHash },
      provenance: item.provenance, validation: validateItem(item, spec), reviews: request.reviews, policy,
    });
    if (state.status !== "APPROVED") throw new Error(`assessment_release_item_not_approved:${item.itemId}:${state.status}`);
    return { itemId: item.itemId, itemVersion: item.version, itemHash: item.itemHash, scoringSpecHash: item.scoringSpecHash };
  });

  const release = sealRelease({
    schemaVersion: "assessment.v2",
    releaseId: request.releaseId,
    definition: { definitionId: definition.definitionId, version: definition.version, contentHash: definition.contentHash },
    form: { formId: form.formId, version: form.version, formHash: form.formHash },
    items: releasedItems,
    objectiveIds: [...definition.objectiveIds],
    curriculum: { releaseId: definition.alignment.releaseId, releaseIdentity: definition.alignment.releaseIdentity },
    permittedModes: [...request.permittedModes],
    effectiveFrom: request.effectiveFrom,
    effectiveUntil: request.effectiveUntil,
    schoolId: request.schoolId,
    authorizedBy: { userId: request.actor.userId, role },
    authorizedAt: request.authorizedAt,
  });
  return Object.freeze({
    release,
    audit: auditEvent({
      type: "assessment.release.authorized",
      subjectRef: `RELEASE:${release.releaseId}#${release.releaseHash}`,
      actor: { kind: "HUMAN", id: request.actor.userId, role },
      schoolId: request.schoolId,
      occurredAt: request.authorizedAt,
      details: { form: subjectRef({ kind: "FORM", formId: form.formId, version: form.version, hash: form.formHash }), itemCount: releasedItems.length },
    }),
  });
}

export function revokeRelease(input: {
  release: AssessmentReleaseV2;
  actor: Readonly<{ userId: string; role: string }>;
  reason: string;
  revokedAt: string;
  evidenceDisposition: ReleaseRevocation["evidenceDisposition"];
}): Readonly<{ revocation: ReleaseRevocation; audit: AssessmentAuditEvent }> {
  const role = input.actor.role as ReviewerRole;
  if (!RELEASE_AUTHORITY_ROLES.includes(role)) throw new Error("assessment_release_role_forbidden");
  if (input.release.schoolId === null && role !== "PLATFORM_ADMIN") throw new Error("assessment_national_release_requires_platform_admin");
  if (input.reason.trim().length < 10) throw new Error("assessment_revocation_reason_required");
  assertIsoTimestamp(input.revokedAt, "revoked_at");
  const revocation: ReleaseRevocation = Object.freeze({
    releaseId: input.release.releaseId,
    releaseHash: input.release.releaseHash,
    revokedBy: { userId: input.actor.userId, role },
    reason: input.reason,
    revokedAt: input.revokedAt,
    evidenceDisposition: input.evidenceDisposition,
  });
  return Object.freeze({
    revocation,
    audit: auditEvent({
      type: "assessment.release.revoked",
      subjectRef: `RELEASE:${input.release.releaseId}#${input.release.releaseHash}`,
      actor: { kind: "HUMAN", id: input.actor.userId, role },
      schoolId: input.release.schoolId,
      occurredAt: input.revokedAt,
      details: { evidenceDisposition: input.evidenceDisposition },
    }),
  });
}

export type DeliveryRequest = Readonly<{
  mode: DeliveryMode;
  now: string;
  requester: Readonly<{ role: string; schoolId: string | null }>;
  /** The release the caller wants to deliver, or null for unreleased (candidate) content. */
  release: AssessmentReleaseV2 | null;
  revocations: readonly ReleaseRevocation[];
  /** The curriculum binding the lesson currently expects; guards stale assessment versions. */
  expectedCurriculum: Readonly<{ releaseId: string; releaseIdentity: string }> | null;
}>;

export type DeliveryDecision = Readonly<{
  allowed: boolean;
  mode: DeliveryMode;
  official: boolean;
  /** Label the player must show. Candidate previews are never "certified". */
  label: "REVIEWER_PREVIEW_UNRELEASED" | "PRACTICE_NOT_OFFICIAL" | "OFFICIAL_RELEASED" | "DENIED";
  reason: string;
}>;

const deny = (mode: DeliveryMode, reason: string): DeliveryDecision =>
  Object.freeze({ allowed: false, mode, official: false, label: "DENIED", reason });

/** Deny-by-default delivery resolution. Every allowed path is enumerated explicitly. */
export function resolveDelivery(request: DeliveryRequest): DeliveryDecision {
  const { mode, release } = request;
  if (!DELIVERY_MODES.includes(mode)) return deny(mode, "mode_unknown");
  if (!release) {
    if (mode !== "REVIEWER_PREVIEW") return deny(mode, "unreleased_content_cannot_be_delivered_to_learners");
    if (!REVIEWER_ROLES.includes(request.requester.role as ReviewerRole)) return deny(mode, "reviewer_role_required");
    return Object.freeze({ allowed: true, mode, official: false, label: "REVIEWER_PREVIEW_UNRELEASED", reason: "candidate_preview" });
  }
  if (release.releaseHash !== hashRelease(release)) return deny(mode, "release_hash_mismatch");
  if (request.revocations.some((revocation) => revocation.releaseId === release.releaseId)) return deny(mode, "release_revoked");
  if (request.now < release.effectiveFrom) return deny(mode, "release_not_yet_effective");
  if (release.effectiveUntil !== null && request.now >= release.effectiveUntil) return deny(mode, "release_expired");
  if (!release.permittedModes.includes(mode)) return deny(mode, "mode_not_permitted_by_release");
  if (release.schoolId !== null && release.schoolId !== request.requester.schoolId) return deny(mode, "release_school_scope_mismatch");
  if (request.expectedCurriculum && (
    request.expectedCurriculum.releaseId !== release.curriculum.releaseId ||
    request.expectedCurriculum.releaseIdentity !== release.curriculum.releaseIdentity
  )) return deny(mode, "release_curriculum_version_mismatch");
  if (mode === "REVIEWER_PREVIEW") {
    if (!REVIEWER_ROLES.includes(request.requester.role as ReviewerRole)) return deny(mode, "reviewer_role_required");
    return Object.freeze({ allowed: true, mode, official: false, label: "REVIEWER_PREVIEW_UNRELEASED", reason: "released_preview" });
  }
  if (mode === "OFFICIAL") return Object.freeze({ allowed: true, mode, official: true, label: "OFFICIAL_RELEASED", reason: "released_official" });
  return Object.freeze({ allowed: true, mode, official: false, label: "PRACTICE_NOT_OFFICIAL", reason: "released_practice" });
}
