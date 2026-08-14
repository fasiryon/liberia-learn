import { randomUUID } from "crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { finalizeReviewTaskIfReady } from "@/lib/curriculum/review/decisions";
import { getReviewTaskView } from "@/lib/curriculum/review/taskView";

const Body = z.object({ idempotencyKey: z.string().optional() });

export async function POST(req: Request, { params }: { params: { taskId: string } }) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    await getReviewTaskView(params.taskId, user);
    const body = Body.parse(await req.json().catch(() => ({})));
    return Response.json(await finalizeReviewTaskIfReady({ taskId: params.taskId, idempotencyKey: requireIdempotencyKey(req, body), traceId: randomUUID() }));
  } catch (error) { return reviewApiError(error); }
}
