import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, reviewApiError } from "@/lib/curriculum/review/api";
import { assertReviewOperationsAdmin } from "@/lib/curriculum/review/access";
import { getCredentialCoverageReport, getQueueOperationsReport, getReviewerQualityReport } from "@/lib/curriculum/review/reporting";

export async function GET(req: Request) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    assertReviewOperationsAdmin(user, user.schoolId);
    const reviewerProfileId = new URL(req.url).searchParams.get("reviewerProfileId") ?? undefined;
    const schoolId = user.isPlatformAdmin || user.role === "MOE_SUPER_ADMIN" ? undefined : user.schoolId;
    const [queue, quality, coverage] = await Promise.all([
      getQueueOperationsReport(schoolId),
      getReviewerQualityReport(reviewerProfileId),
      getCredentialCoverageReport(),
    ]);
    return Response.json({ queue, quality, coverage });
  } catch (error) { return reviewApiError(error); }
}
