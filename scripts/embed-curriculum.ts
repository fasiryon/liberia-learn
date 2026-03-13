import { Prisma } from "@prisma/client";
import { embedLesson } from "@/lib/ai/rag/embeddingService";
import { prisma } from "@/lib/db";

const args = new Set(process.argv.slice(2));

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertSafeToRun() {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.APP_ENV === "production";

  if (isProduction && !args.has("--force")) {
    throw new Error(
      "Refusing to embed curriculum in production without --force"
    );
  }
}

async function loadPendingLessonIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id"
      FROM "CurriculumContent"
      WHERE "embedding" IS NULL
      ORDER BY "createdAt" ASC
    `
  );

  return rows.map((row) => row.id);
}

async function main() {
  assertSafeToRun();

  const ids = await loadPendingLessonIds();
  if (ids.length === 0) {
    console.log("No curriculum content pending embedding.");
    return;
  }

  let embeddedCount = 0;

  for (const [index, id] of ids.entries()) {
    await embedLesson(id);
    embeddedCount += 1;
    console.log(`Embedded ${embeddedCount}/${ids.length} lessons`);

    if (index < ids.length - 1) {
      await sleep(100);
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("[EMBED_CURRICULUM] Failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
