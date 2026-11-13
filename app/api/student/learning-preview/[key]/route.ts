// route-policy: auth=session; scope=tenant; authority=pilot-only-exact-package; rationale=uncached school cohort policy gates a read-only draft projection without academic writes
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLearningPreviewEnabled, loadStudentLearningPreview, authorizeStudentLearningPreview, parsePreviewSelection } from "@/lib/curriculum/v4/learningPreview";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request, { params }: { params: { key: string } }) {
  // Deployment opt-in is separate from, and cannot override, the uncached DB policy.
  if (!isLearningPreviewEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  const selection = parsePreviewSelection(params.key);
  if (!selection) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  try {
    const user = await requireRole("STUDENT");
    if (new URL(request.url).searchParams.get("accessOnly") === "1") {
      const access = await authorizeStudentLearningPreview(prisma, user, selection);
      return access ? NextResponse.json(access, { headers }) : NextResponse.json({ error: "Not found" }, { status: 404, headers });
    }
    const preview = await loadStudentLearningPreview(prisma, user, selection);
    if (!preview) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
    return NextResponse.json(preview, { headers });
  } catch (error) {
    const denied = error instanceof Error && (("status" in error && (error.status === 401 || error.status === 403)) ||
      error.message.startsWith("draft6_review_") || error.message.startsWith("draft6_academic:"));
    // Both responses deny access; temporary infrastructure errors let a hidden in-memory session survive.
    return NextResponse.json({ error: denied ? "Not found" : "Preview unavailable" }, { status: denied ? 404 : 503, headers });
  }
}
