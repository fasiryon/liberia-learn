import { config } from "dotenv";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildProgressionPatch, validateProgressionRows } from "@/lib/curriculum/progressionEnforcer";

config({ path: ".env.local" });
config();

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  const dryRun = hasFlag("--dry-run") || !hasFlag("--write");
  const rows = await prisma.curriculumContent.findMany({
    where: {
      contentType: "lesson",
      status: {
        in: ["generated", "validated"],
      },
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
    orderBy: [{ subject: "asc" }, { grade: "asc" }, { unitId: "asc" }, { orderInUnit: "asc" }],
  });

  let rowsUpdated = 0;
  let lessonsReordered = 0;
  let violationsFixed = 0;
  const subjectsProcessed = [...new Set(rows.map((row) => row.subject))];

  for (const row of rows) {
    const patch = buildProgressionPatch(row);
    const changeCount = Object.values(patch.changes).filter(Boolean).length;
    if (patch.changes.orderInUnit) lessonsReordered += 1;
    violationsFixed += changeCount;

    if (!dryRun && changeCount > 0) {
      await prisma.curriculumContent.update({
        where: { id: row.id },
        data: {
          orderInUnit: patch.orderInUnit,
          payload: patch.payload as Prisma.InputJsonValue,
        },
      });
      rowsUpdated += 1;
    }
  }

  const refreshedRows = dryRun
    ? rows.map((row) => {
        const patch = buildProgressionPatch(row);
        return {
          ...row,
          orderInUnit: patch.orderInUnit,
          payload: patch.payload,
        };
      })
    : await prisma.curriculumContent.findMany({
        where: {
          contentType: "lesson",
          status: {
            in: ["generated", "validated"],
          },
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
      });

  const validations = validateProgressionRows(refreshedRows);
  const remainingViolations = Object.values(validations).reduce(
    (sum, violations) => sum + violations.length,
    0
  );

  console.log("[CURRICULUM PROGRESSION]", {
    dryRun,
    subjectsProcessed,
    rowsScanned: rows.length,
    rowsUpdated,
    lessonsReordered,
    violationsFixed,
    remainingViolations,
    validationSummary: validations,
  });
}

main()
  .catch((error) => {
    console.error("[CURRICULUM PROGRESSION] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
