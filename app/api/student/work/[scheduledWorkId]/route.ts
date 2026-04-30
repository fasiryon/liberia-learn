import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveLessonTitle } from "@/lib/lessons/resolveLessonTitle";

function isRenderableArtifact(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const artifact = value as Record<string, unknown>;
  return artifact.approved === true && artifact.renderStatus === "ready";
}

export const dynamic = "force-dynamic";

function utcDayRange(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return { start, end: new Date(start.getTime() + 86400000) };
}

async function resolveScheduledWorkForStudent(input: {
  lessonRef: string;
  userId: string;
  schoolId: string | null | undefined;
  studentRecordId: string;
}) {
  const direct = await prisma.scheduledWork.findUnique({
    where: { id: input.lessonRef },
    include: scheduledWorkInclude(input.userId),
  });
  if (direct) return direct;

  const { start, end } = utcDayRange();
  const timetableAssignment = await prisma.timetableAssignment.findFirst({
    where: {
      curriculumContentId: input.lessonRef,
      assignedDate: { gte: start, lt: end },
      timetable: {
        schoolId: input.schoolId ?? undefined,
        class: {
          enrollments: { some: { studentId: input.studentRecordId } },
        },
      },
    },
    include: {
      timetable: {
        select: {
          classId: true,
          periodLabel: true,
          startTime: true,
          endTime: true,
          teacherId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!timetableAssignment?.curriculumContentId) return null;

  const existing = await prisma.scheduledWork.findFirst({
    where: {
      contentId: timetableAssignment.curriculumContentId,
      classId: timetableAssignment.timetable.classId,
      scheduledDate: { gte: start, lt: end },
    },
    orderBy: { createdAt: "asc" },
    include: scheduledWorkInclude(input.userId),
  });
  if (existing) return existing;

  return prisma.scheduledWork.create({
    data: {
      contentId: timetableAssignment.curriculumContentId,
      classId: timetableAssignment.timetable.classId,
      scheduledDate: start,
      createdById: timetableAssignment.timetable.teacherId,
      startTime: timetableAssignment.timetable.startTime,
      endTime: timetableAssignment.timetable.endTime,
      status: "confirmed",
    },
    include: scheduledWorkInclude(input.userId),
  });
}

function scheduledWorkInclude(userId: string) {
  return {
    content: {
      select: {
        contentId: true,
        payload: true,
        subject: true,
        grade: true,
        contentType: true,
        version: true,
        deliveryProfile: true,
        moeAlignments: true,
        audioAssets: {
          orderBy: { generatedAt: "desc" as const },
          take: 1,
          select: {
            id: true,
            storageUrl: true,
            voice: true,
            durationSeconds: true,
            generatedAt: true,
            contentVersion: true,
            status: true,
            estimatedCostUsd: true,
            audioParts: true,
          },
        },
        videoSupplements: {
          where: { isActive: true },
          orderBy: { uploadedAt: "desc" as const },
          take: 1,
          select: {
            id: true,
            title: true,
            description: true,
            storageUrl: true,
            thumbnailUrl: true,
            durationSeconds: true,
            fileSize: true,
            uploadedAt: true,
            teacher: { select: { name: true } },
          },
        },
      },
    },
    class: {
      select: {
        id: true,
        schoolId: true,
        name: true,
        Teacher: { select: { name: true } },
        School: { select: { name: true } },
      },
    },
    progress: {
      where: { studentId: userId },
      select: {
        completedAt: true,
        startedAt: true,
        exitTicketScore: true,
        exitTicketResponses: true,
      },
    },
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scheduledWorkId: string }> }
) {
  try {
    const user = await requireRole("STUDENT");
    const { scheduledWorkId } = await params;

    // PERF FIX (Block 26): Parallelize scheduled-work fetch and student lookup.
    // Before: 3 sequential queries (sw → student → enrollment).
    // After:  2 steps — parallel (sw + student) → enrollment.
    // Also: replace `content: true` with explicit select to avoid fetching
    // moeAlignments, deliveryProfile, unitId, status, createdAt (~60% payload reduction).
    const student = await prisma.student.findUnique({ where: { userId: user.id } });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const sw = await resolveScheduledWorkForStudent({
      lessonRef: scheduledWorkId,
      userId: user.id,
      schoolId: user.schoolId,
      studentRecordId: student.id,
    });

    if (!sw) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Tenant isolation
    if (sw.class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_classId: { studentId: student.id, classId: sw.classId } },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const progress = sw.progress[0];

    // Mark as started if not already
    if (!progress) {
      await prisma.studentProgress.create({
        data: { studentId: user.id, scheduledWorkId: sw.id, startedAt: new Date() },
      });
    }

    const payload = sw.content.payload as any;
    const deliveryProfile = (sw.content.deliveryProfile as any) ?? payload?.deliveryProfile ?? null;
    const latestAudio = sw.content.audioAssets[0] ?? null;
    const audioStatus =
      latestAudio?.contentVersion === sw.content.version
        ? latestAudio.status
        : latestAudio?.status === "GENERATED"
          ? "STALE"
          : latestAudio?.status ?? "NOT_GENERATED";
    const activeVideo = sw.content.videoSupplements[0] ?? null;

    return NextResponse.json({
      id: sw.id,
      contentId: sw.content.contentId,
      title: resolveLessonTitle({
        payload,
        subject: String(sw.content.subject),
        fallbackTitle: sw.content.contentId,
      }),
      subject: sw.content.subject,
      grade: sw.content.grade,
      contentType: sw.content.contentType,
      body: payload?.body || payload?.lessons || payload,
      bodyStandard: payload?.body_standard ?? payload?.body ?? null,
      bodyBlock: payload?.body_block ?? payload?.body ?? null,
      objectives: payload?.objectives || payload?.learningObjectives || [],
      activities: payload?.activities || [],
      labs: payload?.labs || [],
      pseudoLabs: Array.isArray(payload?.pseudoLabs) ? payload.pseudoLabs.filter(isRenderableArtifact) : [],
      simulationDefinitions: Array.isArray(payload?.simulationDefinitions)
        ? payload.simulationDefinitions.filter(isRenderableArtifact)
        : [],
      threeDLabDefinitions: [],
      durationMins: payload?.durationMins || 45,
      teacherName: sw.class.Teacher?.name ?? "Teacher",
      schoolName: sw.class.School?.name ?? "School",
      className: sw.class.name,
      classFormat: sw.classFormat ?? "standard",
      audio: latestAudio
        ? {
            ...latestAudio,
            status: audioStatus,
          }
        : { status: "NOT_GENERATED" },
      activeVideo: activeVideo
        ? {
            ...activeVideo,
            teacherName: activeVideo.teacher?.name ?? "Teacher",
          }
        : null,
      deliveryProfile,
      moeAlignments: sw.content.moeAlignments ?? [],
      exitTicketScore: progress?.exitTicketScore ?? null,
      exitTicketResponses: progress?.exitTicketResponses ?? null,
      status: progress?.completedAt ? "completed" : progress?.startedAt ? "in_progress" : "not_started",
      completedAt: progress?.completedAt || null,
      startedAt: progress?.startedAt || null,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
