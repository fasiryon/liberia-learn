import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { processLessonMedia } from "@/lib/media/processLesson";
import { signMediaUrl } from "@/lib/media/blobStorage";
import { logAssetGenerationTelemetry } from "@/lib/assets/generationTelemetry";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ contentId: string }> }) {
  try {
    await requireRole("ADMIN");
    const { contentId } = await params;
    const lesson = await prisma.curriculumContent.findUnique({
      where: { contentId },
      select: { contentId: true, title: true, subject: true, grade: true, payload: true, waecSyllabusTopics: true },
    });
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

    const payload = lesson.payload as any;
    const body = typeof payload?.body === "string" ? payload.body : payload?.body_standard || "";
    const start = new Date();

    const outcome = await processLessonMedia({
      contentId: lesson.contentId, title: lesson.title, subject: lesson.subject,
      grade: lesson.grade, body, topics: lesson.waecSyllabusTopics,
    });

    await prisma.curriculumContent.update({ where: { contentId }, data: outcome.update });
    await logAssetGenerationTelemetry({
      provider: outcome.provider ?? "none", model: outcome.category === "PHOTO" ? "curated" : "flux-schnell",
      assetType: "lesson_media_regenerate", tenantId: null, route: "admin.content-media.regenerate",
      startTime: start, endTime: new Date(), success: outcome.status !== "FAILED",
      estimatedCostUSD: outcome.cost, failureReason: outcome.reason ?? null,
      metadata: { contentId, category: outcome.category, inline: outcome.inlineCount },
    });

    const heroPreview = outcome.update.heroImageUrl
      ? await signMediaUrl(outcome.update.heroImageUrl as string)
      : null;

    return NextResponse.json({ ...outcome, heroPreview });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
