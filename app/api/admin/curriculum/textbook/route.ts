import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isTextbookCompilerEnabled } from "@/lib/serverFlags";
import { compileTextbook } from "@/lib/ai/textbook/textbookCompiler";
import { renderTextbookPdfStream } from "@/lib/ai/textbook/textbookPdf";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  subject: z.string().trim().min(1),
  gradeLevel: z.coerce.number().int().min(1).max(12),
  schoolId: z.string().trim().min(1).optional(),
});

function textbookCompilerDisabledResponse() {
  return NextResponse.json({ error: "textbook_compiler_disabled" }, { status: 503 });
}

async function requireAdminScope() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return user;
}

function resolveSchoolScope(user: Awaited<ReturnType<typeof requireUser>>, requested?: string) {
  if (user.isPlatformAdmin) {
    return requested ?? user.schoolId ?? undefined;
  }

  if (!user.schoolId) {
    throw Object.assign(new Error("No school context"), { status: 400 });
  }

  return user.schoolId;
}

export async function GET(req: NextRequest) {
  if (!isTextbookCompilerEnabled()) {
    return textbookCompilerDisabledResponse();
  }

  try {
    const traceId = randomUUID();
    const user = await requireAdminScope();
    const query = QuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams.entries())
    );
    const schoolId = resolveSchoolScope(user, query.schoolId);
    const result = await compileTextbook({
      subject: query.subject,
      gradeLevel: query.gradeLevel,
      schoolId,
    });

    if (result.units.length === 0) {
      return NextResponse.json(
        { error: "No units found. Assemble units first." },
        { status: 404 }
      );
    }

    const pdfStream = await renderTextbookPdfStream(result);

    await logAudit({
      userId: user.id,
      action: "admin.textbook.generated",
      resourceType: "textbook",
      schoolId: schoolId ?? null,
      traceId,
      details: {
        subject: result.subject,
        gradeLevel: result.gradeLevel,
        unitCount: result.units.length,
        totalLessons: result.totalLessons,
      },
    });

    const filename = `${result.subject.toLowerCase().replace(/_/g, "-")}-grade${result.gradeLevel}-textbook.pdf`;
    return new Response(pdfStream as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
