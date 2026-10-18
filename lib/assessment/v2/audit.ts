/**
 * Audit events for sensitive assessment transitions. Domain functions return these events; the
 * caller persists them through lib/audit.ts. Nothing in lib/assessment/v2 writes to the database.
 */
export type AssessmentAuditEventType =
  | "assessment.review.recorded"
  | "assessment.review.ai_recommendation_recorded"
  | "assessment.release.authorized"
  | "assessment.release.revoked"
  | "assessment.delivery.denied"
  | "assessment.score.moderated"
  | "assessment.score.ai_suggestion_recorded"
  | "assessment.evidence.verified"
  | "assessment.evidence.admitted"
  | "assessment.evidence.rejected"
  | "assessment.evidence.integrity_review_required"
  | "assessment.assistance.opened"
  | "assessment.assistance.recorded"
  | "assessment.assistance.sealed"
  | "assessment.assistance.conflict";

export type AssessmentAuditEvent = Readonly<{
  type: AssessmentAuditEventType;
  /** Exact subject: "<kind>:<id>@<version>#<hash>" or an evidence/attempt id. */
  subjectRef: string;
  actor: Readonly<{ kind: "HUMAN" | "AI" | "SYSTEM"; id: string; role: string | null }>;
  schoolId: string | null;
  occurredAt: string;
  details: Readonly<Record<string, string | number | boolean | null>>;
}>;

export function auditEvent(event: AssessmentAuditEvent): AssessmentAuditEvent {
  return Object.freeze({ ...event, actor: Object.freeze({ ...event.actor }), details: Object.freeze({ ...event.details }) });
}
