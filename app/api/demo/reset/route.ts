import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isProduction, isStaging } from "@/lib/environment";
import { seedNationalDemo, SCHOOL_DEFS } from "@/scripts/seed-demo";

function getDemoSchoolIdsFromEnv(): string[] {
  const raw = process.env.DEMO_SCHOOL_IDS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  try {
    if (isProduction() || isStaging()) {
      return NextResponse.json(
        { error: "Not available in this environment" },
        { status: 403 }
      );
    }

    // Require authenticated platform admin — removes plain-text secret dependency
    let actor;
    try {
      actor = await requireUser();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!actor.isPlatformAdmin) {
      return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
    }

    const schoolIds = getDemoSchoolIdsFromEnv();
    if (schoolIds.length === 0) {
      return NextResponse.json({ error: "DEMO_SCHOOL_IDS not configured" }, { status: 400 });
    }

    const validSchoolIds = new Set<string>(SCHOOL_DEFS.map((school) => school.id));
    const unknownSchoolIds = schoolIds.filter((schoolId) => !validSchoolIds.has(schoolId));
    if (unknownSchoolIds.length > 0) {
      return NextResponse.json(
        { error: `Unknown demo school IDs: ${unknownSchoolIds.join(", ")}` },
        { status: 400 }
      );
    }

    const demoStudents = await prisma.student.findMany({
      where: {
        user: {
          schoolId: { in: schoolIds },
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    const studentIds = demoStudents.map((student) => student.id);
    const userIds = demoStudents.map((student) => student.userId);

    await prisma.$transaction([
      prisma.attendanceRecord.deleteMany({
        where: {
          Meeting: {
            is: {
              Class: {
                is: {
                  schoolId: { in: schoolIds },
                },
              },
            },
          },
        },
      }),
      prisma.studentProgress.deleteMany({
        where: {
          studentId: { in: userIds.length ? userIds : ["__none__"] },
        },
      }),
      prisma.homeworkSubmission.deleteMany({
        where: {
          studentId: { in: studentIds.length ? studentIds : ["__none__"] },
        },
      }),
      prisma.placementTest.deleteMany({
        where: {
          studentId: { in: studentIds.length ? studentIds : ["__none__"] },
        },
      }),
      prisma.labSession.deleteMany({
        where: {
          schoolId: { in: schoolIds },
        },
      }),
      prisma.guardianMessage.deleteMany({
        where: {
          schoolId: { in: schoolIds },
        },
      }),
      prisma.sMSDeliveryLog.deleteMany({
        where: {
          schoolId: { in: schoolIds },
        },
      }),
      prisma.notificationLog.deleteMany({
        where: {
          user: {
            schoolId: { in: schoolIds },
          },
        },
      }),
      prisma.auditLog.deleteMany({
        where: {
          schoolId: { in: schoolIds },
        },
      }),
      prisma.scheduledWork.deleteMany({
        where: {
          class: {
            schoolId: { in: schoolIds },
          },
        },
      }),
    ]);

    await seedNationalDemo({
      prisma,
      schoolIds,
      allowExisting: true,
    });

    return NextResponse.json({
      success: true,
      message: "Demo data reset",
      resetAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Demo reset failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Demo reset failed" },
      { status: error?.status ?? 500 }
    );
  }
}
