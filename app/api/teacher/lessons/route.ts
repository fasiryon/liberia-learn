import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { embedLesson } from "@/lib/ai/rag/embeddingService";
import {
  deleteCurriculumContentRagChunks,
  syncCurriculumContentRagChunks,
} from "@/lib/ai/rag/ragIngestionService";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  buildTeacherContentId,
  getTeacherClassOrThrow,
  inferClassGrade,
} from "@/lib/teacher/lessonAuthoring";
import { enqueueJob, isQueueConfigured, JobType } from "@/lib/queue";
import { isTeacherGenerationEnabled } from "@/lib/serverFlags";
import { logger } from "@/lib/logger";

const SaveLessonSchema = z.object({
  classId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(50).max(12000),
  assessmentQuestions: z.array(z.string().trim().min(3).max(500)).min(1).max(10),
  estimatedMinutes: z.number().int().min(15).max(180),
  status: z.enum(["draft", "published"]),
  standardCode: z.string().trim().min(1).max(100).optional(),
  contentId: z.string().trim().min(1).optional(),
});

function teacherGenerationDisabledResponse() {
  return NextResponse.json(
    { error: "teacher_generation_disabled" },
    { status: 503 }
  );
}

function isTeacherGenerationDisabled() {
  if (!isTeacherGenerationEnabled()) {
    return true;
  }
  return false;
}

async function runBestEffortAiWork(
  recordId: string,
  contentId: string,
  status: string
) {
  const queueConfigured = isQueueConfigured();

  if (queueConfigured) {
    try {
      await enqueueJob(JobType.GENERATE_EMBEDDINGS, {
        lessonId: recordId,
        contentId,
      });
    } catch (queueError) {
      logger.warn("[QUEUE] Falling back to inline embedding generation", { error: queueError });
      try {
        await embedLesson(recordId);
      } catch (embeddingError) {
        logger.warn("[RAG] Best-effort teacher lesson embedding failed", { error: embeddingError });
      }
    }
  } else {
    try {
      await embedLesson(recordId);
    } catch (embeddingError) {
      logger.warn("[RAG] Best-effort teacher lesson embedding failed", { error: embeddingError });
    }
  }

  if (status === "published") {
    if (!queueConfigured) {
      try {
        await syncCurriculumContentRagChunks(recordId);
      } catch (syncError) {
        logger.warn("[RAG] Best-effort teacher lesson sync failed", { error: syncError });
      }
    }
    return;
  }

  try {
    await deleteCurriculumContentRagChunks(recordId);
  } catch (cleanupError) {
    logger.warn("[RAG] Best-effort teacher lesson cleanup failed", { error: cleanupError });
  }
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();

  try {
    if (isTeacherGenerationDisabled()) {
      return teacherGenerationDisabledResponse();
    }
    const user = await requireRole("TEACHER");
    const body = SaveLessonSchema.parse(await req.json());
    const classRecord = await getTeacherClassOrThrow(user.id, body.classId);

    const standard =
      body.standardCode != null
        ? await prisma.standard.findUnique({
            where: { code: body.standardCode },
            select: { code: true, description: true },
          })
        : null;

    const payload = {
      title: body.title,
      body: body.content,
      assessmentQuestions: body.assessmentQuestions,
      estimatedMinutes: body.estimatedMinutes,
      approvalStatus: body.status === "published" ? "APPROVED" : "DRAFT",
      createdByRole: "TEACHER",
      createdByUserId: user.id,
      standardCode: body.standardCode ?? null,
      metadata: {
        generatedAt: new Date().toISOString(),
        subject: classRecord.subject,
        generationMethod: "ai_teacher_cocreation",
      },
    };

    const classGrade = inferClassGrade(classRecord.enrollments);
    if (classGrade == null) {
      return NextResponse.json(
        { error: "Unable to determine class grade level from enrolled students" },
        { status: 400 }
      );
    }

    const updateData = {
      title: body.title,
      grade: classGrade,
      subject: classRecord.subject,
      contentType: "lesson",
      status: body.status === "published" ? "published" : "draft",
      version: new Date().toISOString().slice(0, 10),
      payload: payload as any,
      moeAlignments: standard
        ? ([{ code: standard.code, description: standard.description }] as any)
        : ([] as any),
      teacherCreated: true,
    };

    const existing =
      body.contentId != null
        ? await prisma.curriculumContent.findUnique({
            where: { contentId: body.contentId },
            select: { id: true, payload: true },
          })
        : null;

    if (existing) {
      const createdByUserId = (existing.payload as any)?.createdByUserId;
      if (createdByUserId !== user.id) {
        return NextResponse.json(
          { error: "You can only update your own generated lesson" },
          { status: 403 }
        );
      }
    }

    const record = existing
      ? await prisma.curriculumContent.update({
          where: { contentId: body.contentId! },
          data: updateData,
        })
      : await prisma.curriculumContent.create({
          data: {
            contentId: buildTeacherContentId(body.classId, body.title),
            ...updateData,
          },
        });

    await runBestEffortAiWork(record.id, record.contentId, record.status);

    let scheduledWorkId: string | null = null;
    if (body.status === "published") {
      const scheduledWork = await prisma.scheduledWork.create({
        data: {
          contentId: record.contentId,
          classId: classRecord.id,
          scheduledDate: new Date(),
          createdById: user.id,
        },
      });
      scheduledWorkId = scheduledWork.id;
    }

    await logAudit({
      userId: user.id,
      action: "teacher.lesson.saved",
      resourceType: "curriculum",
      resourceId: record.contentId,
      schoolId: user.schoolId ?? null,
      traceId,
      details: {
        classId: classRecord.id,
        status: body.status,
        scheduledWorkId,
      },
    });

    return NextResponse.json({
      contentId: record.contentId,
      status: record.status,
      scheduledWorkId,
      className: classRecord.name,
    });
  } catch (error: unknown) {
    return handleApiError(error, {
      route: "/api/teacher/lessons",
      method: req.method,
      requestId: traceId,
    });
  }
}
