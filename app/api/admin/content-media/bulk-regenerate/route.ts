import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { processLessonMedia } from "@/lib/media/processLesson";
import { logAssetGenerationTelemetry } from "@/lib/assets/generationTelemetry";

export const dynamic = "force-dynamic";

const APPROVED = ["published", "APPROVED"];
const MAX_BULK = 25; // synchronous cap to avoid function timeouts

export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const subject = String(body?.subject ?? "").toUpperCase();
    const limit = Math.min(MAX_BULK, Math.max(1, parseInt(String(body?.limit ?? "10"), 10) || 10));
    if (!subject) return NextResponse.json({ error: "subject is required" }, { status: 400 });

    const lessons = await prisma.curriculumContent.findMany({
      where: { status: { in: APPROVED }, subject },
      select: { contentId: true, title: true, subject: true, grade: true, payload: true, waecSyllabusTopics: true },
      orderBy: [{ grade: "asc" }],
      take: limit,
    });

    let generated = 0, curated = 0, skipped = 0, failed = 0, cost = 0;
    for (const lesson of lessons) {
      const payload = lesson.payload as any;
      const lessonBody = typeof payload?.body === "string" ? payload.body : payload?.body_standard || "";
      const start = new Date();
      const outcome = await processLessonMedia({
        contentId: lesson.contentId, title: lesson.title, subject: lesson.subject,
        grade: lesson.grade, body: lessonBody, topics: lesson.waecSyllabusTopics,
      });
      await prisma.curriculumContent.update({ where: { contentId: lesson.contentId }, data: outcome.update });
      await logAssetGenerationTelemetry({
        provider: outcome.provider ?? "none", model: outcome.category === "PHOTO" ? "curated" : "flux-schnell",
        assetType: "lesson_media_bulk", tenantId: null, route: "admin.content-media.bulk-regenerate",
        startTime: start, endTime: new Date(), success: outcome.status !== "FAILED",
        estimatedCostUSD: outcome.cost, metadata: { contentId: lesson.contentId, category: outcome.category },
      });
      cost += outcome.cost;
      if (outcome.status === "GENERATED") generated++;
      else if (outcome.status === "CURATED") curated++;
      else if (outcome.status === "SKIPPED") skipped++;
      else failed++;
    }

    return NextResponse.json({ subject, processed: lessons.length, generated, curated, skipped, failed, cost: Number(cost.toFixed(3)) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
