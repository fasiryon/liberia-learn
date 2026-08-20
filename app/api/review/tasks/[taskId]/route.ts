import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, reviewApiError } from "@/lib/curriculum/review/api";
import { getReviewTaskView } from "@/lib/curriculum/review/taskView";

export async function GET(_req: Request, { params }: { params: { taskId: string } }) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    return Response.json({ task: await getReviewTaskView(params.taskId, user) });
  } catch (error) { return reviewApiError(error); }
}
