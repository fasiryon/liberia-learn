import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { answerGroundedQuestion } from "@/lib/ai/rag/groundedAnswerService";
import { getAssistantRoleConfig, resolveAllowedMode } from "@/lib/ai/rag/assistantAccess";
import { resolveAssistantAudienceScope } from "@/lib/ai/rag/audienceScope";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isRagTutorEnabled } from "@/lib/serverFlags";
import type {
  RetrievalContext,
  RetrievalContextMode,
  RetrievalMode,
} from "@/lib/ai/rag/retrievalService";

const RouteContextModeSchema = z.enum([
  "governance",
  "lesson",
  "homework",
  "learning",
  "support",
  "mixed",
]);

const RequestSchema = z.object({
  question: z.string().trim().min(8).max(1200),
  subject: z.string().trim().min(1).max(100).optional(),
  grade: z.number().int().min(1).max(12).optional(),
  gradeLevel: z.union([z.string().trim().min(1).max(32), z.number().int()]).optional(),
  pathname: z.string().trim().min(1).max(200).optional(),
  role: z
    .enum(["ADMIN", "TEACHER", "STUDENT", "GUARDIAN", "MOE_OFFICIAL"])
    .optional(),
  mode: z.union([z.enum(["classroom", "policy", "mixed"]), RouteContextModeSchema]).optional(),
  retrievalMode: z.enum(["classroom", "policy", "mixed"]).optional(),
});

function inferModeFromPath(
  pathname: string | undefined,
  role: Awaited<ReturnType<typeof requireUser>>["role"]
): RetrievalContextMode {
  const normalizedPath = pathname?.toLowerCase() ?? "";

  if (normalizedPath.startsWith("/teacher/homework")) {
    return "homework";
  }

  if (normalizedPath.startsWith("/teacher/curriculum")) {
    return "lesson";
  }

  if (normalizedPath.startsWith("/teacher")) {
    return "mixed";
  }

  if (normalizedPath.startsWith("/student")) {
    return "learning";
  }

  if (normalizedPath.startsWith("/guardian")) {
    return "support";
  }

  if (
    normalizedPath.startsWith("/admin") ||
    normalizedPath.startsWith("/moe") ||
    role === "ADMIN" ||
    role === "MOE_OFFICIAL"
  ) {
    return "governance";
  }

  return "mixed";
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();

  try {
    if (!isRagTutorEnabled()) {
      return NextResponse.json({ error: "rag_disabled" }, { status: 404 });
    }

    const user = await requireUser();
    const roleConfig = getAssistantRoleConfig(user.role);
    if (!roleConfig) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (!user.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const body = RequestSchema.parse(await req.json());
    const audienceScope = await resolveAssistantAudienceScope(user, {
      subject: body.subject ?? null,
      grade: body.grade ?? null,
      gradeLevel: body.gradeLevel ?? null,
      invalidSubjectBehavior: "fallback",
    });
    const effectiveRole = body.role ?? roleConfig.role;
    const requestedRetrievalMode =
      body.retrievalMode ??
      (body.mode === "classroom" || body.mode === "policy" || body.mode === "mixed"
        ? body.mode
        : null);
    const effectiveMode = resolveAllowedMode(
      user.role,
      (requestedRetrievalMode as RetrievalMode | null) ?? null
    );
    const contextMode =
      body.mode === "governance" ||
      body.mode === "lesson" ||
      body.mode === "homework" ||
      body.mode === "learning" ||
      body.mode === "support"
        ? body.mode
        : inferModeFromPath(body.pathname, effectiveRole);
    if (!effectiveMode) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const retrievalContext: RetrievalContext = {
      role: effectiveRole,
      mode: contextMode,
      subject: audienceScope.subject,
      gradeLevel:
        audienceScope.gradeLevel ??
        (typeof body.gradeLevel === "number" ? String(body.gradeLevel) : body.gradeLevel ?? null),
    };

    const result = await answerGroundedQuestion({
      question: body.question,
      schoolId: user.schoolId,
      subject: audienceScope.subject,
      grade: audienceScope.grade,
      allowedSubjects: audienceScope.allowedSubjects,
      allowedGrades: audienceScope.allowedGrades,
      mode: effectiveMode,
      role: user.role,
      context: retrievalContext,
    });

    await logAudit({
      userId: user.id,
      action: "ai.rag.query.requested",
      resourceType: "rag_query",
      schoolId: user.schoolId,
      traceId,
      details: {
        subject: audienceScope.subject,
        grade: audienceScope.grade,
        mode: effectiveMode,
        contextMode,
        sourceCount: result.sources.length,
        retrievalWeak: result.retrievalWeak,
      },
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to answer query" },
      { status: error?.status ?? 500 }
    );
  }
}
