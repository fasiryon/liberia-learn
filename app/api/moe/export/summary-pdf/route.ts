import { NextResponse } from "next/server";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { prisma } from "@/lib/db";
import { requireMoeExportUser } from "@/lib/moe/exportUtils";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  if (!isMoePortalEnabled()) {
    return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
  }

  try {
    const user = await requireMoeExportUser();
    assertPermission(user, PERMISSIONS.GOVERNANCE_EXPORT_MOE);
    const generatedAt = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalSchools,
      totalStudents,
      activeThisMonth,
      examAttempts,
      lessonsDelivered,
      interventionsTriggered,
      schools,
      students,
      guardianLinks,
    ] = await Promise.all([
      prisma.school.count(),
      prisma.student.count(),
      prisma.auditLog.findMany({
        where: {
          action: "lesson_view",
          createdAt: { gte: thirtyDaysAgo },
          user: { role: "STUDENT" },
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.examAttempt.findMany({
        where: { submittedAt: { not: null } },
        select: { score: true },
      }),
      prisma.studentProgress.count({ where: { completedAt: { not: null } } }),
      prisma.interventionRecommendation.count(),
      prisma.school.findMany({
        select: {
          id: true,
          district: true,
        },
      }),
      prisma.student.findMany({
        select: {
          id: true,
          user: {
            select: {
              schoolId: true,
            },
          },
        },
      }),
      prisma.studentGuardian.findMany({
        select: {
          studentId: true,
          student: {
            select: {
              user: {
                select: {
                  schoolId: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const avgExamScore =
      examAttempts.length > 0
        ? Math.round(
            (examAttempts.reduce((sum, attempt) => sum + attempt.score, 0) /
              examAttempts.length) *
              10000
          ) / 100
        : 0;

    const districtBySchoolId = new Map(
      schools.map((school) => [school.id, school.district ?? "Unassigned"])
    );
    const districtEngagement = new Map<
      string,
      { studentIds: Set<string>; guardianLinkedStudentIds: Set<string> }
    >();

    for (const student of students) {
      const districtName =
        districtBySchoolId.get(student.user.schoolId ?? "") ?? "Unassigned";
      const bucket =
        districtEngagement.get(districtName) ??
        { studentIds: new Set<string>(), guardianLinkedStudentIds: new Set<string>() };
      bucket.studentIds.add(student.id);
      districtEngagement.set(districtName, bucket);
    }

    for (const link of guardianLinks) {
      const districtName =
        districtBySchoolId.get(link.student.user.schoolId ?? "") ?? "Unassigned";
      const bucket =
        districtEngagement.get(districtName) ??
        { studentIds: new Set<string>(), guardianLinkedStudentIds: new Set<string>() };
      bucket.guardianLinkedStudentIds.add(link.studentId);
      districtEngagement.set(districtName, bucket);
    }

    const topDistricts = Array.from(districtEngagement.entries())
      .map(([districtName, value]) => ({
        districtName,
        engagementPct:
          value.studentIds.size > 0
            ? Math.round(
                (value.guardianLinkedStudentIds.size / value.studentIds.size) * 10000
              ) / 100
            : 0,
      }))
      .sort((left, right) => right.engagementPct - left.engagementPct)
      .slice(0, 5);

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>National Education Platform Summary Report</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
      .page { max-width: 960px; margin: 0 auto; padding: 32px 24px 48px; }
      .header { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
      .logo { width: 72px; height: 72px; border-radius: 20px; background: #dbeafe; color: #1d4ed8; display: flex; align-items: center; justify-content: center; font-weight: 700; }
      h1 { font-size: 30px; margin: 16px 0 6px; }
      .meta { color: #475569; font-size: 14px; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 28px; }
      .card { background: white; border: 1px solid #cbd5e1; border-radius: 18px; padding: 18px; }
      .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
      .value { margin-top: 10px; font-size: 28px; font-weight: 700; color: #111827; }
      .chart { margin-top: 32px; background: white; border: 1px solid #cbd5e1; border-radius: 18px; padding: 20px; }
      .bar-row { display: grid; grid-template-columns: 180px 1fr 64px; align-items: center; gap: 12px; margin-top: 12px; }
      .bar-track { height: 14px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
      .bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #10b981, #0ea5e9); }
      .footer { margin-top: 40px; font-size: 13px; color: #475569; text-align: center; }
      @media print { body { background: white; } .page { padding: 20px 12px 24px; } }
      @media (max-width: 720px) { .grid { grid-template-columns: 1fr 1fr; } .bar-row { grid-template-columns: 120px 1fr 52px; } }
    </style>
    <script>window.onload = () => window.print()</script>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <div>
          <div class="meta">LiberiaLearn</div>
          <h1>National Education Platform Summary Report</h1>
          <div class="meta">Date generated: ${escapeHtml(generatedAt.toISOString())}</div>
        </div>
        <div class="logo">MOE</div>
      </div>

      <div class="grid">
        <div class="card"><div class="label">Total Schools</div><div class="value">${totalSchools}</div></div>
        <div class="card"><div class="label">Total Students</div><div class="value">${totalStudents}</div></div>
        <div class="card"><div class="label">Active This Month</div><div class="value">${activeThisMonth.length}</div></div>
        <div class="card"><div class="label">Avg Exam Score</div><div class="value">${avgExamScore}%</div></div>
        <div class="card"><div class="label">Lessons Delivered</div><div class="value">${lessonsDelivered}</div></div>
        <div class="card"><div class="label">Interventions Triggered</div><div class="value">${interventionsTriggered}</div></div>
      </div>

      <div class="chart">
        <div class="label">Top-5 District Engagement</div>
        ${topDistricts
          .map(
            (district) => `<div class="bar-row">
              <div>${escapeHtml(district.districtName)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${district.engagementPct}%"></div></div>
              <div>${district.engagementPct}%</div>
            </div>`
          )
          .join("")}
      </div>

      <div class="footer">Generated by LiberiaLearn - Ministry of Education, Liberia</div>
    </div>
  </body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Summary export failed" },
      { status: err?.status ?? 500 }
    );
  }
}
