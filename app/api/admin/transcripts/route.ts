import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  listTranscriptsForSchool,
  resolveAdminSchoolScope,
  upsertTranscriptForSchool,
  upsertTranscriptSchema,
} from "@/lib/records/systemOfRecord";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const schoolId = resolveAdminSchoolScope(user, req.nextUrl.searchParams.get("schoolId"));
    const studentId = req.nextUrl.searchParams.get("studentId");
    const transcripts = await listTranscriptsForSchool(schoolId, studentId);

    return NextResponse.json({ transcripts });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/transcripts", method: "GET" });
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const body = upsertTranscriptSchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, body.schoolId);
    const transcript = await upsertTranscriptForSchool(schoolId, body);

    await logAudit({
      userId: user.id,
      action: "admin.transcript.upserted",
      resourceType: "transcript",
      resourceId: transcript.id,
      schoolId,
      traceId: requestId,
      details: {
        studentId: transcript.studentId,
        academicYearId: transcript.academicYearId,
        grade: transcript.grade,
        hasSummary: Boolean(transcript.summary),
        gpa: transcript.gpa,
      },
    });

    return NextResponse.json({ transcript }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/transcripts", method: "POST" });
  }
}
