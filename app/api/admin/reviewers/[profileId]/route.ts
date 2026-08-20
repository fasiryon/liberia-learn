import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { updateReviewerAvailability } from "@/lib/curriculum/review/roster";

const Body = z.object({ available: z.boolean(), maxActiveClaims: z.number().int().min(1).max(100), version: z.number().int().positive(), idempotencyKey: z.string().optional() });

export async function PATCH(req: Request, { params }: { params: { profileId: string } }) {
  try {
    requireP2bEnabled();
    const operator = await requireUser();
    const body = Body.parse(await req.json());
    requireIdempotencyKey(req, body);
    return Response.json({ reviewer: await updateReviewerAvailability({ operator, profileId: params.profileId, available: body.available, maxActiveClaims: body.maxActiveClaims, expectedVersion: body.version }) });
  } catch (error) { return reviewApiError(error); }
}
