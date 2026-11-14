import { logAuditRequired } from "@/lib/audit";
import { deleteCurriculumContentRagChunksStrict } from "@/lib/ai/rag/ragIngestionService";

/**
 * Founder decision 2026-11-13 (AWS suspension): when the queue does not accept an embedding job, or no
 * queue is configured, DEFER it. There is no inline provider path in any runtime.
 *
 * - No paid embedding provider is called inline (neither lesson embedding nor chunk embeddings).
 * - The deferral is durable and visible to administrators: a required audit entry (append-only), shown in
 *   /admin/audit under action "embedding.deferred". The audit identifies recovery candidates even when
 *   a lesson still has an older non-NULL embedding; it does not claim a payload-version match.
 * - Recovery is idempotent (re-embedding overwrites) and MANUAL: nothing here schedules a replay. Replay
 *   needs an approved recovery plan with cost controls.
 * - If the deferral cannot be recorded, this throws, so the caller fails visibly rather than reporting success.
 *
 * Embeddings feed AI retrieval only; they are not required for lesson correctness, safety or publication,
 * so the lesson operation itself proceeds.
 */
export const EMBEDDING_DEFERRED_ACTION = "embedding.deferred";

export async function deferLessonEmbedding(input: {
  lessonId: string;
  contentId: string;
  source: string;
  /** Why the job was not queued: the send was refused, or no queue URL is configured. */
  reason?: "QUEUE_UNAVAILABLE" | "QUEUE_NOT_CONFIGURED";
  actorUserId?: string | null;
  schoolId?: string | null;
  /** Delete this lesson's existing retrieval chunks so outdated lesson text is not retrieved meanwhile. */
  removeStaleChunks?: boolean;
}): Promise<void> {
  // Strict: a failed deletion throws before the audit, so a DEFERRED record never claims a removal that did not happen.
  const staleChunksRemoved = input.removeStaleChunks ? await deleteCurriculumContentRagChunksStrict(input.lessonId) : 0;

  await logAuditRequired({
    userId: input.actorUserId ?? null,
    schoolId: input.schoolId ?? null,
    action: EMBEDDING_DEFERRED_ACTION,
    resourceType: "curriculum_content",
    resourceId: input.lessonId,
    details: {
      status: "DEFERRED",
      contentId: input.contentId,
      jobType: "GENERATE_EMBEDDINGS",
      reason: input.reason ?? "QUEUE_UNAVAILABLE",
      source: input.source,
      staleChunksRemoved,
      policy: "FOUNDER_DEFER_2026_11_13",
      replay: "MANUAL_APPROVED_PLAN_ONLY",
    },
  });
}
