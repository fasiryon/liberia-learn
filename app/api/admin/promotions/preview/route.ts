import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { resolveAdminSchoolScope } from "@/lib/records/systemOfRecord";
import { previewPromotions } from "@/lib/academics/promotion";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const schoolId = resolveAdminSchoolScope(user, req.nextUrl.searchParams.get("schoolId"));
    const academicYearId = req.nextUrl.searchParams.get("academicYearId");
    if (!academicYearId) {
      throw Object.assign(new Error("academicYearId is required"), { status: 400 });
    }

    const candidates = await previewPromotions(schoolId, academicYearId);
    return NextResponse.json({ candidates });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/promotions/preview", method: "GET" });
  }
}
