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
    const query = new URL(request.url).searchParams;
    const version = query.get("version") ?? undefined;
    const kind = query.get("kind");
    if (kind !== null && kind !== "CONTENT" && kind !== "SCHEDULED_WORK") return NextResponse.json({ compatibility: "UNAVAILABLE", error: "UNAVAILABLE" }, { status: 400, headers });
    const routeKind: "CONTENT" | "SCHEDULED_WORK" | undefined = kind === "CONTENT" || kind === "SCHEDULED_WORK" ? kind : undefined;
    const delivery = await prisma.$transaction((tx) => resolveLessonDelivery(tx, user, params.id, version, routeKind), { isolationLevel: "RepeatableRead" });
    return NextResponse.json(delivery, { headers });
  } catch (error) {
    if (error instanceof LessonDeliveryError) return NextResponse.json({ compatibility: "UNAVAILABLE", error: error.code, ...(error.format ? { format: error.format } : {}), ...(error.reason ? { reason: error.reason } : {}) }, { status: error.status, headers });
    const status = (error as { status?: number })?.status;
    return NextResponse.json({ compatibility: "UNAVAILABLE", error: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "UNAVAILABLE" }, { status: status === 401 || status === 403 ? status : 500, headers });
  }
}
