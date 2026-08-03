// IMPORTANT (NR-11, 2026-08-02): this promotes generated content straight to
// APPROVED using an automated structural gate (word count, section presence)
// only. It is not a substitute for human/MOE review, records no reviewer
// identity, and writes nothing to AuditLog. See bulk-approve-published.ts
// for the sibling script and the production evidence of how much live
// content was approved this way rather than by a human.
import { config } from "dotenv";
import { prisma } from "@/lib/db";
import { evaluatePromotionCandidate } from "@/lib/curriculum/promotionPass";

config({ path: ".env.local" });
config();

function numberArg(flag: string, fallback: number) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  const batchSize = numberArg("--batch-size", 100);
  const approvedBy = "system:promotion-pass-2b";

  const candidates = await prisma.curriculumContent.findMany({
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
      payload: true,
    },
    orderBy: [{ grade: "asc" }, { subject: "asc" }, { contentId: "asc" }],
  });

  let promoted = 0;
  let failed = 0;
  let promotedWords = 0;

  for (let index = 0; index < candidates.length; index += batchSize) {
    const batch = candidates.slice(index, index + batchSize);

    for (const row of batch) {
      const approvedAtIso = new Date().toISOString();
      const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, any>)
        : {};
      const decision = evaluatePromotionCandidate(
        {
          contentId: row.contentId,
          grade: row.grade,
          subject: row.subject,
          status: row.status,
          payload,
        },
        approvedAtIso,
        approvedBy
      );

      if (decision.action === "promote") {
        await prisma.curriculumContent.update({
          where: { id: row.id },
          data: {
            status: "APPROVED",
            payload: decision.normalizedPayload,
          },
        });
        promoted += 1;
        promotedWords += decision.words;
        console.log(`Promoted: ${row.subject} Grade ${row.grade} - ${decision.words} words`);
        continue;
      }

      if (decision.gate != null) {
        failed += 1;
        console.log(`FAILED Gate ${decision.gate}: ${row.subject} Grade ${row.grade} - ${decision.reason}`);
      } else {
        console.log(`SKIPPED: ${row.subject} Grade ${row.grade} - ${decision.reason}`);
      }
    }
  }

  const totalApproved = await prisma.curriculumContent.count({
    where: {
      contentType: "lesson",
      status: "APPROVED",
    },
  });

  console.log("Promotion complete.");
  console.log(`Promoted: ${promoted} lessons`);
  console.log(`Failed gates: ${failed} lessons`);
  console.log(`Total APPROVED now: ${totalApproved} lessons`);
  console.log(`Average word count of promoted: ${promoted > 0 ? Math.round(promotedWords / promoted) : 0} words`);
}

main()
  .catch((error) => {
    console.error("[PROMOTION PASS 2B] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
