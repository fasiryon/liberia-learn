import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { signMediaUrl } from "@/lib/media/blobStorage";
import { categorizeLesson } from "@/lib/media/categorize";

export const dynamic = "force-dynamic";

const APPROVED = ["published", "APPROVED"];
const PAGE_SIZE = 24;

const BANDS: Record<string, number[]> = {
  "K-3": [1, 2, 3],
  "4-8": [4, 5, 6, 7, 8],
  "9-12": [9, 10, 11, 12],
};

export async function GET(req: Request) {
  try {
    await requireRole("ADMIN");
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category"); // VISUAL|PHOTO|ABSTRACT|FAILED
    const band = searchParams.get("band");
    const subject = searchParams.get("subject");
    const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);

    const where: any = { status: { in: APPROVED } };
    if (subject) where.subject = subject.toUpperCase();
    if (band && BANDS[band]) where.grade = { in: BANDS[band] };
    if (category === "FAILED") where.imageGenerationStatus = "FAILED";
    else if (category && ["VISUAL", "PHOTO", "ABSTRACT"].includes(category)) where.imageCategory = category;

    const [total, statusCounts, rows] = await Promise.all([
      prisma.curriculumContent.count({ where }),
      prisma.curriculumContent.groupBy({
        by: ["imageGenerationStatus"],
        where: { status: { in: APPROVED } },
        _count: true,
      }),
      prisma.curriculumContent.findMany({
        where,
        select: {
          contentId: true, title: true, subject: true, grade: true,
          heroImageUrl: true, heroImageMeta: true, imageCategory: true,
          imageGenerationStatus: true, imageGenerationCost: true, inlineIllustrations: true,
        },
        orderBy: [{ updatedAt: "desc" }],
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    const items = await Promise.all(
      rows.map(async (r) => ({
        contentId: r.contentId,
        title: r.title,
        subject: r.subject,
        grade: r.grade,
        category: r.imageCategory ?? categorizeLesson(r.subject, r.title),
        status: r.imageGenerationStatus,
        cost: r.imageGenerationCost ?? 0,
        inlineCount: Array.isArray(r.inlineIllustrations) ? r.inlineIllustrations.length : 0,
        heroPreview: r.heroImageUrl ? await signMediaUrl(r.heroImageUrl) : null,
        heroMeta: r.heroImageMeta ?? null,
      }))
    );

    const counts: Record<string, number> = {};
    for (const s of statusCounts) counts[s.imageGenerationStatus] = (s as any)._count;

    return NextResponse.json({
      items,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
      statusCounts: counts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
