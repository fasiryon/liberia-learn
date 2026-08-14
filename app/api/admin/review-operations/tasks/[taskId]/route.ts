import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { assertReviewOperationsAdmin } from "@/lib/curriculum/review/access";
import { cancelReviewTask, reprioritizeReviewTask } from "@/lib/curriculum/review/tasks";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reprioritize"), version: z.number().int().positive(), idempotencyKey: z.string().optional() }),
  z.object({ action: z.literal("cancel"), version: z.number().int().positive(), reason: z.string().trim().min(1).max(2000), idempotencyKey: z.string().optional() }),
]);

export async function POST(req: Request, { params }: { params: { taskId: string } }) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    assertReviewOperationsAdmin(user, user.schoolId);
    const body = Body.parse(await req.json());
    const key = requireIdempotencyKey(req, body);
    if (body.action === "cancel") {
      await cancelReviewTask({ taskId: params.taskId, expectedVersion: body.version, actorUserId: user.id, reason: body.reason, idempotencyKey: key });
      return Response.json({ ok: true });
    }
    return Response.json({ task: await reprioritizeReviewTask({ taskId: params.taskId, expectedVersion: body.version, actorUserId: user.id }) });
  } catch (error) { return reviewApiError(error); }
}
