// route-policy: auth=session; scope=tenant; authority=student-teacher-admin-role-with-school-scope; rationale=curriculum listing is restricted to platform content plus the caller's school, and learners receive only a learner-safe summary of APPROVED content
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { buildCurriculumDisplayTitle } from "@/lib/curriculum/title";
import { projectStudentCurriculumSummary } from "@/lib/curriculum/studentLessonProjection";

export const dynamic = "force-dynamic";

function audioStatusOf(row: { version: string; audioAssets: Array<{ status: string; contentVersion: string | null }> }): string {
  return row.audioAssets[0]?.contentVersion === row.version
    ? row.audioAssets[0]?.status ?? "NOT_GENERATED"
    : row.audioAssets[0]?.status === "GENERATED"
      ? "STALE"
      : row.audioAssets[0]?.status ?? "NOT_GENERATED";
}

// GET /api/curriculum?grade=5&subject=MATH
export async function GET(req: Request) {
  try {
    const user = await requireRole("STUDENT", "TEACHER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const gradeParam = searchParams.get("grade");
    const subject = searchParams.get("subject");
    const takeParam = searchParams.get("take");

    const grade = gradeParam ? Number(gradeParam) : undefined;
    const limitParam = searchParams.get("limit");
    const take = Math.min(100, Math.max(1, limitParam ? Number(limitParam) || 50 : takeParam ? Number(takeParam) || 50 : 50));
    const isStudent = user.role === "STUDENT";

    const statusFilter = isStudent
      ? { in: ["published", "APPROVED"] }
      : { in: ["published", "APPROVED", "pending_approval", "rejected"] };

    // Tenant scope: platform content plus the caller's own school, as on the detail route.
    const tenantScope = user.isPlatformAdmin
      ? {}
      : { OR: [{ schoolId: null }, ...(user.schoolId ? [{ schoolId: user.schoolId }] : [])] };
    // Learners only see content whose governed lifecycle (when it has one) is APPROVED: a revoked,
    // superseded or re-opened revision never appears in a learner listing even if the legacy status lags.
    const learnerLifecycle = isStudent
      ? { OR: [{ provenance: { is: null } }, { provenance: { is: { lifecycleState: "APPROVED" as const } } }] }
      : {};

    const rows = await prisma.curriculumContent.findMany({
      where: {
        status: statusFilter,
        ...(typeof grade === "number" && !Number.isNaN(grade) ? { grade } : {}),
        ...(subject ? { subject } : {}),
        AND: [tenantScope, learnerLifecycle],
      },
      orderBy: { updatedAt: "desc" },
      take,
      select: {
        id: true,
        contentId: true,
        title: true,
        grade: true,
        subject: true,
        contentType: true,
        status: true,
        version: true,
        payload: true,
        audioAssets: {
          orderBy: { generatedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            contentVersion: true,
            storageUrl: true,
            estimatedCostUsd: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (isStudent) {
      // Learner-safe summary only: the stored payload (answers, teacher notes, rubrics) never leaves the server.
      return NextResponse.json({
        count: rows.length,
        items: rows.map((row) => projectStudentCurriculumSummary({
          contentId: row.contentId,
          title: row.title,
          grade: row.grade,
          subject: row.subject,
          contentType: row.contentType,
          version: row.version,
          updatedAt: row.updatedAt,
          audioStatus: audioStatusOf(row),
          displayTitle: buildCurriculumDisplayTitle({ title: row.title, subject: row.subject, gradeLevel: row.grade, payload: row.payload }),
        })),
      });
    }

    return NextResponse.json({
      count: rows.length,
      items: rows.map((row) => ({
        ...row,
        audioStatus: audioStatusOf(row),
        displayTitle: buildCurriculumDisplayTitle({
          title: row.title,
          subject: row.subject,
          gradeLevel: row.grade,
          payload: row.payload,
        }),
      })),
    });
  } catch (e: any) {
    console.error("GET /api/curriculum failed:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
