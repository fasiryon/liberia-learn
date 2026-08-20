import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isP2bReviewOperationsEnabled } from "@/lib/serverFlags";
import { getReviewTaskView } from "@/lib/curriculum/review/taskView";
import { ReviewWorkspace } from "./review-workspace";

export const dynamic = "force-dynamic";

export default async function ReviewTaskPage({ params }: { params: { taskId: string } }) {
  if (!isP2bReviewOperationsEnabled()) notFound();
  const user = await requireUser();
  const task = await getReviewTaskView(params.taskId, user);
  return <ReviewWorkspace initialTask={JSON.parse(JSON.stringify(task))} />;
}
