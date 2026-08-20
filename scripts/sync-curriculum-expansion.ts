// Use direct Postgres URL for local scripts
// (bypasses Prisma Accelerate requirement)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createConservativeCurriculumMaintenanceClient } from "@/lib/curriculum/mutations/maintenanceClient";
const governedCurriculum = createConservativeCurriculumMaintenanceClient("sync-curriculum-expansion");
import { buildCurriculumExpansionRecords, summarizeCurriculumExpansion } from "@/lib/curriculum/factoryExpansion";
import { syncCurriculumContentRagChunks } from "@/lib/ai/rag/ragIngestionService";
import { clearLessonEmbedding } from "@/lib/ai/rag/embeddingService";

const args = new Set(process.argv.slice(2));

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function readArgs(flag: string) {
  const values: string[] = [];

  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag) {
      const value = process.argv[index + 1];
      if (typeof value === "string" && value.trim().length > 0) {
        values.push(value.trim());
      }
    }
  }

  return values;
}

function readTargetPairs() {
  return readArgs("--target")
    .map((value) => {
      const [gradePart, subjectPart] = value.split(":");
      const grade = Number.parseInt(gradePart ?? "", 10);
      const subject = (subjectPart ?? "").trim().toUpperCase();

      if (!Number.isFinite(grade) || !subject) {
        return null;
      }

      return { grade, subject };
    })
    .filter((value): value is { grade: number; subject: string } => value !== null);
}

function isLessonValid(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  return (
    typeof record.objective === "string" &&
    Array.isArray(record.workedExamples) &&
    Array.isArray(record.guidedPractice) &&
    Array.isArray(record.independentPractice)
  );
}

async function main() {
  const summary = summarizeCurriculumExpansion();
  console.log("[CURRICULUM EXPANSION] Summary", summary);

  const publish = args.has("--publish");
  const force = args.has("--force");
  const requestedSubjects = new Set(readArgs("--subject").map((value) => value.toUpperCase()));
  const requestedGrades = new Set(
    readArgs("--grade")
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value))
  );
  const requestedTargets = readTargetPairs();
  const limitArg = readArg("--limit");
  const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined;

  let records = buildCurriculumExpansionRecords().filter((record) => {
    if (requestedTargets.length > 0) {
      return requestedTargets.some(
        (target) => target.grade === record.grade && target.subject === record.subject.toUpperCase()
      );
    }

    const subjectMatch =
      requestedSubjects.size === 0 || requestedSubjects.has(record.subject.toUpperCase());
    const gradeMatch =
      requestedGrades.size === 0 || requestedGrades.has(record.grade);

    return subjectMatch && gradeMatch;
  });

  if (Number.isFinite(limit) && (limit as number) > 0) {
    records = records.slice(0, limit as number);
  }

  console.log("[CURRICULUM EXPANSION] Selected batch", {
    selectedLessons: records.length,
    requestedSubjects: [...requestedSubjects],
    requestedGrades: [...requestedGrades],
    requestedTargets,
    limit: Number.isFinite(limit) ? limit : null,
    sampleContentIds: records.slice(0, 10).map((record) => record.contentId),
  });

  const existingRows =
    records.length === 0
      ? []
      : await prisma.curriculumContent.findMany({
          where: {
            contentId: {
              in: records.map((record) => record.contentId),
            },
          },
          select: {
            contentId: true,
            status: true,
          },
        });
  const existingByContentId = new Map(existingRows.map((row) => [row.contentId, row.status]));
  const unpublishedSelected = records.filter((record) => {
    const status = existingByContentId.get(record.contentId);
    const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase() : "";
    return normalizedStatus !== "published" && normalizedStatus !== "approved" && normalizedStatus !== "accepted";
  });

  console.log("[CURRICULUM EXPANSION] Existing selection state", {
    existingSelectedLessons: existingRows.length,
    unpublishedSelectedLessons: unpublishedSelected.length,
    sampleUnpublishedContentIds: unpublishedSelected.slice(0, 10).map((record) => record.contentId),
  });

  if (!args.has("--write")) {
    console.log("[CURRICULUM EXPANSION] Preview only. Pass --write to persist records.");
    return;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const record of records) {
    const inputPayload = record.payload as Prisma.InputJsonValue;
    const existing = await prisma.curriculumContent.findUnique({
      where: { contentId: record.contentId },
      select: { id: true, hash: true, payload: true, status: true, embeddedAt: true },
    });

    const existingChunkCount =
      existing && publish
        ? await prisma.ragChunk.count({
            where: {
              sourceType: "curriculum_content",
              sourceId: existing.id,
            },
          })
        : 0;

    const normalizedExistingStatus =
      typeof existing?.status === "string" ? existing.status.trim().toLowerCase() : "";
    const existingIsPublished =
      normalizedExistingStatus === "published" ||
      normalizedExistingStatus === "approved" ||
      normalizedExistingStatus === "accepted";
    const canSkipUnchangedRecord =
      existing &&
      !force &&
      existing.hash === record.hash &&
      isLessonValid(existing.payload) &&
      (!publish || (existingIsPublished && existing.embeddedAt != null && existingChunkCount > 0));

    if (canSkipUnchangedRecord) {
      skipped += 1;
      continue;
    }

    const persisted = await governedCurriculum.upsert({
      where: { contentId: record.contentId },
      update: {
        grade: record.grade,
        subject: record.subject,
        contentType: record.contentType,
        version: record.version,
        status: publish ? "published" : "pending_approval",
        hash: record.hash,
        unitId: record.unitId,
        orderInUnit: record.orderInUnit,
        lessonType: record.lessonType,
        payload: inputPayload,
        moeAlignments: Array.isArray((record.payload as Record<string, unknown>).moeAlignments)
          ? ((record.payload as Record<string, unknown>).moeAlignments as string[])
          : [],
      },
      create: {
        contentId: record.contentId,
        grade: record.grade,
        subject: record.subject,
        contentType: record.contentType,
        version: record.version,
        status: publish ? "published" : "pending_approval",
        hash: record.hash,
        unitId: record.unitId,
        orderInUnit: record.orderInUnit,
        lessonType: record.lessonType,
        payload: inputPayload,
        moeAlignments: Array.isArray((record.payload as Record<string, unknown>).moeAlignments)
          ? ((record.payload as Record<string, unknown>).moeAlignments as string[])
          : [],
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }

    if (publish) {
      const shouldResetEmbedding =
        force ||
        !existing ||
        existing.hash !== record.hash ||
        existing.embeddedAt == null;

      if (shouldResetEmbedding) {
        await clearLessonEmbedding(persisted.id);
      }

      try {
        await syncCurriculumContentRagChunks(persisted.id);
      } catch (error: any) {
        console.warn(
          `[CURRICULUM EXPANSION] Deferred chunk sync for ${record.contentId}: ${error?.message ?? "chunk_sync_failed"}`
        );
      }
    }
  }

  console.log("[CURRICULUM EXPANSION] Result", { created, updated, skipped, publish });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("[CURRICULUM EXPANSION] Failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
