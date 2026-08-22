import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { overrideReviewClaim } from "@/lib/curriculum/review/claims";

const Body = z.object({ reason: z.string().trim().min(1).max(2000), version: z.number().int().positive(), idempotencyKey: z.string().optional() });

export async function POST(req: Request, { params }: { params: { assignmentId: string } }) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    const body = Body.parse(await req.json());
    await overrideReviewClaim({ assignmentId: params.assignmentId, actor: user, reason: body.reason, expectedVersion: body.version, idempotencyKey: requireIdempotencyKey(req, body) });
    return Response.json({ ok: true });
  } catch (error) { return reviewApiError(error); }
}
