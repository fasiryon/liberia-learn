import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
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
      select: { id: true, lessonId: true, uploadedBy: true, schoolId: true },
    });
    if (!existing || existing.lessonId !== params.contentId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canManageLessonVideo({ user, video: existing })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If activating, deactivate all others for the same lesson
    if (isActive) {
      await prisma.lessonVideo.updateMany({
        where: { lessonId: params.contentId, isActive: true, id: { not: existing.id } },
        data: { isActive: false },
      });
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

export async function DELETE(
  _req: Request,
  { params }: { params: { contentId: string; videoId: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");

    const existing = await prisma.lessonVideo.findUnique({
      where: { id: params.videoId },
      select: { id: true, lessonId: true, uploadedBy: true, storageUrl: true, schoolId: true },
    });
    if (!existing || existing.lessonId !== params.contentId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canManageLessonVideo({ user, video: existing })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete from Vercel Blob (best-effort)
    if (existing.storageUrl && existing.storageUrl.startsWith("https://")) {
      await del(existing.storageUrl).catch(() => null);
    }

    await prisma.lessonVideo.delete({ where: { id: existing.id } });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Delete failed" }, { status: error?.status ?? 500 });
  }
}
