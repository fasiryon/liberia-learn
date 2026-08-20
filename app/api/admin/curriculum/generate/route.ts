// app/api/admin/curriculum/generate/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateCurriculumPayload } from "@/lib/ai/curriculum-factory";
import { liberianize } from "@/lib/localization/liberia-context";
import { standardizeTone } from "@/lib/localization/tone-standardizer";
import { logAudit } from "@/lib/audit";
import { recordMetricEvent } from "@/lib/metrics/events";
import { createHash, randomUUID } from "crypto";
import { slugify, generateLabs, generateTermPlanPayload, generateUnitPlanPayload } from "@/lib/curriculum-helpers";
import { gradeToBand } from "@/lib/moe/alignment-engine";
import { embedLesson } from "@/lib/ai/rag/embeddingService";
import { syncCurriculumContentRagChunks } from "@/lib/ai/rag/ragIngestionService";
import { enqueueJob, isQueueConfigured, JobType } from "@/lib/queue";
import { generateMediaArtifactsBestEffort } from "@/lib/curriculum/mediaGeneration";
import {
  checkRateLimit,
  getRateLimitHeaders,
  RATE_LIMIT_POLICIES,
  rateLimitExceededResponse,
} from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { enqueueCourseThumbnailGeneration } from "@/lib/courses/courseThumbnailQueue";
import { getPrompt } from "@/lib/ai/promptRegistry";
import { upsertCurriculumContent, provenanceWritersEnabled } from "@/lib/curriculum/mutations/repository";
import { appendCurriculumGovernanceEvent } from "@/lib/curriculum/mutations/governanceWriter";

const RequestSchema = z.object({
  grade: z.number().int().min(1).max(12),
  subject: z.string().min(1),
  topic: z.string().min(1).max(200),
  moeAlignmentCodes: z.array(z.string()).optional(),
  mode: z.enum(["lesson", "term_plan", "unit_plan"]).optional().default("lesson"),
  lessonFormat: z.enum(["standard", "block", "either"]).optional().default("either"),
});

// slugify and generateLabs imported from lib/curriculum-helpers

async function syncVirtualLabs(params: {
  labs: Array<Record<string, any>>;
  subject: string;
  grade: number;
  topic: string;
  contentId: string;
  schoolId: string | null | undefined;
  moeAlignmentCodes?: string[];
  approvalStatus: string;
}) {
  const { labs, subject, grade, topic, contentId, schoolId, moeAlignmentCodes, approvalStatus } = params;
  if (labs.length === 0) return;

  const gradeBand = gradeToBand(grade);
  const standardCodes = moeAlignmentCodes ?? [];

  await Promise.all(
    labs.map((lab, index) => {
      const labId = `${contentId}-lab-${index + 1}`;
      const description =
        typeof lab.connectionToLesson === "string" && lab.connectionToLesson.trim().length > 0
          ? lab.connectionToLesson
          : `Hands-on investigation for ${topic}`;

      return prisma.virtualLab.upsert({
        where: { labId },
        update: {
          title: lab.title,
          description,
          subject,
          grade,
          gradeBand,
          labType: lab.type,
          moeStandardCodes: standardCodes,
          triggerStandardCodes: standardCodes,
          primaryContentIds: [contentId],
          estimatedMinutes: lab.durationMinutes,
          difficulty: grade >= 9 ? "advanced" : grade >= 5 ? "standard" : "introductory",
          equipmentList: Array.isArray(lab.materialsNeeded) ? lab.materialsNeeded : [],
          safetyNotes: lab.safetyNotes ?? null,
          payload: { ...lab, topic },
          status: approvalStatus === "APPROVED" ? "published" : "draft",
          schoolId: schoolId ?? null,
        },
        create: {
          labId,
          title: lab.title,
          description,
          subject,
          grade,
          gradeBand,
          labType: lab.type,
          moeStandardCodes: standardCodes,
          triggerStandardCodes: standardCodes,
          primaryContentIds: [contentId],
          estimatedMinutes: lab.durationMinutes,
          difficulty: grade >= 9 ? "advanced" : grade >= 5 ? "standard" : "introductory",
          equipmentList: Array.isArray(lab.materialsNeeded) ? lab.materialsNeeded : [],
          safetyNotes: lab.safetyNotes ?? null,
          payload: { ...lab, topic },
          status: approvalStatus === "APPROVED" ? "published" : "draft",
          schoolId: schoolId ?? null,
        },
      });
    })
  );
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const rateLimit = await checkRateLimit(user.id, {
      windowMs: RATE_LIMIT_POLICIES.ADMIN.windowMs,
      limit: RATE_LIMIT_POLICIES.ADMIN.limit,
      namespace: "curriculum_generate",
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

    const { grade, subject, topic, moeAlignmentCodes, mode, lessonFormat } = parsed.data;
    const traceId = randomUUID();
    const generationCorrelationId = randomUUID();

    let enrichedPayload: Record<string, unknown>;
    let contentType = mode;
    let labs: Array<Record<string, any>> = [];

    if (mode === "term_plan") {
      enrichedPayload = generateTermPlanPayload(grade, subject, topic);
    } else if (mode === "unit_plan") {
      enrichedPayload = generateUnitPlanPayload(grade, subject, topic);
    } else {
      // Lesson mode (default) — use AI generation
      if (!process.env.OPENAI_API_KEY) {
        await logAudit({
          userId: user.id,
          action: "curriculum.generate.lesson.failed",
          resourceType: "curriculum",
          resourceId: null,
          details: {
            grade,
            subject,
            topic,
            mode,
            reason: "openai_key_missing",
          },
        });

        recordMetricEvent(
          "curriculum_generate_ai_unavailable",
          { mode, reason: "openai_key_missing" },
          { scope: "school", scopeId: user.schoolId ?? null, schoolId: user.schoolId ?? null }
        ).catch(() => {});

        return NextResponse.json(
          { ok: false, error: "AI unavailable", hadFallback: true },
          { status: 503 }
        );
      }

      const payload = await generateCurriculumPayload({
        grade,
        subject,
        topic,
        contentType: mode,
        moeAlignmentCodes,
        lessonFormat,
        liberiaContext: true,
        generationCorrelationId,
      });

      // Apply localization post-processing
      const localizedBody = standardizeTone(liberianize(payload.body), grade);
      const localizedStandardBody = payload.body_standard
        ? standardizeTone(liberianize(payload.body_standard), grade)
        : undefined;
      const localizedBlockBody = payload.body_block
        ? standardizeTone(liberianize(payload.body_block), grade)
        : undefined;
      const localizedActivities = (payload.activities ?? []).map(
        (a: string) => standardizeTone(liberianize(a), grade)
      );

      labs = Array.isArray(payload.labs) ? payload.labs : [];

      enrichedPayload = {
        ...payload,
        body: localizedBody,
        ...(localizedStandardBody ? { body_standard: localizedStandardBody } : {}),
        ...(localizedBlockBody ? { body_block: localizedBlockBody } : {}),
        activities: localizedActivities,
        labs,
      };
    }

    // Determine approval status based on role + school policy
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

    // Add approval + authorship metadata
    enrichedPayload = {
      ...enrichedPayload,
      approvalStatus,
      createdByRole: user.role,
      createdByUserId: user.id,
      ...(user.role === "ADMIN"
        ? { approvedByUserId: user.id, approvedAt: new Date().toISOString() }
        : {}),
    };

    // Derive contentId and hash
    const contentId = `${mode === "lesson" ? "" : mode + "-"}${subject.toLowerCase()}-g${grade}-${slugify(topic)}`;

    if (mode === "lesson") {
      const lessonTitle = String((enrichedPayload as any).title ?? topic);
      const lessonObjective =
        typeof (enrichedPayload as any).objective === "string"
          ? (enrichedPayload as any).objective
          : Array.isArray((enrichedPayload as any).objectives)
            ? String((enrichedPayload as any).objectives[0] ?? topic)
            : topic;
      const unitTitle =
        typeof (enrichedPayload as any).unitTitle === "string" && (enrichedPayload as any).unitTitle.trim().length > 0
          ? String((enrichedPayload as any).unitTitle)
          : topic;
      const mediaBundle = generateMediaArtifactsBestEffort({
        sourceLessonId: contentId,
        subject,
        grade,
        unitTitle,
        lessonTitle,
        objective: lessonObjective,
        teacherExplanation: String((enrichedPayload as any).body ?? ""),
        workedExamples: Array.isArray((enrichedPayload as any).activities)
          ? (enrichedPayload as any).activities.slice(0, 2).map(String)
          : [],
        guidedPractice: Array.isArray((enrichedPayload as any).activities)
          ? (enrichedPayload as any).activities.slice(0, 3).map(String)
          : [],
        groupWorkTask: String((enrichedPayload as any).activities?.[0] ?? `Apply ${topic} in pairs.`),
        guardianSupportNote: `Ask your child to explain the main idea from ${topic} and show one example.`,
        homePracticeSuggestion: `Review one short ${subject.toLowerCase()} task connected to ${topic} at home.`,
        realWorldApplication: `Connect ${topic} to Liberia-relevant classroom, home, or community use.`,
        digitalConnection: `If devices exist, extend ${topic} with a simple digital reinforcement activity.`,
        materialsNeeded: Array.isArray((enrichedPayload as any).labs?.[0]?.materialsNeeded)
          ? (enrichedPayload as any).labs[0].materialsNeeded.map(String)
          : ["paper", "exercise books", "board"],
      });

      enrichedPayload = {
        ...enrichedPayload,
        visualAssetSpecs: mediaBundle.visualAssetSpecs,
        audioScriptSpecs: mediaBundle.audioScriptSpecs,
        slideDeckSpecs: mediaBundle.slideDeckSpecs,
        videoStoryboardSpecs: mediaBundle.videoStoryboardSpecs,
        labDefinitionSpecs: mediaBundle.labDefinitionSpecs,
        mediaGenerationStatus: mediaBundle.mediaGenerationStatus,
        mediaGenerationErrors: mediaBundle.mediaGenerationErrors,
        pseudoLabs: mediaBundle.pseudoLabs,
        simulationDefinitions: mediaBundle.simulationDefinitions,
        threeDLabDefinitions: mediaBundle.threeDLabDefinitions,
      };
    }

    const payloadStr = JSON.stringify(enrichedPayload);
    const hash = createHash("sha256").update(payloadStr).digest("hex").slice(0, 40);

    // Use the DB-level status column for the approval workflow
    const writersEnabled = provenanceWritersEnabled();
    const dbStatus = approvalStatus === "APPROVED" && !writersEnabled ? "published" : "pending_approval";

    // Upsert into CurriculumContent
    const prompt = mode === "lesson" ? getPrompt("lesson.deep") : null;
    const write = await upsertCurriculumContent(
      { contentId },
      {
        contentId,
        title: typeof (enrichedPayload as any).title === "string" ? (enrichedPayload as any).title : null,
        grade,
        subject,
        contentType,
        status: dbStatus,
        version: new Date().toISOString().slice(0, 10),
        payload: enrichedPayload as any,
        moeAlignments: (enrichedPayload as any).moeAlignments ?? [],
        hash,
      },
      {
        title: typeof (enrichedPayload as any).title === "string" ? (enrichedPayload as any).title : null,
        grade,
        subject,
        payload: enrichedPayload as any,
        moeAlignments: (enrichedPayload as any).moeAlignments ?? [],
        hash,
        version: new Date().toISOString().slice(0, 10),
        status: dbStatus,
        contentType,
      },
      {
        revisionKind: mode === "lesson" ? "ORIGINAL_GENERATION" : "DETERMINISTIC_ENRICHMENT",
        originKind: mode === "lesson" ? "AI_GENERATED" : "DETERMINISTIC_GENERATED",
        actorUserId: user.id,
        ...(prompt
          ? {
              generatorName: "generateCurriculumPayload",
              generatorVersion: "1.0.0",
              aiProvider: "openai",
              aiModel: String((enrichedPayload as any).metadata?.model ?? "unknown"),
              generatedAt: new Date(String((enrichedPayload as any).metadata?.generatedAt ?? new Date().toISOString())),
              generationCorrelationId,
              primaryPromptKey: prompt.key,
              primaryPromptVersion: prompt.version,
              primaryPromptHash: prompt.hash,
            }
          : { generatorName: `generate${mode}`, generatorVersion: "1.0.0" }),
        requestedCompleteness: "VERIFIED",
        auditAction: "curriculum.revision.generated",
        auditDetails: { mode },
        idempotencyKey: `curriculum-generate:${contentId}:${traceId}`,
        schoolId: user.schoolId ?? null,
        traceId,
      },
    );
    let record = write.content;
    if (writersEnabled) {
      await appendCurriculumGovernanceEvent({
        contentId,
        revisionId: write.revision?.id,
        eventType: approvalStatus === "APPROVED" ? "APPROVED" : "SUBMITTED",
        actorType: "USER",
        actorUserId: user.id,
        ...(approvalStatus === "APPROVED"
          ? {
              approvalBasis: user.role === "ADMIN" ? "HUMAN_REVIEW" as const : "SCHOOL_POLICY" as const,
              reviewAuthority: user.role === "ADMIN" ? "PLATFORM" as const : "SCHOOL" as const,
            }
          : {}),
        reviewerRoleSnapshot: user.role,
        ...(approvalStatus === "APPROVED" && user.role === "ADMIN"
          ? {
              reviewerQualificationRef: `platform-admin:${user.id}`,
              reviewerQualificationSnapshot: {
                schemaVersion: 1,
                basis: "PLATFORM_ADMIN_ROLE",
                userId: user.id,
                role: user.role,
              },
            }
          : {}),
        idempotencyKey: `curriculum-generate-governance:${contentId}:${traceId}`,
        schoolId: user.schoolId ?? null,
        traceId,
      });
      record = await prisma.curriculumContent.findUniqueOrThrow({ where: { contentId } });
    }

    if (mode === "lesson" && labs.length > 0) {
      await syncVirtualLabs({
        labs,
        subject,
        grade,
        topic,
        contentId: record.contentId,
        schoolId: user.schoolId,
        moeAlignmentCodes: (enrichedPayload as any).moeAlignments ?? moeAlignmentCodes,
        approvalStatus,
      });
    }

    if (mode === "lesson") {
      await enqueueCourseThumbnailGeneration({
        contentId: record.contentId,
        actorUserId: user.id,
        schoolId: user.schoolId ?? null,
      }).catch((error) => logger.warn("[CANVA] course thumbnail enqueue failed", { error }));
    }

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
            logger.warn("[RAG] Best-effort curriculum chunk sync failed", { error: syncError });
          }
          try {
            await embedLesson(record.id);
          } catch (embeddingError) {
            logger.warn("[RAG] Best-effort curriculum embedding failed", { error: embeddingError });
          }
        }
      } else {
        try {
          await syncCurriculumContentRagChunks(record.id);
        } catch (syncError) {
          logger.warn("[RAG] Best-effort curriculum chunk sync failed", { error: syncError });
        }
        try {
          await embedLesson(record.id);
        } catch (embeddingError) {
          logger.warn("[RAG] Best-effort curriculum embedding failed", { error: embeddingError });
        }
      }
    }

    await logAudit({
      userId: user.id,
      action: `curriculum.generate.${mode}`,
      resourceType: "curriculum",
      resourceId: record.contentId,
      details: { grade, subject, topic, mode, approvalStatus },
    });

    return NextResponse.json(
      {
        ok: true,
        contentId: record.contentId,
        recordId: record.id,
        mode,
        approvalStatus,
        labsCount: labs.length,
        payloadPreview: {
          title: (enrichedPayload as any).title,
          objectivesCount: ((enrichedPayload as any).objectives ?? []).length,
        },
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (err: any) {
    logger.error("Curriculum generate route failed", {
      route: "/api/admin/curriculum/generate",
      errorMessage: err?.message ?? String(err),
      status: err?.status ?? 500,
    });
    return NextResponse.json(
      { error: err?.message ?? "Failed to generate curriculum" },
      { status: err?.status ?? 500 }
    );
  }
}
