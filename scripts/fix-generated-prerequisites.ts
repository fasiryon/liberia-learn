import { config } from "dotenv";
import { prisma } from "@/lib/db";
import { buildProgressionPatch, validateProgressionRows } from "@/lib/curriculum/progressionEnforcer";

config({ path: ".env.local" });
config();

type CurriculumRow = {
  id: string;
  contentId: string;
  grade: number;
  subject: string;
  status: string;
  unitId: string | null;
  orderInUnit: number | null;
  payload: unknown;
};

function asPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function classifyFailure(row: CurriculumRow, inferredPrimaryConcept: string, inferredPrerequisites: string[]) {
  const payload = asPayload(row.payload);
  const currentPrimary = typeof payload.primaryConcept === "string" ? payload.primaryConcept : null;
  const currentPrereqs = Array.isArray(payload.prerequisites)
    ? payload.prerequisites.filter((value): value is string => typeof value === "string")
    : [];

  if (currentPrereqs.length === 0 && inferredPrerequisites.length > 0 && currentPrimary === inferredPrimaryConcept) {
    return "C.invalid_prerequisite";
  }

  if (currentPrimary !== inferredPrimaryConcept) {
    return "D.missing_predecessor_lesson_metadata";
  }

  return "B.missing_concept_mapping";
}

async function main() {
  const rows = await prisma.curriculumContent.findMany({
    where: {
      contentType: "lesson",
      status: "generated",
    },
    select: {
      id: true,
      contentId: true,
      grade: true,
      subject: true,
      status: true,
      unitId: true,
      orderInUnit: true,
      payload: true,
    },
    orderBy: [{ grade: "asc" }, { subject: "asc" }, { contentId: "asc" }],
  });

  const failures = rows.filter((row) => {
    const payload = asPayload(row.payload);
    return payload.generationStage === "generated_enriched";
  }) as CurriculumRow[];

  const grouped = new Map<string, number>();
  let updated = 0;

  for (const row of failures) {
    const patch = buildProgressionPatch(row);
    const bucket = classifyFailure(row, patch.payload.primaryConcept as string, patch.payload.prerequisites as string[]);
    grouped.set(bucket, (grouped.get(bucket) ?? 0) + 1);

    await prisma.curriculumContent.update({
      where: { id: row.id },
      data: {
        orderInUnit: patch.orderInUnit,
        payload: patch.payload as any,
      },
    });
    updated += 1;
  }

  const refreshed = await prisma.curriculumContent.findMany({
    where: {
      contentType: "lesson",
      status: "generated",
    },
    select: {
      id: true,
      grade: true,
      subject: true,
      status: true,
      unitId: true,
      orderInUnit: true,
      payload: true,
    },
    orderBy: [{ grade: "asc" }, { subject: "asc" }, { contentId: "asc" }],
  });

  const validation = validateProgressionRows(refreshed as CurriculumRow[]);

  console.log("[CURRICULUM CLEANUP] Updated generated lesson metadata", {
    updated,
    breakdown: Object.fromEntries([...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    validation,
  });
}

main()
  .catch((error) => {
    console.error("[CURRICULUM CLEANUP] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
