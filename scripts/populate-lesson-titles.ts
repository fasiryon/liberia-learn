import { prisma } from "@/lib/db";
import { extractCurriculumTitle } from "@/lib/curriculum/title";

const BATCH_SIZE = 100;

async function main() {
  let updated = 0;

  while (true) {
    const rows = await prisma.curriculumContent.findMany({
      where: {
        OR: [{ title: null }, { title: "" }],
      },
      select: {
        id: true,
        contentId: true,
        payload: true,
      },
      take: BATCH_SIZE,
      orderBy: { updatedAt: "asc" },
    });

    if (rows.length === 0) {
      break;
    }

    const candidates = rows
      .map((row) => ({
        id: row.id,
        contentId: row.contentId,
        title: extractCurriculumTitle(row.payload),
      }))
      .filter((row): row is { id: string; contentId: string; title: string } => Boolean(row.title));

    if (candidates.length === 0) {
      break;
    }

    await prisma.$transaction(
      candidates.map((row) =>
        prisma.curriculumContent.update({
          where: { id: row.id },
          data: { title: row.title },
        })
      )
    );

    updated += candidates.length;
    console.log(
      `Updated ${updated} lesson titles so far. Latest batch ended at ${candidates[candidates.length - 1].contentId}.`
    );
  }

  console.log(`Lesson title backfill complete. Updated ${updated} records.`);
}

main()
  .catch((error) => {
    console.error("Failed to populate lesson titles:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
