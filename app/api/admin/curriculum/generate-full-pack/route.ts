import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { liberianize } from "@/lib/localization/liberia-context";
import { standardizeTone } from "@/lib/localization/tone-standardizer";
import { gradeToBand } from "@/lib/moe/alignment-engine";
import { createHash } from "crypto";
import {
  slugify,
  generateLabs,
  generateTermPlanPayload,
  generateUnitPlanPayload,
  generateAssessmentItems,
  generateRubric,
  generateMasteryChecks,
} from "@/lib/curriculum-helpers";
import { embedLesson } from "@/lib/ai/rag/embeddingService";
import { syncCurriculumContentRagChunks } from "@/lib/ai/rag/ragIngestionService";
import { enqueueJob, isQueueConfigured, JobType } from "@/lib/queue";
import {
  checkRateLimit,
  getRateLimitHeaders,
  RATE_LIMIT_POLICIES,
  rateLimitExceededResponse,
} from "@/lib/rateLimit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  grade: z.number().int().min(1).max(12),
  subject: z.string().min(1),
  topic: z.string().min(1).max(200),
  moeAlignmentCodes: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const rateLimit = await checkRateLimit(user.id, {
      windowMs: RATE_LIMIT_POLICIES.ADMIN.windowMs,
      limit: RATE_LIMIT_POLICIES.ADMIN.limit,
      namespace: "curriculum_generate_full_pack",
    });

    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { grade, subject, topic, moeAlignmentCodes: callerCodes = [] } = parsed.data;

    // Auto-lookup MOE codes from DB when caller does not provide them.
    // This converts the previous opt-in behaviour to opt-out, ensuring every
    // full-pack has standards traceability without requiring the client to know
    // which codes apply.
    let moeAlignmentCodes: string[] = callerCodes;
    if (moeAlignmentCodes.length === 0) {
      const band = gradeToBand(grade);
      const dbCodes = await prisma.standard.findMany({
        where: { subject: subject as any, band },
        select: { code: true },
      });
      moeAlignmentCodes = dbCodes.map((s) => s.code);
    }

    const loc = (text: string) => standardizeTone(liberianize(text), grade);

    // 1. Term Plan
    const termPlan = generateTermPlanPayload(grade, subject, topic);

    // 2. Generate 4 units from the term plan weeks (weeks 1,4,7,10)
    const unitWeeks = [0, 3, 6, 9];
    const units = unitWeeks.map((weekIdx, unitIdx) => {
      const unitTopic = termPlan.weeks[weekIdx]?.topic ?? `${topic} - Unit ${unitIdx + 1}`;
      const unitPlan = generateUnitPlanPayload(grade, subject, unitTopic);

      // 3. Lessons for each unit (use the unit plan's lesson list)
      const lessons = (unitPlan.lessons ?? []).map((lesson: any) => {
        const labs = generateLabs(grade, subject, lesson.title);
        return {
          ...lesson,
          title: loc(lesson.title),
          focus: loc(lesson.focus),
          labs: labs.map((lab) => ({
          ...lab,
          title: loc(lab.title),
          labObjective: loc(lab.labObjective),
          materialsNeeded: lab.materialsNeeded.map(loc),
          procedure: lab.procedure.map((step) => ({
            ...step,
            instruction: loc(step.instruction),
            teacherNote: step.teacherNote ? loc(step.teacherNote) : null,
          })),
          observationForm: lab.observationForm.map((field) => ({
            ...field,
            prompt: loc(field.prompt),
            choices: field.choices?.map(loc) ?? null,
          })),
          analysisQuestions: lab.analysisQuestions.map((question) => ({
            ...question,
            question: loc(question.question),
            expectedAnswer: loc(question.expectedAnswer),
            scoringRubric: loc(question.scoringRubric),
          })),
          connectionToLesson: loc(lab.connectionToLesson),
          virtualAlternative: lab.virtualAlternative ? loc(lab.virtualAlternative) : null,
          safetyNotes: lab.safetyNotes ? loc(lab.safetyNotes) : null,
        })),
      };
      });

      // 4. Assessment + Rubric + Mastery
      const assessmentItems = generateAssessmentItems(grade, subject, unitTopic, moeAlignmentCodes);
      const rubric = generateRubric(unitTopic, moeAlignmentCodes);
      const masteryChecks = generateMasteryChecks(grade, subject, unitTopic);

      return {
        unitNumber: unitIdx + 1,
        unitPlan: {
          ...unitPlan,
          title: loc(unitPlan.title),
          objectives: (unitPlan.objectives ?? []).map(loc),
        },
        lessons,
        assessment: { items: assessmentItems, rubric },
        masteryChecks,
      };
    });

    // Assemble full pack payload
    const packPayload: Record<string, unknown> = {
      type: "full_pack",
      title: loc(`Full Curriculum Pack: ${topic} (Grade ${grade})`),
      grade,
      subject,
      termPlan: {
        ...termPlan,
        title: loc(termPlan.title),
      },
      units,
      metadata: {
        grade,
        subject,
        topic,
        locale: "LR",
        generatedAt: new Date().toISOString(),
        unitCount: units.length,
        lessonCount: units.reduce((sum, u) => sum + u.lessons.length, 0),
        labCount: units.reduce((sum, u) => sum + u.lessons.reduce((ls: number, l: any) => ls + (l.labs?.length ?? 0), 0), 0),
        assessmentItemCount: units.reduce((sum, u) => sum + u.assessment.items.length, 0),
      },
    };

    // Determine approval status
    let approvalStatus = "PENDING_APPROVAL";
    if (user.role === "ADMIN") {
      approvalStatus = "APPROVED";
    } else if (user.role === "TEACHER" && user.schoolId) {
      const school = await prisma.school.findUnique({
        where: { id: user.schoolId },
        select: { approvalRequired: true, allowTeacherPublish: true },
      });
      if (school?.allowTeacherPublish && !school?.approvalRequired) {
        approvalStatus = "APPROVED";
      }
    }

    packPayload.approvalStatus = approvalStatus;
    packPayload.createdByRole = user.role;
    packPayload.createdByUserId = user.id;
    if (user.role === "ADMIN") {
      packPayload.approvedByUserId = user.id;
      packPayload.approvedAt = new Date().toISOString();
    }

    const contentId = `full_pack-${subject.toLowerCase()}-g${grade}-${slugify(topic)}`;
    const payloadStr = JSON.stringify(packPayload);
    const hash = createHash("sha256").update(payloadStr).digest("hex").slice(0, 40);
    const dbStatus = approvalStatus === "APPROVED" ? "published" : "pending_approval";

    const record = await prisma.curriculumContent.upsert({
      where: { contentId },
      update: {
        title: typeof packPayload.title === "string" ? packPayload.title : null,
        grade,
        subject,
        payload: packPayload as any,
        moeAlignments: [],
        hash,
        version: new Date().toISOString().slice(0, 10),
        status: dbStatus,
        contentType: "full_pack",
      },
      create: {
        contentId,
        title: typeof packPayload.title === "string" ? packPayload.title : null,
        grade,
        subject,
        contentType: "full_pack",
        status: dbStatus,
        version: new Date().toISOString().slice(0, 10),
        payload: packPayload as any,
        moeAlignments: [],
        hash,
      },
    });

    if (record.status === "published") {
      if (isQueueConfigured()) {
        try {
          await enqueueJob(JobType.GENERATE_EMBEDDINGS, {
            lessonId: record.id,
            contentId: record.contentId,
          });
        } catch (error) {
          logger.warn("[QUEUE] Falling back to inline embedding generation", { error });
          try {
            await syncCurriculumContentRagChunks(record.id);
          } catch (syncError) {
            logger.warn("[RAG] Best-effort full-pack chunk sync failed", { error: syncError });
          }
          try {
            await embedLesson(record.id);
          } catch (embeddingError) {
            logger.warn("[RAG] Best-effort full-pack embedding failed", { error: embeddingError });
          }
        }
      } else {
        try {
          await syncCurriculumContentRagChunks(record.id);
        } catch (syncError) {
          logger.warn("[RAG] Best-effort full-pack chunk sync failed", { error: syncError });
        }
        try {
          await embedLesson(record.id);
        } catch (embeddingError) {
          logger.warn("[RAG] Best-effort full-pack embedding failed", { error: embeddingError });
        }
      }
    }

    await logAudit({
      userId: user.id,
      action: "curriculum.generate.full_pack",
      resourceType: "curriculum",
      resourceId: record.contentId,
      details: {
        grade,
        subject,
        topic,
        approvalStatus,
        unitCount: units.length,
        lessonCount: (packPayload.metadata as any).lessonCount,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        contentId: record.contentId,
        recordId: record.id,
        mode: "full_pack",
        approvalStatus,
        packSummary: {
          unitCount: units.length,
          lessonCount: (packPayload.metadata as any).lessonCount,
          labCount: (packPayload.metadata as any).labCount,
          assessmentItemCount: (packPayload.metadata as any).assessmentItemCount,
        },
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (err: any) {
    logger.error("Full-pack curriculum generation failed", {
      route: "/api/admin/curriculum/generate-full-pack",
      errorMessage: err?.message ?? String(err),
      status: err?.status ?? 500,
    });
    return NextResponse.json(
      { error: err?.message ?? "Failed to generate full pack" },
      { status: err?.status ?? 500 }
    );
  }
}
