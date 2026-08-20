import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { requireIdempotencyKey, reviewApiError } from "@/lib/curriculum/review/api";
import { isP2bAiReviewEnabled } from "@/lib/serverFlags";
import { provisionAIReviewAgents, runAIReviewTask } from "@/lib/curriculum/review/aiReview";

const bodySchema = z.object({ taskId: z.string().min(1), correlationId: z.string().uuid().optional(), idempotencyKey: z.string().min(1).optional() });

export async function POST(req: Request) {
  try {
    if (!isP2bAiReviewEnabled()) return Response.json({ error: "P2B_AI_REVIEW_DISABLED" }, { status: 404 });
    await requirePlatformAdmin();
    const body = bodySchema.parse(await req.json());
    requireIdempotencyKey(req, body);
    await provisionAIReviewAgents({ enable: true });
    return Response.json(await runAIReviewTask(body.taskId, { correlationId: body.correlationId }));
  } catch (error) { return reviewApiError(error); }
}
