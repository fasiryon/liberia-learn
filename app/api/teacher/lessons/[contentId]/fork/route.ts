import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  createCurriculumContent,
  ensureCurriculumProvenance,
  provenanceWritersEnabled,
} from "@/lib/curriculum/mutations/repository";

export async function POST(
  req: NextRequest,
  { params }: { params: { contentId: string } }
) {
  const traceId = randomUUID();
  try {
    const user = await requireRole("TEACHER");

    const source = await prisma.curriculumContent.findUnique({
      where: { contentId: params.contentId },
      include: { provenance: { select: { currentRevisionId: true } } },
    });

    if (!source) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (source.editReviewStatus !== "APPROVED") {
      return NextResponse.json({ error: "can_only_fork_approved" }, { status: 403 });
    }

    let lessonVersion = 1;
    let parentLessonId: string | null = null;
    let derivedFromContentId: string | null = null;

    if (!source.teacherCreated) {
      // Case 1: forking an AI-generated lesson
      derivedFromContentId = source.contentId;
    } else if (source.editedById === user.id) {
      // Case 2: teacher creating v2 of their own published lesson
      lessonVersion = (source.lessonVersion ?? 1) + 1;
      parentLessonId = source.id;
    } else {
      // Case 3: copying another teacher's school-wide lesson
      derivedFromContentId = source.contentId;
    }

    const newContentId = `fork-${user.id.slice(-8)}-${randomUUID().slice(0, 8)}`;

    let sourceRevisionId = source.provenance?.currentRevisionId ?? null;
    if (provenanceWritersEnabled() && !sourceRevisionId) {
      const adopted = await prisma.$transaction((tx) =>
        ensureCurriculumProvenance(tx, source as any),
      );
      sourceRevisionId = adopted.currentRevision?.id ?? null;
    }
    const governed = await createCurriculumContent(
      {
        contentId: newContentId,
        title: source.title,
        grade: source.grade,
        subject: source.subject as any,
        contentType: "lesson",
        status: "draft",
        version: new Date().toISOString().slice(0, 10),
        payload: source.payload as any,
        teacherCreated: true,
        editedById: user.id,
        editReviewStatus: null,
        lessonVersion,
        parentLessonId,
        derivedFromContentId,
        schoolId: user.schoolId ?? null,
        learningObjectives: source.learningObjectives as any,
      },
      {
        revisionKind: "FORK",
        originKind: "FORKED",
        actorUserId: user.id,
        authorUserId: user.id,
        sourceRevisionId,
        requestedCompleteness: sourceRevisionId ? "VERIFIED" : "PARTIAL",
        auditAction: "curriculum.revision.fork",
        auditDetails: { sourceContentId: source.contentId },
        schoolId: user.schoolId ?? null,
        traceId,
        idempotencyKey: `teacher-fork:${traceId}`,
      },
    );
    const created = governed.content;

    return NextResponse.json({ id: created.id, contentId: created.contentId });
  } catch (error) {
    return handleApiError(error, {
      route: `/api/teacher/lessons/${params.contentId}/fork`,
      method: "POST",
      requestId: traceId,
    });
  }
}
