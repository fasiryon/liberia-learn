import { config } from "dotenv";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createConservativeCurriculumMaintenanceClient } from "@/lib/curriculum/mutations/maintenanceClient";
const governedCurriculum = createConservativeCurriculumMaintenanceClient("generate-curriculum-coverage");
import {
  buildCoverageGenerationPlan,
  summarizeCoverageGenerationPlan,
  COVERAGE_ENGINE_VERSION,
  GENERATED_CURRICULUM_STATUS,
} from "@/lib/curriculum/generationEngine";

config({ path: ".env.local" });
config();

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

async function main() {
  const gradeArg = readArg("--grade");
  const grade = gradeArg ? Number.parseInt(gradeArg, 10) : undefined;
  const subject = readArg("--subject");
  const limitArg = readArg("--limit");
  const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined;
  const term = readArg("--term");
  const dryRun = hasFlag("--dry-run") || !hasFlag("--write");

  const options = {
    grade: Number.isFinite(grade) ? grade : undefined,
    subject,
    limit: Number.isFinite(limit) ? limit : undefined,
    allCore: hasFlag("--all-core"),
    allK12: hasFlag("--all-k12"),
    term,
  };

  const records = buildCoverageGenerationPlan(options);
  const summary = summarizeCoverageGenerationPlan(options);

  if (records.length === 0) {
    console.log("[CURRICULUM COVERAGE] No records selected.", { options });
    return;
  }

  console.log("[CURRICULUM COVERAGE] Engine summary", {
    version: COVERAGE_ENGINE_VERSION,
    status: GENERATED_CURRICULUM_STATUS,
    dryRun,
    options,
    summary,
    sampleContentIds: records.slice(0, 10).map((record) => record.contentId),
  });

  if (dryRun) {
    return;
  }

  const existingRows = await prisma.curriculumContent.findMany({
    where: {
      contentId: {
        in: records.map((record) => record.contentId),
      },
    },
    select: {
      id: true,
      contentId: true,
      status: true,
    },
  });

  const existingByContentId = new Map(existingRows.map((row) => [row.contentId, row]));
  let created = 0;
  let updated = 0;
  let skippedApproved = 0;

  for (const record of records) {
    const existing = existingByContentId.get(record.contentId);
    const normalizedStatus = existing?.status?.trim().toLowerCase() ?? "";
    const isApproved =
      normalizedStatus === "approved" ||
      normalizedStatus === "published" ||
      normalizedStatus === "accepted";

    if (isApproved) {
      skippedApproved += 1;
      continue;
    }

    await governedCurriculum.upsert({
      where: { contentId: record.contentId },
      update: {
        grade: record.grade,
        subject: record.subject,
        contentType: record.contentType,
        status: record.status,
        version: record.version,
        hash: record.hash,
        unitId: record.unitId,
        orderInUnit: record.orderInUnit,
        lessonType: record.lessonType,
        payload: record.payload as Prisma.InputJsonValue,
      },
      create: {
        contentId: record.contentId,
        grade: record.grade,
        subject: record.subject,
        contentType: record.contentType,
        status: record.status,
        version: record.version,
        hash: record.hash,
        unitId: record.unitId,
        orderInUnit: record.orderInUnit,
        lessonType: record.lessonType,
        payload: record.payload as Prisma.InputJsonValue,
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  console.log("[CURRICULUM COVERAGE] Persisted", {
    created,
    updated,
    skippedApproved,
    status: GENERATED_CURRICULUM_STATUS,
  });
}

main()
  .catch((error) => {
    console.error("[CURRICULUM COVERAGE] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
