import { requireCandidateReviewer } from "@/lib/learner-experience/reviewerAccess";

export const dynamic = "force-dynamic";
export default async function ReviewLayout({ children }: { children: React.ReactNode }) {
  await requireCandidateReviewer();
  return children;
}
