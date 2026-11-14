// route-policy: auth=session; scope=record; authority=moe-scope; rationale=MOE portal flag and existing canonical role or permission scope gate all domain work
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getCurriculumProvenanceExplanation } from "@/lib/curriculum/provenance/reader";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export async function GET(
  _req: Request,
  { params }: { params: { contentId: string } },
) {
  if (!isMoePortalEnabled()) return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
  try {
    await requireRole("MOE_OFFICIAL", "MOE_SUPER_ADMIN", "MOE_DISTRICT_ADMIN");
    const result = await getCurriculumProvenanceExplanation(params.contentId);
    return result
      ? NextResponse.json(result)
      : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/curriculum/[contentId]/provenance", method: "GET" });
  }
}
