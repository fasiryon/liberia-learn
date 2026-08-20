import { PrismaClient } from "@prisma/client";
import { parseSupabaseDatabaseTarget } from "../lib/database-target";

const expectedRef = "bnphuinpvgpmebcsvmsp";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const target = parseSupabaseDatabaseTarget(url);
if (target.projectRef !== expectedRef) throw new Error("production dry run target guard failed");
const prisma = new PrismaClient();
async function main() {
  const [users, profiles, credentials, revisions, openTasks] = await Promise.all([
    prisma.user.count({ where: { role: { in: ["TEACHER", "ADMIN", "MOE_OFFICIAL"] } } }),
    prisma.reviewerProfile.count(),
    prisma.reviewerCredential.count({ where: { status: "VERIFIED" } }),
    prisma.curriculumContentRevision.count(),
    prisma.curriculumReviewTask.count({ where: { status: { in: ["QUEUED", "CLAIMED", "IN_REVIEW", "AWAITING_SECOND_REVIEW", "DISAGREEMENT", "ESCALATED"] } } }),
  ]);
  const candidates = await prisma.curriculumContentRevision.findMany({
    select: { id: true, provenanceId: true, revisionKind: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  console.log(JSON.stringify({ environment: "production", projectRef: target.projectRef, candidateUsers: users, reviewerProfiles: profiles, verifiedCredentials: credentials, revisions, openTasks, candidateRevisions: candidates.length, exactRevisionCandidates: candidates.map((x) => ({ revisionId: x.id, provenanceId: x.provenanceId, revisionKind: x.revisionKind })) }, null, 2));
}
main().finally(() => prisma.$disconnect());
