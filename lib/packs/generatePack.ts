import JSZip from "jszip";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";

const APPROVED_STATUSES = ["published", "APPROVED"];

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

function stripStudentKeys(obj: unknown): unknown {
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

    const zip = new JSZip();
    const manifestLessons: Array<{
      id: string;
      contentId: string;
      title: string;
      subject: string;
      grade: number;
      scheduledDate: string;
      periodNumber: number | null;
      hasAudio: boolean;
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
      access: "public",
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
