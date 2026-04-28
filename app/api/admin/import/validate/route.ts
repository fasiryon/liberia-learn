import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  validateStudentRows,
  validateTeacherRows,
  validateGuardianRows,
} from "@/lib/imports/schoolImportValidator";
import { resolveAdminSchoolScope } from "@/lib/records/systemOfRecord";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  importType: z.enum(["students", "teachers", "guardians"]),
  rows: z.array(z.record(z.string(), z.string())).min(1).max(500),
  schoolId: z.string().trim().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    const body = bodySchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, body.schoolId);

    let result;
    if (body.importType === "students") {
      result = await validateStudentRows(body.rows, schoolId);
    } else if (body.importType === "teachers") {
      result = await validateTeacherRows(body.rows, schoolId);
    } else {
      result = await validateGuardianRows(body.rows, schoolId);
    }

    return NextResponse.json({ result });
  } catch (err: any) {
    return handleApiError(err, { requestId: "", route: "/api/admin/import/validate", method: "POST" });
  }
}
