/**
 * READ-ONLY extraction of the complete live lesson catalog for Library Modernization V1.
 *
 * Every query runs inside one transaction opened with SET TRANSACTION READ ONLY, and the script aborts
 * unless Postgres reports transaction_read_only = on. It reads lesson content, provenance and revision
 * columns, plus per-lesson dependency COUNTS (scheduled work, assignments, learning events, ...).
 * It never selects learner, user, author, submission or school identifiers: authorship and school
 * scope are reduced to booleans, and dependencies to counts.
 *
 * Output (local, git-ignored because it holds ~120 MB of lesson bodies):
 *   artifacts/library-modernization-v1/extract/lessons.jsonl
 *   artifacts/library-modernization-v1/extract/manifest.json
 * The committed inventory (curriculum/modernization/v1) is derived from it by
 * scripts/build-library-modernization.ts and records the extract's SHA-256.
 *
 *   npx tsx scripts/extract-library-modernization-inventory.ts      # needs DATABASE_URL
 */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { canonicalizeJson, hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { buildCurriculumContentSnapshot } from "@/lib/curriculum/provenance/snapshot";
import { LIBRARY_EXTRACT_DIR, PAYLOAD_METADATA_FIELDS, type DependencyCounts, type LibraryExtractRecord } from "@/lib/curriculum/modernization/extract";

if (!process.env.DATABASE_URL) config({ path: process.env.LIBRARY_ENV_FILE ?? "env.local" });

const json = (value: unknown) => JSON.stringify(value, (_key, entry) => (typeof entry === "bigint" ? Number(entry) : entry));

/** Each query returns rows of { key, n } where key is CurriculumContent.contentId or .id. */
const DEPENDENCY_QUERIES: Record<keyof DependencyCounts, string> = {
  scheduledWork: `select "contentId" as key, count(*)::int n from "ScheduledWork" group by 1`,
  scheduledWorkBundlePinned: `select "contentId" as key, count(*)::int n from "ScheduledWork" where "bundleId" is not null group by 1`,
  scheduledWorkClasses: `select "contentId" as key, count(distinct "classId")::int n from "ScheduledWork" group by 1`,
  scheduledWorkSchools: `select sw."contentId" as key, count(distinct c."schoolId")::int n from "ScheduledWork" sw join "Class" c on c.id = sw."classId" group by 1`,
  studentProgress: `select sw."contentId" as key, count(*)::int n from "StudentProgress" sp join "ScheduledWork" sw on sw.id = sp."scheduledWorkId" group by 1`,
  assignments: `select "contentId" as key, count(*)::int n from "Assignment" where "contentId" is not null group by 1`,
  homework: `select "contentId" as key, count(*)::int n from "Homework" where "contentId" is not null group by 1`,
  learningEvents: `select coalesce("contentId", "lessonId") as key, count(*)::int n from "LearningEvent" where coalesce("contentId", "lessonId") is not null group by 1`,
  gradedSubmissions: `select "lessonId" as key, count(*)::int n from "GradedSubmission" group by 1`,
  teacherLessonAssignments: `select "contentId" as key, count(*)::int n from "TeacherLessonAssignment" group by 1`,
  lessonPlans: `select "curriculumContentId" as key, count(*)::int n from "CurriculumLessonPlan" group by 1`,
  tutorConversations: `select "contentId" as key, count(*)::int n from "TutorConversation" group by 1`,
  helpFlags: `select "contentId" as key, count(*)::int n from "LessonHelpFlag" group by 1`,
  timetableAssignments: `select "curriculumContentId" as key, count(*)::int n from "TimetableAssignment" where "curriculumContentId" is not null group by 1`,
  performanceEvents: `select "lessonId" as key, count(*)::int n from "StudentPerformanceEvent" where "lessonId" is not null group by 1`,
  curriculumFlags: `select "lessonId" as key, count(*)::int n from "CurriculumFlag" where "lessonId" is not null group by 1`,
  lessonVersions: `select "lessonId" as key, count(*)::int n from "LessonVersion" group by 1`,
  lessonShares: `select "lessonId" as key, count(*)::int n from "LessonShare" group by 1`,
  audioAssets: `select "lessonId" as key, count(*)::int n from "LessonAudio" group by 1`,
  videoSupplements: `select "lessonId" as key, count(*)::int n from "LessonVideo" group by 1`,
  prerequisiteLinks: `select "lessonId" as key, count(*)::int n from "LessonPrerequisite" group by 1`,
  dependentLessons: `select "prerequisiteLessonId" as key, count(*)::int n from "LessonPrerequisite" group by 1`,
};

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const [{ transaction_read_only: readOnly }] = await tx.$queryRawUnsafe<{ transaction_read_only: string }[]>("SHOW transaction_read_only");
      if (readOnly !== "on") throw new Error(`refusing to read: transaction_read_only=${readOnly}`);
      const [{ captured_at: capturedAt }] = await tx.$queryRawUnsafe<{ captured_at: Date }[]>("select now() as captured_at");

      const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
        `select c.id, c."contentId", c.title, c.grade, c.subject, c."contentType", c.status, c.version, c.payload, c."moeAlignments",
                c."waecSyllabusTopics", c.hash, c."createdAt", c."updatedAt", c."unitId", c."orderInUnit", c."lessonType", c."teacherCreated",
                c."isHero", c."versionId", c."learningObjectives", c.visibility, c."parentLessonId", c."lessonVersion", c."publishedAt",
                c."derivedFromContentId", c."deliveryProfile", c."heroImageUrl", c."heroImageMeta", c."inlineIllustrations",
                c."imageGenerationStatus", c."editReviewStatus",
                c."schoolId" is not null as "hasSchoolScope", c."editedById" is not null as "hasEditor",
                p.id as "provenanceId", p."provenanceCompleteness"::text as "provenanceCompleteness", p."lifecycleState"::text as "lifecycleState",
                p."currentRevisionId",
                r.sequence as "revisionSequence", r."revisionKind"::text as "revisionKind", r."originKind"::text as "originKind",
                r."snapshotSchemaVersion", r."contentSnapshot", r."contentHash" as "revisionContentHash", r."generatorName", r."generatorVersion",
                r."aiProvider", r."aiModel", r."generatedAt", r."createdAt" as "revisionCreatedAt", r."authorUserId" is not null as "revisionHasAuthor",
                (select count(*)::int from "CurriculumContentRevision" rr where rr."provenanceId" = p.id) as "revisionCount"
           from "CurriculumContent" c
           left join "CurriculumProvenance" p on p."curriculumContentId" = c.id
           left join "CurriculumContentRevision" r on r.id = p."currentRevisionId"
          order by c.grade, c.subject, c."contentId"`);

      const dependencies: Record<string, Record<string, number>> = {};
      for (const [name, sql] of Object.entries(DEPENDENCY_QUERIES)) {
        const counts: Record<string, number> = {};
        for (const row of await tx.$queryRawUnsafe<{ key: string | null; n: number }[]>(sql)) if (row.key) counts[row.key] = Number(row.n);
        dependencies[name] = counts;
      }
      return { capturedAt, rows, dependencies };
    }, { timeout: 600_000, maxWait: 30_000 });

    fs.mkdirSync(LIBRARY_EXTRACT_DIR, { recursive: true });
    const file = path.join(LIBRARY_EXTRACT_DIR, "lessons.jsonl");
    const out = fs.openSync(file, "w");
    const hash = createHash("sha256");
    let liveMismatch = 0;
    let hashMismatch = 0;
    for (const row of result.rows) {
      const payload = (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<string, unknown>;
      const counts = Object.fromEntries(Object.keys(DEPENDENCY_QUERIES).map((name) => {
        const table = result.dependencies[name];
        // Some tables key lessons by the public contentId, others by the cuid primary key.
        const n = (table[row.contentId as string] ?? 0) + (row.id !== row.contentId ? table[row.id as string] ?? 0 : 0);
        return [name, n];
      })) as DependencyCounts;
      const live = buildCurriculumContentSnapshot(row as never);
      const recomputed = row.contentSnapshot ? hashCurriculumSnapshot(Number(row.snapshotSchemaVersion), row.contentSnapshot) : null;
      const verification = {
        hasProvenance: !!row.provenanceId,
        hasCurrentRevision: !!row.currentRevisionId,
        storedRevisionHash: (row.revisionContentHash as string | null) ?? null,
        recomputedRevisionHash: recomputed,
        revisionHashMatches: !!recomputed && recomputed === row.revisionContentHash,
        liveRowEqualsRevision: !!row.contentSnapshot && live.schemaVersion === Number(row.snapshotSchemaVersion) && canonicalizeJson(live.snapshot) === canonicalizeJson(row.contentSnapshot),
        liveSnapshotHash: hashCurriculumSnapshot(live.schemaVersion, live.snapshot),
      };
      if (verification.hasCurrentRevision && !verification.revisionHashMatches) hashMismatch += 1;
      if (verification.hasCurrentRevision && !verification.liveRowEqualsRevision) liveMismatch += 1;
      const record: LibraryExtractRecord = {
        id: row.id as string,
        contentId: row.contentId as string,
        row: {
          title: (row.title as string | null) ?? null, grade: Number(row.grade), subject: row.subject as string, contentType: row.contentType as string,
          status: row.status as string, version: row.version as string, hash: (row.hash as string | null) ?? null,
          createdAt: row.createdAt as string, updatedAt: row.updatedAt as string, publishedAt: (row.publishedAt as string | null) ?? null,
          unitId: (row.unitId as string | null) ?? null, orderInUnit: (row.orderInUnit as number | null) ?? null, lessonType: (row.lessonType as string | null) ?? null,
          teacherCreated: !!row.teacherCreated, hasSchoolScope: !!row.hasSchoolScope, hasEditor: !!row.hasEditor, visibility: row.visibility as string,
          parentLessonId: (row.parentLessonId as string | null) ?? null, derivedFromContentId: (row.derivedFromContentId as string | null) ?? null,
          lessonVersion: Number(row.lessonVersion), versionId: (row.versionId as string | null) ?? null, isHero: !!row.isHero,
          imageGenerationStatus: (row.imageGenerationStatus as string | null) ?? null, editReviewStatus: (row.editReviewStatus as string | null) ?? null,
          moeAlignments: row.moeAlignments ?? null, waecSyllabusTopics: (row.waecSyllabusTopics as string[]) ?? [],
          payloadKeys: Object.keys(payload).sort(),
          payloadMetadata: Object.fromEntries(PAYLOAD_METADATA_FIELDS.filter((field) => field in payload).map((field) => [field, payload[field]])),
          payloadBytes: Buffer.byteLength(JSON.stringify(payload)),
        },
        provenance: row.provenanceId ? {
          completeness: row.provenanceCompleteness as string, lifecycleState: row.lifecycleState as string, revisionCount: Number(row.revisionCount),
        } : null,
        revision: row.currentRevisionId ? {
          id: row.currentRevisionId as string, sequence: Number(row.revisionSequence), revisionKind: row.revisionKind as string, originKind: row.originKind as string,
          snapshotSchemaVersion: Number(row.snapshotSchemaVersion), contentHash: row.revisionContentHash as string,
          generatorName: (row.generatorName as string | null) ?? null, generatorVersion: (row.generatorVersion as string | null) ?? null,
          aiProvider: (row.aiProvider as string | null) ?? null, aiModel: (row.aiModel as string | null) ?? null,
          generatedAt: (row.generatedAt as string | null) ?? null, createdAt: row.revisionCreatedAt as string, hasAuthor: !!row.revisionHasAuthor,
          contentSnapshot: row.contentSnapshot,
        } : null,
        liveSnapshot: verification.liveRowEqualsRevision ? null : live,
        verification,
        dependencies: counts,
      };
      const line = `${json(record)}\n`;
      hash.update(line);
      fs.writeSync(out, line);
    }
    fs.closeSync(out);
    const manifest = {
      notice: "Read-only extraction of the live CurriculumContent catalog. Lesson content and dependency counts only: no learner, user, author, submission or school identifiers.",
      script: "scripts/extract-library-modernization-inventory.ts",
      target: "LiberiaLearn production database (DATABASE_URL), single READ ONLY transaction",
      transactionReadOnly: "on",
      capturedAt: result.capturedAt,
      lessons: result.rows.length,
      revisionHashMismatches: hashMismatch,
      liveRowsDifferingFromCurrentRevision: liveMismatch,
      dependencyCounts: Object.keys(DEPENDENCY_QUERIES),
      excludedFields: ["editedById", "schoolId", "authorUserId", "embedding", "thumbnail*", "image prompt/cost fields"],
      extractFile: "lessons.jsonl",
      extractSha256: hash.digest("hex"),
    };
    fs.writeFileSync(path.join(LIBRARY_EXTRACT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify(manifest, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
