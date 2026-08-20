import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { imposeReviewerRestriction } from "@/lib/curriculum/review/roster";

const Body = z.object({
  restrictionType: z.enum(["ALL_REVIEW", "SUBJECT", "SCHOOL", "ORGANIZATION", "CALIBRATION_REQUIRED", "CONFLICT"]),
  reason: z.string().trim().min(1).max(5000),
  subject: z.string().nullable().optional(),
  schoolId: z.string().nullable().optional(),
  organizationRef: z.string().nullable().optional(),
  effectiveUntil: z.coerce.date().nullable().optional(),
  idempotencyKey: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { profileId: string } }) {
  try {
    requireP2bEnabled();
    const operator = await requireUser();
    const body = Body.parse(await req.json());
    requireIdempotencyKey(req, body);
    return Response.json({ restriction: await imposeReviewerRestriction({ ...body, operator, reviewerProfileId: params.profileId, idempotencyKey: requireIdempotencyKey(req, body) }) }, { status: 201 });
  } catch (error) { return reviewApiError(error); }
}
