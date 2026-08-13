import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lessonMediaPath, uploadLessonImage, signMediaUrl } from "@/lib/media/blobStorage";
import type { HeroImageMeta } from "@/lib/media/types";
import { randomUUID } from "crypto";
import { updateCurriculumContent } from "@/lib/curriculum/mutations/repository";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request, { params }: { params: Promise<{ contentId: string }> }) {
  try {
    const user = await requireRole("ADMIN");
    const { contentId } = await params;
    const lesson = await prisma.curriculumContent.findUnique({
      where: { contentId },
      select: { contentId: true, title: true, subject: true, imageCategory: true },
    });
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!ACCEPTED.has(file.type)) return NextResponse.json({ error: "Only JPEG/PNG/WebP allowed" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be 5MB or smaller" }, { status: 413 });

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = lessonMediaPath({ lessonId: contentId, kind: "hero", ext });
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadLessonImage({ path, data: buffer, contentType: file.type });

    const meta: HeroImageMeta = {
      alt: `${lesson.title ?? "Lesson"} — ${lesson.subject.toLowerCase().replace(/_/g, " ")}`,
      caption: null, provider: "manual", source: null, license: "Manually uploaded",
      credit: null, category: (lesson.imageCategory as any) ?? "VISUAL",
    };

    const traceId = randomUUID();
    await updateCurriculumContent(
      { contentId },
      {
        heroImageUrl: url, heroImageMeta: meta as any,
        imageGenerationStatus: "GENERATED", imageGenerationCost: 0,
        imageCategory: lesson.imageCategory ?? "VISUAL",
      },
      {
        revisionKind: "HUMAN_EDIT",
        originKind: "HUMAN_AUTHORED",
        actorUserId: user.id,
        authorUserId: user.id,
        requestedCompleteness: "VERIFIED",
        auditAction: "curriculum.revision.media_upload",
        idempotencyKey: `media-upload:${contentId}:${traceId}`,
        traceId,
        schoolId: user.schoolId ?? null,
      },
    );

    return NextResponse.json({ ok: true, heroPreview: await signMediaUrl(url) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
