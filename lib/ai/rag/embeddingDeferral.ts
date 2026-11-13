import { logAuditRequired } from "@/lib/audit";
import { deleteCurriculumContentRagChunks } from "@/lib/ai/rag/ragIngestionService";

/**
 * Founder decision 2026-11-13 (AWS suspension): when the queue does not accept an embedding job, DEFER it.
 *
 * - No paid embedding provider is called inline (neither lesson embedding nor chunk embeddings).
 * - The deferral is durable and visible to administrators: a required audit entry (append-only), shown in
 *   /admin/audit under action "embedding.deferred". The outstanding set is also derivable: lessons whose
 *   embedding is still NULL.
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
  actorUserId?: string | null;
  schoolId?: string | null;
  /** Delete this lesson's existing retrieval chunks so outdated lesson text is not retrieved meanwhile. */
  removeStaleChunks?: boolean;
}): Promise<void> {
  const staleChunksRemoved = input.removeStaleChunks ? await deleteCurriculumContentRagChunks(input.lessonId) : 0;

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
      reason: "QUEUE_UNAVAILABLE",
      source: input.source,
      staleChunksRemoved,
      policy: "FOUNDER_DEFER_2026_11_13",
      replay: "MANUAL_APPROVED_PLAN_ONLY",
    },
  });
}
