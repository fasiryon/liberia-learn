import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { claimReviewTask } from "@/lib/curriculum/review/claims";
import { notifyReviewUsers } from "@/lib/curriculum/review/notifications";

const Body = z.object({ idempotencyKey: z.string().optional() });

export async function POST(req: Request, { params }: { params: { taskId: string } }) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    const body = Body.parse(await req.json().catch(() => ({})));
    const assignment = await claimReviewTask({ taskId: params.taskId, user, idempotencyKey: requireIdempotencyKey(req, body) });
    await notifyReviewUsers("ASSIGNMENT", [user.id], params.taskId);
    return Response.json({ assignment }, { status: 201 });
  } catch (error) { return reviewApiError(error); }
}
