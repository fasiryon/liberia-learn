import { prisma } from "../lib/db";
import { randomUUID } from "crypto";
import { enqueueCurriculumReviewTask } from "../lib/curriculum/review/tasks";
import { runAIReviewTask } from "../lib/curriculum/review/aiReview";
async function main() {
  const root = await prisma.curriculumProvenance.findFirst({ where: { currentRevisionId: { not: null } }, select: { id: true, currentRevisionId: true, curriculumContent: { select: { schoolId: true } } }, orderBy: { createdAt: "asc" } });
  if (!root?.currentRevisionId) throw new Error("No current production revision available for canary");
  const task = await enqueueCurriculumReviewTask({ provenanceId: root.id, revisionId: root.currentRevisionId, riskBand: "STANDARD", requestedAuthority: "PLATFORM", schoolId: root.curriculumContent.schoolId, createdByUserId: null, idempotencyKey: `p2b-ai-production-canary:${root.currentRevisionId}` });
  const result = await runAIReviewTask(task.id, { correlationId: randomUUID() });
  console.log(JSON.stringify({ taskId: task.id, status: result.status, decisionId: "decision" in result ? result.decision?.id ?? null : null, assessmentCount: result.assessments?.length ?? 0 }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
