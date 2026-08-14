import { randomUUID } from "crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { submitAssessment } from "@/lib/curriculum/review/assessments";
import { finalizeReviewTaskIfReady } from "@/lib/curriculum/review/decisions";
import { prisma } from "@/lib/db";
import { notifyDeterministicEligibleReviewers } from "@/lib/curriculum/review/notifications";

const ResponseValue = z.enum(["PASS", "CONCERN", "FAIL", "NOT_APPLICABLE"]);
const Body = z.object({
  leaseToken: z.string().uuid(),
  assignmentVersion: z.number().int().positive(),
  assessmentVersion: z.number().int().positive().optional(),
  rubricResponses: z.record(z.string(), z.object({ value: ResponseValue, note: z.string().max(2000).optional() })),
  recommendation: z.enum(["APPROVE", "REJECT", "RETURN_FOR_REVISION", "ESCALATE", "ABSTAIN_CONFLICT"]),
  rationale: z.string().trim().min(1).max(10000),
  evidenceRefs: z.array(z.unknown()).optional(),
  reviewerRiskResponse: z.unknown().optional(),
  idempotencyKey: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { assignmentId: string } }) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    const body = Body.parse(await req.json());
    const key = requireIdempotencyKey(req, body);
    const assessment = await submitAssessment({ ...body, assignmentId: params.assignmentId, user, idempotencyKey: key, rubricResponses: body.rubricResponses, evidenceRefs: body.evidenceRefs as any, reviewerRiskResponse: body.reviewerRiskResponse as any });
    const task = await prisma.curriculumReviewTask.findUniqueOrThrow({ where: { id: assessment.taskId } });
    const completion = await finalizeReviewTaskIfReady({ taskId: task.id, idempotencyKey: `decision:${key}`, traceId: randomUUID() });
    if (completion.status === "AWAITING_ASSESSMENTS") {
      void notifyDeterministicEligibleReviewers(task.id, "SECOND", "SECOND_REVIEW_REQUIRED").catch(() => null);
    } else if (completion.status === "DISAGREEMENT") {
      void notifyDeterministicEligibleReviewers(task.id, "RESOLVER", "DISAGREEMENT").catch(() => null);
    } else if (completion.status === "ESCALATED") {
      void notifyDeterministicEligibleReviewers(task.id, "RESOLVER", "ESCALATION").catch(() => null);
    }
    return Response.json({ assessment, completion });
  } catch (error) { return reviewApiError(error); }
}
