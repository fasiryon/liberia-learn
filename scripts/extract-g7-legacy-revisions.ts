/**
 * READ-ONLY extraction of the two legacy lesson revisions the Grade 7 native candidates may later replace.
 *
 * Every query runs inside one transaction opened with SET TRANSACTION READ ONLY, and the script aborts unless
 * Postgres reports transaction_read_only = on. It selects lesson content, provenance and revision columns only:
 * no user, author, learner, submission or school identifiers (author and school scope are reduced to booleans).
 * It writes evidence files under artifacts/g7-native-curriculum-v1/legacy/ and never writes to the database.
 *
 *   npx tsx scripts/extract-g7-legacy-revisions.ts            # needs DATABASE_URL
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { canonicalizeJson, hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { buildCurriculumContentSnapshot } from "@/lib/curriculum/provenance/snapshot";
import { G7_NATIVE_LESSONS } from "@/lib/curriculum/v2/g7Native";
import { G7_LEGACY_EXTRACT_DIR } from "@/lib/curriculum/v2/g7NativeLegacy";

/** Payload fields outside the revision snapshot that still describe the lesson (generation and alignment metadata). */
const PAYLOAD_METADATA_FIELDS = ["metadata", "difficulty", "primaryConcept", "nextConcepts", "prerequisites", "approvalStatus", "approvalWorkflow", "generationStage", "contentCompleteness", "demoReady"] as const;

const json = (value: unknown) => `${JSON.stringify(value, (_key, entry) => (typeof entry === "bigint" ? entry.toString() : entry), 2)}\n`;

async function main() {
  const prisma = new PrismaClient();
  try {
    const extracts = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const [{ transaction_read_only: readOnly }] = await tx.$queryRawUnsafe<{ transaction_read_only: string }[]>("SHOW transaction_read_only");
      if (readOnly !== "on") throw new Error(`refusing to read: transaction_read_only=${readOnly}`);
      const [{ captured_at: capturedAt }] = await tx.$queryRawUnsafe<{ captured_at: Date }[]>("select now() as captured_at");
      const out = [];
      for (const lesson of G7_NATIVE_LESSONS) {
        const [content] = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
          `select id, "contentId", title, grade, subject, "contentType", status, version, payload, "moeAlignments", "waecSyllabusTopics",
                  hash, "createdAt", "updatedAt", "unitId", "orderInUnit", "lessonType", "teacherCreated", "isHero", "versionId",
                  "learningObjectives", visibility, "parentLessonId", "lessonVersion", "publishedAt", "derivedFromContentId",
                  "schoolId" is not null as "hasSchoolScope", "editedById" is not null as "hasEditor"
             from "CurriculumContent" where "contentId" = $1`, lesson.legacy.contentId);
        if (!content) throw new Error(`legacy row not found: ${lesson.legacy.contentId}`);
        const [provenance] = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
          `select id, "curriculumContentId", "provenanceCompleteness"::text as "provenanceCompleteness", "lifecycleState"::text as "lifecycleState",
                  "currentRevisionId", "createdAt", "updatedAt"
             from "CurriculumProvenance" where "curriculumContentId" = $1`, content.id);
        const revisions = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
          `select id, "provenanceId", sequence, "revisionKind"::text as "revisionKind", "originKind"::text as "originKind", "snapshotSchemaVersion",
                  "contentHash", "generatorName", "generatorVersion", "aiProvider", "aiModel", "generatedAt", "primaryPromptKey",
                  "primaryPromptVersion", "sourceRevisionId", "backfillRunId", "createdAt", "authorUserId" is not null as "hasAuthor"
             from "CurriculumContentRevision" where "provenanceId" = $1 order by sequence`, provenance?.id ?? "");
        const [revision] = await tx.$queryRawUnsafe<{ id: string; provenanceId: string; snapshotSchemaVersion: number; contentHash: string; contentSnapshot: unknown }[]>(
          `select id, "provenanceId", "snapshotSchemaVersion", "contentHash", "contentSnapshot" from "CurriculumContentRevision" where id = $1`, lesson.legacy.currentRevisionId);
        if (!revision) throw new Error(`legacy revision not found: ${lesson.legacy.currentRevisionId}`);
        out.push({ lesson, content, provenance, revisions, revision });
      }
      return { capturedAt, out };
    }, { timeout: 60_000 });

    fs.mkdirSync(G7_LEGACY_EXTRACT_DIR, { recursive: true });
    for (const { lesson, content, provenance, revisions, revision } of extracts.out) {
      const { payload, ...row } = content as Record<string, unknown> & { payload: Record<string, unknown> };
      const recomputedHash = hashCurriculumSnapshot(revision.snapshotSchemaVersion, revision.contentSnapshot);
      const live = buildCurriculumContentSnapshot(content as never);
      const record = {
        notice: "Read-only evidence of a live legacy lesson revision. Lesson content only: no learner, user, submission or school identifiers. Nothing here is approved for reuse; see legacy-comparison.md in the review package.",
        extraction: {
          script: "scripts/extract-g7-legacy-revisions.ts",
          target: "LiberiaLearn production database (DATABASE_URL), single READ ONLY transaction",
          transactionReadOnly: "on",
          capturedAt: extracts.capturedAt,
          excludedFields: ["editedById", "schoolId", "authorUserId", "embedding", "thumbnail*", "image*"],
        },
        requested: { contentId: lesson.legacy.contentId, revisionId: lesson.legacy.currentRevisionId },
        verification: {
          revisionFound: revision.id === lesson.legacy.currentRevisionId,
          revisionBelongsToRow: revision.provenanceId === provenance?.id,
          isCurrentRevision: provenance?.currentRevisionId === revision.id,
          revisionCount: revisions.length,
          storedContentHash: revision.contentHash,
          recomputedContentHash: recomputedHash,
          contentHashMatches: recomputedHash === revision.contentHash,
          liveRowEqualsRevision: live.schemaVersion === revision.snapshotSchemaVersion && canonicalizeJson(live.snapshot) === canonicalizeJson(revision.contentSnapshot),
        },
        content: row,
        payloadMetadata: Object.fromEntries(PAYLOAD_METADATA_FIELDS.filter((field) => field in payload).map((field) => [field, payload[field]])),
        provenance,
        revisions,
        revision: { id: revision.id, snapshotSchemaVersion: revision.snapshotSchemaVersion, contentHash: revision.contentHash, contentSnapshot: revision.contentSnapshot },
      };
      const file = path.join(G7_LEGACY_EXTRACT_DIR, `${lesson.key}.json`);
      fs.writeFileSync(file, json(record));
      console.log(JSON.stringify({ file, ...record.verification }));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
