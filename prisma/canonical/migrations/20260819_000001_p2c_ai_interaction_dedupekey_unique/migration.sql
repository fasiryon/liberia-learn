-- P2-C blocker closure, distributed telemetry idempotency.
--
-- Replaces the process-local mutex in lib/ai/interactionLog.ts with a
-- database-enforced invariant: at most one AIInteraction row per
-- non-null dedupeKey, across any number of processes/instances/workers.
--
-- dedupeKey is already the caller-supplied idempotency key used for
-- offline-sync dedup on this table (see groundedAnswerService.ts and
-- lib/events/logLearningEvent.ts's own dedupeKey handling); this migration
-- makes it globally unique rather than introducing a second identifier.
-- Verified before writing this migration: 0 of 38 existing AIInteraction
-- rows on staging have a non-null dedupeKey, so this is safe to enforce
-- without resolving any pre-existing conflict.
--
-- Standard Postgres NULL semantics apply: a UNIQUE index permits any
-- number of NULL values (NULL is never equal to NULL), so every row that
-- does not participate in idempotent-invocation tracking is unaffected.

DROP INDEX "AIInteraction_dedupeKey_idx";

CREATE UNIQUE INDEX "AIInteraction_dedupeKey_key" ON "AIInteraction"("dedupeKey");
