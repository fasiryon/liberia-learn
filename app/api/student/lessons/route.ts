// route-policy: auth=session; scope=tenant; authority=student-enrollment-and-shared-curriculum-eligibility; rationale=learner catalog never replays cached authorization after revocation
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { readLearnDiscovery } from "@/lib/student/learnDiscovery.server";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 12;

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT");
    const page = Math.max(1, Math.floor(Number(req.nextUrl.searchParams.get("page") ?? "1") || 1));
    const model = await readLearnDiscovery(user, { page, pageSize: PAGE_SIZE });
    const items = model.lessons.items;
    return NextResponse.json({
      grade: model.lessons.items[0]?.grade ?? null, count: items.length, total: model.lessons.total,
      page, totalPages: Math.ceil(model.lessons.total / PAGE_SIZE), subjectCompletion: model.subjectCompletion,
      items: items.map((item) => ({ ...item, displayTitle: item.title })),
      availability: model.lessons.availability === "empty" ? "current" : model.lessons.availability, generatedAt: model.generatedAt, freshness: model.freshness,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 503;
    return NextResponse.json({ error: "Lessons unavailable", availability: "unavailable" }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
