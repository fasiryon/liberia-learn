import { candidateReviewMedia } from "@/lib/learner-experience/candidateReview";
import { requireCandidateReviewer } from "@/lib/learner-experience/reviewerAccess";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { experienceId: string; mediaHash: string } }) {
  await requireCandidateReviewer();
  const bytes = candidateReviewMedia(params.experienceId, params.mediaHash);
  const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff", "Content-Type": "image/png" };
  return new Response(bytes ? new Uint8Array(bytes) : null, { status: bytes ? 200 : 404, headers });
}
