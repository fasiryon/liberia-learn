import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { listStudentTranscriptsForUser } from "@/lib/records/systemOfRecord";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("STUDENT");
    const transcripts = await listStudentTranscriptsForUser(user.id);
    return NextResponse.json({ transcripts });
  } catch (error) {
    return handleApiError(error, { route: "/api/student/transcript", method: "GET" });
  }
}
