import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageLessonVideo } from "@/lib/lessons/videoUpload";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { contentId: string; videoId: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const body = await req.json().catch(() => ({}));
    const isActive = body?.isActive === true;
    const existing = await prisma.lessonVideo.findUnique({
      where: { id: params.videoId },
      select: { id: true, lessonId: true, uploadedBy: true },
    });
    if (!existing || existing.lessonId !== params.contentId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canManageLessonVideo({ user, video: existing })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const video = await prisma.lessonVideo.update({
      where: { id: existing.id },
      data: { isActive },
    });
    return NextResponse.json({ video });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Video update failed" }, { status: error?.status ?? 500 });
  }
}
