import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { heartbeatReviewClaim } from "@/lib/curriculum/review/claims";
import { prisma } from "@/lib/db";

const Body = z.object({ leaseToken: z.string().uuid(), version: z.number().int().positive(), idempotencyKey: z.string().optional() });

export async function POST(req: Request, { params }: { params: { assignmentId: string } }) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    const body = Body.parse(await req.json());
    requireIdempotencyKey(req, body);
    const profile = await prisma.reviewerProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return Response.json({ error: "PROFILE_MISSING" }, { status: 403 });
    return Response.json({ assignment: await heartbeatReviewClaim({ assignmentId: params.assignmentId, reviewerProfileId: profile.id, leaseToken: body.leaseToken, version: body.version }) });
  } catch (error) { return reviewApiError(error); }
}
