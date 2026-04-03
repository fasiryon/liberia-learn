import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { getRateLimitHeaders, rateLimitExceededResponse } from "@/lib/rateLimit";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { generateExamWithUsage } from "@/lib/exams/examGenerator";
import { isExamSystemEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

const ExamGenerationParamsSchema = z.object({
  subject: z.string().min(1),
  grade: z.number().int().min(1).max(12),
  moeStandards: z.array(z.string().min(1)).min(1),
  questionCount: z.number().int().min(5).max(100).optional(),
  timeLimit: z.number().int().min(10).max(240).optional(),
  title: z.string().min(3).max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("ADMIN", "TEACHER");
    if (!user.schoolId) {
      return NextResponse.json({ error: "No school context available" }, { status: 400 });
    }
    const rateLimit = await checkAiRateLimit({
      userId: user.id,
      role: user.role,
      endpoint: "/api/admin/exams/generate",
      schoolId: user.schoolId ?? undefined,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const params = ExamGenerationParamsSchema.parse(await req.json());
    const generated = await generateExamWithUsage(params, {
      route: "/api/admin/exams/generate",
      schoolId: user.schoolId ?? null,
      userId: user.id,
    });
    const exam = generated.exam;

    const record = await prisma.exam.create({
      data: {
        title: exam.title,
        subject: exam.subject,
        grade: exam.grade,
        schoolId: user.schoolId,
        createdBy: user.id,
        moeStandards: exam.moeStandards,
        timeLimit: exam.timeLimit,
        passingScore: exam.passingScore,
        questions: {
          create: exam.questions.map((question) => ({
            prompt: question.prompt,
            options: question.options,
            correctIndex: question.correctIndex,
            explanation: question.explanation,
            moeCode: question.moeCode,
            points: question.points,
          })),
        },
      },
      select: { id: true },
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "exam.generated",
      resourceType: "exam",
      resourceId: record.id,
      details: {
        subject: exam.subject,
        grade: exam.grade,
        questionCount: exam.questions.length,
        hadFallback: generated.hadFallback === true,
      },
    });

    return NextResponse.json({ examId: record.id, exam }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleApiError(error);
  }
}
