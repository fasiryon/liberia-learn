import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { resolveAdminSchoolScope } from "@/lib/records/systemOfRecord";
import { promoteStudents } from "@/lib/academics/promotion";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  schoolId: z.string().trim().min(1).optional(),
  studentIds: z.array(z.string().trim().min(1)).min(1),
  sourceAcademicYearId: z.string().trim().min(1),
  targetAcademicYearId: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const body = bodySchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, body.schoolId);

    const result = await promoteStudents(
      schoolId,
      body.sourceAcademicYearId,
      body.targetAcademicYearId,
      body.studentIds,
      user.id
    );

    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/promotions/promote", method: "POST" });
  }
}
