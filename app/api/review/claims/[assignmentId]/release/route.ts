import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { releaseReviewClaim } from "@/lib/curriculum/review/claims";
import { prisma } from "@/lib/db";

const Body = z.object({ leaseToken: z.string().uuid(), version: z.number().int().positive(), reason: z.string().max(1000).optional(), recusal: z.boolean().optional(), idempotencyKey: z.string().optional() });

export async function POST(req: Request, { params }: { params: { assignmentId: string } }) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    const body = Body.parse(await req.json());
    const key = requireIdempotencyKey(req, body);
    const profile = await prisma.reviewerProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return Response.json({ error: "PROFILE_MISSING" }, { status: 403 });
    await releaseReviewClaim({ assignmentId: params.assignmentId, reviewerProfileId: profile.id, leaseToken: body.leaseToken, version: body.version, reason: body.reason, recusal: body.recusal, actorUserId: user.id, schoolId: user.schoolId, idempotencyKey: key });
    return Response.json({ ok: true });
  } catch (error) { return reviewApiError(error); }
}
