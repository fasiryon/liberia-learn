import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { submitCalibrationResult } from "@/lib/curriculum/review/calibration";

const Body = z.object({ rubricResponses: z.record(z.string(), z.object({ value: z.enum(["PASS", "CONCERN", "FAIL", "NOT_APPLICABLE"]), note: z.string().optional() })), recommendation: z.string().min(1), rationale: z.string().min(1).max(10000), idempotencyKey: z.string().optional() });

export async function POST(req: Request, { params }: { params: { sessionId: string } }) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    const profile = await prisma.reviewerProfile.findUnique({ where: { userId: user.id } });
    if (!profile || profile.status !== "ACTIVE") return Response.json({ error: "PROFILE_MISSING" }, { status: 403 });
    const body = Body.parse(await req.json());
    return Response.json({ result: await submitCalibrationResult({ ...body, sessionId: params.sessionId, reviewerProfileId: profile.id, idempotencyKey: requireIdempotencyKey(req, body), rubricResponses: body.rubricResponses }) });
  } catch (error) { return reviewApiError(error); }
}
