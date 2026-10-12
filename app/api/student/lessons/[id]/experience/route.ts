// route-policy: auth=session; scope=record; authority=student-authorized-curriculum-release; rationale=read-only exact-version learner-safe delivery through existing release, revision and school/enrollment authority
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LessonDeliveryError, resolveLessonDelivery } from "@/lib/lessons/lessonExperienceDelivery";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("STUDENT");
    const version = new URL(request.url).searchParams.get("version") ?? undefined;
    const delivery = await prisma.$transaction((tx) => resolveLessonDelivery(tx, user, params.id, version), { isolationLevel: "RepeatableRead" });
    return NextResponse.json(delivery, { headers });
  } catch (error) {
    if (error instanceof LessonDeliveryError) return NextResponse.json({ compatibility: "UNAVAILABLE", error: error.code }, { status: error.status, headers });
    const status = (error as { status?: number })?.status;
    return NextResponse.json({ compatibility: "UNAVAILABLE", error: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "UNAVAILABLE" }, { status: status === 401 || status === 403 ? status : 500, headers });
  }
}
