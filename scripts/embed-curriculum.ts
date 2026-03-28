import { Prisma } from "@prisma/client";
import { embedLesson } from "@/lib/ai/rag/embeddingService";
import { syncCurriculumContentRagChunks } from "@/lib/ai/rag/ragIngestionService";
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

async function requeuePublishedEmbeddingsIfRequested() {
  if (!args.has("--requeue-published")) {
    return;
  }

  const result = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "CurriculumContent"
      SET "embedding" = NULL,
          "embeddedAt" = NULL
      WHERE LOWER(TRIM("status")) IN ('published', 'approved', 'accepted')
    `
  );

  console.log("[EMBED_CURRICULUM] Requeued published lesson embeddings", {
    updatedRows: Number(result ?? 0),
  });
}

async function loadPendingLessonIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id"
      FROM "CurriculumContent"
      WHERE LOWER(TRIM("status")) IN ('published', 'approved', 'accepted')
        AND ("embeddedAt" IS NULL OR "embedding" IS NULL)
      ORDER BY "createdAt" ASC
    `
  );

  return rows.map((row) => row.id);
}

async function logEmbeddingSelectionDiagnostics() {
  const [totals] = await prisma.$queryRaw<
    Array<{
      total: bigint | number;
      published: bigint | number;
      pending: bigint | number;
    }>
  >(Prisma.sql`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (
        WHERE LOWER(TRIM("status")) IN ('published', 'approved', 'accepted')
      )::bigint AS published,
      COUNT(*) FILTER (
        WHERE LOWER(TRIM("status")) IN ('published', 'approved', 'accepted')
          AND ("embeddedAt" IS NULL OR "embedding" IS NULL)
      )::bigint AS pending
    FROM "CurriculumContent"
  `);

  const sampleRows = await prisma.$queryRaw<
    Array<{ contentId: string; status: string; embeddedAt: Date | null }>
  >(Prisma.sql`
    SELECT "contentId", "status", "embeddedAt"
    FROM "CurriculumContent"
    WHERE LOWER(TRIM("status")) IN ('published', 'approved', 'accepted')
      AND ("embeddedAt" IS NULL OR "embedding" IS NULL)
    ORDER BY "createdAt" ASC
    LIMIT 5
  `);

  const toCount = (value: bigint | number | undefined) =>
    typeof value === "bigint" ? Number(value) : Number(value ?? 0);

  console.log("[EMBED_CURRICULUM] Selection counts", {
    totalCurriculumContent: toCount(totals?.total),
    publishedCurriculumContent: toCount(totals?.published),
    pendingEmbeddings: toCount(totals?.pending),
  });
  console.log(
    "[EMBED_CURRICULUM] Sample pending IDs",
    sampleRows.map((row) => ({
      contentId: row.contentId,
      status: row.status,
      embeddedAt: row.embeddedAt?.toISOString?.() ?? null,
    }))
  );
}

async function main() {
  assertSafeToRun();
  await requeuePublishedEmbeddingsIfRequested();

  await logEmbeddingSelectionDiagnostics();
  const ids = await loadPendingLessonIds();
  if (ids.length === 0) {
    console.log("No curriculum content pending embedding.");
    return;
  }

  let embeddedCount = 0;

  for (const [index, id] of ids.entries()) {
    await syncCurriculumContentRagChunks(id);
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
