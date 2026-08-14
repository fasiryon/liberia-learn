import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { assertReviewOperationsAdmin, queueSchoolFilter } from "@/lib/curriculum/review/access";
import { enqueueCurriculumReviewTask, listReviewQueue } from "@/lib/curriculum/review/tasks";

export const dynamic = "force-dynamic";

const EnqueueSchema = z.object({
  provenanceId: z.string().min(1),
  revisionId: z.string().min(1),
  riskBand: z.enum(["CRITICAL", "HIGH", "STANDARD", "LOW"]),
  riskScore: z.number().int().min(0).max(100).optional(),
  riskReasons: z.array(z.string().min(1).max(300)).max(50).optional(),
  requestedAuthority: z.enum(["MOE", "SCHOOL", "PLATFORM"]),
  nationalPublication: z.boolean().optional(),
  waecAuthoritative: z.boolean().optional(),
  importedOrLicensed: z.boolean().optional(),
  sourceRightsRequired: z.boolean().optional(),
  reinstatementAfterRevocation: z.boolean().optional(),
  emergencyRevocation: z.boolean().optional(),
  policyException: z.boolean().optional(),
  schoolId: z.string().nullable().optional(),
  idempotencyKey: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    const url = new URL(req.url);
    const tasks = await listReviewQueue({
      schoolId: queueSchoolFilter(user),
      limit: Number(url.searchParams.get("limit") ?? 50),
    });
    return Response.json({ tasks });
  } catch (error) { return reviewApiError(error); }
}

export async function POST(req: Request) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    const body = EnqueueSchema.parse(await req.json());
    assertReviewOperationsAdmin(user, body.schoolId);
    const task = await enqueueCurriculumReviewTask({
      ...body,
      createdByUserId: user.id,
      idempotencyKey: requireIdempotencyKey(req, body),
    });
    return Response.json({ task }, { status: 201 });
  } catch (error) { return reviewApiError(error); }
}
