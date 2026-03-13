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
import { createHash } from "crypto";
import { slugify, generateLabs, generateTermPlanPayload, generateUnitPlanPayload } from "@/lib/curriculum-helpers";
import { gradeToBand } from "@/lib/moe/alignment-engine";

// Rate limit: 10 requests per 5 minutes per userId
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 5 * 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

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

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait." },
        { status: 429 }
      );
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
    const payloadStr = JSON.stringify(enrichedPayload);
    const hash = createHash("sha256").update(payloadStr).digest("hex").slice(0, 40);

    // Use the DB-level status column for the approval workflow
    const dbStatus = approvalStatus === "APPROVED" ? "published" : "pending_approval";

    // Upsert into CurriculumContent
    const record = await prisma.curriculumContent.upsert({
      where: { contentId },
      update: {
        grade,
        subject,
        payload: enrichedPayload as any,
        moeAlignments: (enrichedPayload as any).moeAlignments ?? [],
        hash,
        version: new Date().toISOString().slice(0, 10),
        status: dbStatus,
        contentType,
      },
      create: {
        contentId,
        grade,
        subject,
        contentType,
        status: dbStatus,
        version: new Date().toISOString().slice(0, 10),
        payload: enrichedPayload as any,
        moeAlignments: (enrichedPayload as any).moeAlignments ?? [],
        hash,
      },
    });

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

    await logAudit({
      userId: user.id,
      action: `curriculum.generate.${mode}`,
      resourceType: "curriculum",
      resourceId: record.contentId,
      details: { grade, subject, topic, mode, approvalStatus },
    });

    return NextResponse.json({
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
    });
  } catch (err: any) {
    console.error("Curriculum generate error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to generate curriculum" },
      { status: err?.status ?? 500 }
    );
  }
}
