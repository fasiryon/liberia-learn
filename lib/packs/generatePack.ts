import JSZip from "jszip";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { signMediaUrl } from "@/lib/media/blobStorage";

const APPROVED_STATUSES = ["published", "APPROVED"];

// Phase 4A: cap hero images per pack so the zip stays well under the 30MB budget.
const PACK_IMAGE_BUDGET_BYTES = 8 * 1024 * 1024; // 8MB of illustrations per pack

/**
 * Bundle a lesson hero image into its pack folder, respecting a shared media
 * budget. Returns bytes written (0 if skipped). Non-fatal on any failure.
 */
async function bundleHeroImage(
  folder: JSZip,
  content: { heroImageUrl?: string | null; heroImageMeta?: unknown },
  budget: { used: number }
): Promise<{ hasImage: boolean; caption: unknown }> {
  if (!content.heroImageUrl || budget.used >= PACK_IMAGE_BUDGET_BYTES) {
    return { hasImage: false, caption: null };
  }
  try {
    const signed = (await signMediaUrl(content.heroImageUrl)) ?? content.heroImageUrl;
    const res = await fetch(signed);
    if (!res.ok) return { hasImage: false, caption: null };
    const buf = await res.arrayBuffer();
    if (budget.used + buf.byteLength > PACK_IMAGE_BUDGET_BYTES) {
      return { hasImage: false, caption: null };
    }
    budget.used += buf.byteLength;
    folder.file("hero.jpg", buf);
    folder.file("hero.meta.json", JSON.stringify(content.heroImageMeta ?? {}, null, 2));
    return { hasImage: true, caption: content.heroImageMeta };
  } catch {
    return { hasImage: false, caption: null };
  }
}

// Keys stripped from lesson payload for student packs
const STUDENT_STRIP_KEYS = new Set([
  "answerKey",
  "correctAnswer",
  "correctIndex",
  "teacherNotes",
  "presenterNotes",
  "scoringRubric",
  "modelAnswer",
]);

export function stripStudentKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripStudentKeys);
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (!STUDENT_STRIP_KEYS.has(k)) out[k] = stripStudentKeys(v);
    }
    return out;
  }
  return obj;
}

export type PackResult = {
  packId: string;
  blobUrl: string;
  sizeBytes: number;
  lessonCount: number;
};

export async function generatePack(packId: string): Promise<PackResult> {
  const pack = await prisma.offlinePack.findUniqueOrThrow({ where: { id: packId } });

  await prisma.offlinePack.update({ where: { id: packId }, data: { status: "generating" } });

  try {
    const works = await prisma.scheduledWork.findMany({
      where: {
        ...(pack.classId ? { classId: pack.classId } : {}),
        scheduledDate: { gte: pack.weekStart, lt: pack.weekEnd },
        content: { status: { in: APPROVED_STATUSES } },
      },
      orderBy: [{ scheduledDate: "asc" }, { periodNumber: "asc" }],
      include: {
        content: {
          select: {
            id: true,
            contentId: true,
            payload: true,
            subject: true,
            grade: true,
            contentType: true,
            heroImageUrl: true,
            heroImageMeta: true,
            audioAssets: {
              where: { status: "GENERATED" },
              orderBy: { generatedAt: "desc" },
              take: 1,
              select: { id: true, storageUrl: true, durationSeconds: true },
            },
          },
        },
      },
    });

    // Derive schoolId for school_wide query (OfflinePack has no schoolId field)
    const packClass = pack.classId
      ? await prisma.class.findUnique({ where: { id: pack.classId }, select: { schoolId: true } })
      : null;
    const packSchoolId = packClass?.schoolId ?? null;

    // Fetch teacher-assigned lessons for this class/week
    const teacherAssignments = pack.classId
      ? await prisma.teacherLessonAssignment.findMany({
          where: {
            classId: pack.classId,
            OR: [
              { scheduledFor: null },
              { scheduledFor: { gte: pack.weekStart, lt: pack.weekEnd } },
            ],
            content: { editReviewStatus: "APPROVED" },
          },
          include: {
            content: {
              select: {
                id: true, contentId: true, payload: true, subject: true, grade: true,
                contentType: true, editedBy: { select: { name: true } },
                heroImageUrl: true, heroImageMeta: true,
                audioAssets: {
                  where: { status: "GENERATED" },
                  orderBy: { generatedAt: "desc" },
                  take: 1,
                  select: { id: true, storageUrl: true, durationSeconds: true },
                },
              },
            },
          },
        })
      : [];

    // Fetch school-wide teacher lessons
    const schoolWideContent = packSchoolId
      ? await prisma.curriculumContent.findMany({
          where: { visibility: "school_wide", schoolId: packSchoolId, editReviewStatus: "APPROVED" },
          select: {
            id: true, contentId: true, payload: true, subject: true, grade: true,
            contentType: true, editedBy: { select: { name: true } },
            heroImageUrl: true, heroImageMeta: true,
            audioAssets: {
              where: { status: "GENERATED" },
              orderBy: { generatedAt: "desc" },
              take: 1,
              select: { id: true, storageUrl: true, durationSeconds: true },
            },
          },
        })
      : [];

    const zip = new JSZip();
    const imageBudget = { used: 0 };
    const manifestLessons: Array<{
      id: string;
      contentId: string;
      title: string;
      subject: string;
      grade: number;
      scheduledDate: string;
      periodNumber: number | null;
      hasAudio: boolean;
      teacherCreated?: boolean;
      teacherAuthorName?: string | null;
    }> = [];

    for (const work of works) {
      const c = work.content;
      if (!c) continue;
      const payload = c.payload as Record<string, unknown> | null;
      const title =
        (payload as Record<string, unknown> | null)?.title ??
        (payload as Record<string, unknown> | null)?.lessonTitle ??
        c.contentId;

      const lessonPayload =
        pack.audience === "student" ? stripStudentKeys(payload) : payload;

      const folder = zip.folder(`lessons/${c.contentId}`);
      if (!folder) continue;

      folder.file(
        "lesson.json",
        JSON.stringify(
          {
            id: work.id,
            contentId: c.contentId,
            subject: c.subject,
            grade: c.grade,
            contentType: c.contentType,
            scheduledDate: work.scheduledDate.toISOString(),
            periodNumber: work.periodNumber,
            payload: lessonPayload,
          },
          null,
          2
        )
      );

      // Fetch and bundle audio when available
      const audio = c.audioAssets[0];
      let hasAudio = false;
      if (audio?.storageUrl) {
        try {
          const res = await fetch(audio.storageUrl);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            folder.file("audio.mp3", buf);
            hasAudio = true;
          }
        } catch {
          // audio fetch failures are non-fatal — pack ships without audio
        }
      }

      // Phase 4A: bundle hero illustration within the pack media budget
      await bundleHeroImage(folder, c, imageBudget);

      manifestLessons.push({
        id: work.id,
        contentId: c.contentId,
        title: String(title ?? c.contentId),
        subject: String(c.subject),
        grade: c.grade ?? 0,
        scheduledDate: work.scheduledDate.toISOString(),
        periodNumber: work.periodNumber,
        hasAudio,
      });
    }

    // Dedup against works already bundled
    const seenTeacherContentIds = new Set<string>(
      works.map((w) => w.content?.contentId).filter((id): id is string => Boolean(id))
    );

    const teacherItems = [
      ...teacherAssignments.map((ta) => ({ c: ta.content, source: "assigned" })),
      ...schoolWideContent.map((c) => ({ c, source: "school_wide" })),
    ];

    for (const { c } of teacherItems) {
      if (seenTeacherContentIds.has(c.contentId)) continue;
      seenTeacherContentIds.add(c.contentId);

      const payload = c.payload as Record<string, unknown> | null;
      const title = (payload as any)?.title ?? (payload as any)?.lessonTitle ?? c.contentId;
      const lessonPayload = pack.audience === "student" ? stripStudentKeys(payload) : payload;

      const folder = zip.folder(`lessons/${c.contentId}`);
      if (!folder) continue;

      folder.file("lesson.json", JSON.stringify({
        id: c.id, contentId: c.contentId, subject: c.subject, grade: c.grade,
        contentType: c.contentType, payload: lessonPayload,
        teacherCreated: true, teacherAuthorName: c.editedBy?.name ?? null,
      }, null, 2));

      const audio = c.audioAssets[0];
      let hasAudio = false;
      if (audio?.storageUrl) {
        try {
          const res = await fetch(audio.storageUrl);
          if (res.ok) { folder.file("audio.mp3", await res.arrayBuffer()); hasAudio = true; }
        } catch { /* non-fatal */ }
      }

      await bundleHeroImage(folder, c, imageBudget);

      manifestLessons.push({
        id: c.id, contentId: c.contentId,
        title: String(title ?? c.contentId), subject: String(c.subject),
        grade: c.grade ?? 0, scheduledDate: pack.weekStart.toISOString(),
        periodNumber: null, hasAudio,
        teacherCreated: true, teacherAuthorName: c.editedBy?.name ?? null,
      });
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      weekStart: pack.weekStart.toISOString(),
      weekEnd: pack.weekEnd.toISOString(),
      classId: pack.classId ?? null,
      studentScoped: pack.audience === "student",
      totalLessons: manifestLessons.length,
      lessons: manifestLessons,
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const blobKey = `offline-packs/${pack.requestedById}/${packId}.zip`;
    const blob = await put(blobKey, zipBuffer, {
      access: "private",
      contentType: "application/zip",
    });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.offlinePack.update({
      where: { id: packId },
      data: {
        status: "ready",
        blobUrl: blob.url,
        blobKey,
        sizeBytes: zipBuffer.byteLength,
        lessonCount: manifestLessons.length,
        completedAt: new Date(),
        expiresAt,
      },
    });

    return {
      packId,
      blobUrl: blob.url,
      sizeBytes: zipBuffer.byteLength,
      lessonCount: manifestLessons.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.offlinePack.update({
      where: { id: packId },
      data: { status: "failed", failureReason: msg },
    });
    throw err;
  }
}

export function resolveWeekBounds(weekStartStr?: string): { weekStart: Date; weekEnd: Date } {
  let monday: Date;
  if (weekStartStr) {
    monday = new Date(`${weekStartStr}T00:00:00.000Z`);
  } else {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToMonday));
  }
  const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { weekStart: monday, weekEnd: sunday };
}
