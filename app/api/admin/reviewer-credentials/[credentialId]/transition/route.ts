import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { transitionReviewerCredential } from "@/lib/curriculum/review/roster";

const Body = z.object({
  toStatus: z.enum(["PENDING_VERIFICATION", "VERIFIED", "SUSPENDED", "REVOKED", "EXPIRED", "SUPERSEDED"]),
  reason: z.string().max(5000).optional(),
  version: z.number().int().positive(),
  idempotencyKey: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { credentialId: string } }) {
  try {
    requireP2bEnabled();
    const operator = await requireUser();
    const body = Body.parse(await req.json());
    return Response.json({ credential: await transitionReviewerCredential({
      operator,
      credentialId: params.credentialId,
      toStatus: body.toStatus,
      reason: body.reason,
      expectedVersion: body.version,
      idempotencyKey: requireIdempotencyKey(req, body),
    }) });
  } catch (error) { return reviewApiError(error); }
}
