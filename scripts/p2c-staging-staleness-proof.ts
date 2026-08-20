import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { planAuthoritySourceChange } from "../lib/curriculum/benchmarking/sourceVersioning";

/**
 * Gate 8 (source update/staleness case): proves planAuthoritySourceChange
 * against the real seeded staging CurriculumAuthoritySourceVersion +
 * CurriculumBaselineAlignment rows, simulating a real future MOE re-publish
 * of Math 7-9.pdf with different content (hash changes), and confirming the
 * real alignment this session created gets correctly marked STALE and its
 * course impact identified -- without mutating any staging row.
 */

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";

function assertStaging(): void {
  const url = process.env.P2A_STAGING_DATABASE_URL?.trim();
  if (!url) throw new Error("P2A_STAGING_DATABASE_URL is required");
  if (!url.includes(STAGING_REF)) throw new Error("DATABASE_URL is not the approved staging project");
  if (url.includes(PRODUCTION_REF)) throw new Error("REFUSING: URL touches the production project ref");
  process.env.DATABASE_URL = url;
}
assertStaging();

const prisma = new PrismaClient();

async function main() {
  const g79Source = await prisma.curriculumAuthoritySource.findFirst({
    where: { canonicalUrl: "http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-7-9.zip" },
    include: { currentVersion: true },
  });
  if (!g79Source?.currentVersion) throw new Error("expected the real seeded GRADE-7-9.zip source to exist");

  const g9Objective = await prisma.moeCurriculumObjective.findUnique({ where: { code: "MOE.G9.MATH.SETS.TWO_SET_PROBLEMS" } });
  const alignment = await prisma.curriculumBaselineAlignment.findFirst({ where: { moeObjectiveId: g9Objective!.id } });
  if (!alignment) throw new Error("expected the real seeded G9 alignment to exist");

  // Read-only: no write happens. Simulates a hypothetical future MOE
  // re-publish with different content, purely to prove the change-detection
  // and staleness-propagation logic against the real current staging row.
  const plan = planAuthoritySourceChange({
    content: "HYPOTHETICAL Math 7-9.pdf v2 content (not real; this is a read-only simulation)",
    previousVersion: { id: g79Source.currentVersion.id, contentHash: g79Source.currentVersion.contentHash },
    alignments: [{ id: alignment.id, sourceVersionIds: [g79Source.currentVersion.id], impactedCourseRefs: ["G9-MATH"] }],
  });

  console.log("=== Gate 8: source staleness/change-detection proof (real staging row, read-only simulation) ===");
  console.log({
    realSourceId: g79Source.id,
    realCurrentVersionId: g79Source.currentVersion.id,
    realContentHash: g79Source.currentVersion.contentHash,
    realAlignmentId: alignment.id,
  });
  console.log("planAuthoritySourceChange result:", plan);

  const pass =
    plan.changed === true &&
    plan.supersedesVersionId === g79Source.currentVersion.id &&
    plan.alignmentValidityEvents.length === 1 &&
    plan.alignmentValidityEvents[0].alignmentId === alignment.id &&
    plan.alignmentValidityEvents[0].status === "STALE" &&
    plan.impactedCourseRefs.includes("G9-MATH") &&
    plan.triggerAiReview === true;
  console.log(pass ? "GATE 8 (staleness case): PASS" : "GATE 8 (staleness case): FAIL");
  if (!pass) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
