import { prisma } from "../lib/db";
import { evaluateReviewPolicy } from "../lib/curriculum/review/policy";
import { parseSupabaseDatabaseTarget } from "../lib/database-target";

const STAGING_REF = "yonpfzjczoffhrgibxkz";
async function main(): Promise<void> {
  const target = parseSupabaseDatabaseTarget(process.env.DATABASE_URL ?? "", "DATABASE_URL");
  if (target.projectRef !== STAGING_REF) throw new Error("P2-B dry run refuses non-staging database");

const [candidateUsers, profileCount, credentialCount, pending] = await Promise.all([
  prisma.user.findMany({
    where: { role: { in: ["TEACHER", "ADMIN", "MOE_OFFICIAL"] } },
    select: { role: true, schoolId: true },
  }),
  prisma.reviewerProfile.count(),
  prisma.reviewerCredential.count(),
  prisma.curriculumProvenance.findMany({
    where: { lifecycleState: { in: ["PENDING_REVIEW", "DRAFT", "REJECTED"] }, currentRevisionId: { not: null } },
    include: { curriculumContent: { select: { contentId: true, subject: true, grade: true, contentType: true, schoolId: true } }, currentRevision: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
  }),
]);

const taskCandidates = pending.map((item) => {
  const policy = evaluateReviewPolicy({
    subject: item.curriculumContent.subject,
    grade: item.curriculumContent.grade,
    contentType: item.curriculumContent.contentType,
    requestedAuthority: item.curriculumContent.schoolId ? "SCHOOL" : "MOE",
    riskBand: "STANDARD",
    riskReasons: [],
    provenanceComplete: item.provenanceCompleteness === "VERIFIED",
  });
  return {
    contentId: item.curriculumContent.contentId,
    provenanceId: item.id,
    revisionId: item.currentRevision?.id,
    schoolId: item.curriculumContent.schoolId,
    priorityBand: policy.priorityBand,
    requiredAuthority: policy.requiredAuthority,
    requiredReviewCount: policy.requiredReviewCount,
    dueAt: policy.dueAt.toISOString(),
  };
});

console.log(JSON.stringify({
  mode: "DRY_RUN_NO_WRITES",
  stagingProject: STAGING_REF,
  candidateRoster: {
    explicitWarning: "Candidates are not qualified reviewers. No credential is inferred from role or employment.",
    existingReviewerProfiles: profileCount,
    existingReviewerCredentials: credentialCount,
    aggregateCandidates: Array.from(candidateUsers.reduce((groups, item) => {
      const key = `${item.role}|${item.schoolId ?? "NO_SCHOOL"}`;
      const current = groups.get(key) ?? { role: item.role, schoolId: item.schoolId, count: 0 };
      current.count += 1;
      groups.set(key, current);
      return groups;
    }, new Map<string, { role: string; schoolId: string | null; count: number }>()).values()),
  },
  taskBootstrap: {
    explicitWarning: "No historical or current review task was created by this report.",
    candidateCount: taskCandidates.length,
    candidates: taskCandidates,
  },
}, null, 2));

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  await prisma.$disconnect();
  process.exitCode = 1;
});
