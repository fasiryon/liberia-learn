import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { saveAssessmentDraft } from "@/lib/curriculum/review/assessments";

const ResponseValue = z.enum(["PASS", "CONCERN", "FAIL", "NOT_APPLICABLE"]);
const Body = z.object({
  leaseToken: z.string().uuid(),
  assignmentVersion: z.number().int().positive(),
  assessmentVersion: z.number().int().positive().optional(),
  rubricResponses: z.record(z.string(), z.object({ value: ResponseValue, note: z.string().max(2000).optional() })),
  recommendation: z.enum(["APPROVE", "REJECT", "RETURN_FOR_REVISION", "ESCALATE", "ABSTAIN_CONFLICT"]).optional(),
  rationale: z.string().max(10000).optional(),
  evidenceRefs: z.array(z.unknown()).optional(),
  reviewerRiskResponse: z.unknown().optional(),
  idempotencyKey: z.string().optional(),
});

export async function PUT(req: Request, { params }: { params: { assignmentId: string } }) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    const body = Body.parse(await req.json());
    const assessment = await saveAssessmentDraft({
      ...body,
      assignmentId: params.assignmentId,
      user,
      idempotencyKey: requireIdempotencyKey(req, body),
      rubricResponses: body.rubricResponses,
      evidenceRefs: body.evidenceRefs as any,
      reviewerRiskResponse: body.reviewerRiskResponse as any,
    });
    return Response.json({ assessment });
  } catch (error) { return reviewApiError(error); }
}
