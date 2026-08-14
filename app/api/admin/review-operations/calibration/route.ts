import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { assertReviewOperationsAdmin } from "@/lib/curriculum/review/access";
import { createCalibrationSession } from "@/lib/curriculum/review/calibration";

const Body = z.object({ name: z.string().trim().min(1).max(300), revisionId: z.string().min(1), referenceSnapshot: z.unknown(), opensAt: z.coerce.date().nullable().optional(), closesAt: z.coerce.date().nullable().optional(), idempotencyKey: z.string().optional() });

export async function GET() {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    assertReviewOperationsAdmin(user, user.schoolId);
    return Response.json({ sessions: await prisma.reviewCalibrationSession.findMany({ include: { results: true }, orderBy: { createdAt: "desc" } }) });
  } catch (error) { return reviewApiError(error); }
}

export async function POST(req: Request) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    assertReviewOperationsAdmin(user, user.schoolId);
    const body = Body.parse(await req.json());
    requireIdempotencyKey(req, body);
    return Response.json({ session: await createCalibrationSession({ ...body, referenceSnapshot: body.referenceSnapshot as object, createdByUserId: user.id, idempotencyKey: requireIdempotencyKey(req, body) }) }, { status: 201 });
  } catch (error) { return reviewApiError(error); }
}
