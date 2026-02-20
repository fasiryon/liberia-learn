import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const GradeBandEnum = z.enum(["G1_3", "G4_6", "G7_9", "G10_12"]);
const SubjectEnum = z.enum([
  "MATH",
  "SCIENCE",
  "COMPUTER_SCIENCE",
  "ENGINEERING",
  "LITERACY",
  "CIVICS",
  "ARTS",
  "PE",
  "CAREER",
]);

const Schema = z.object({
  schoolId: z.string().min(1).optional(),
  fullName: z.string().min(2).optional(),
  phone: z.string().min(5).optional().nullable(),
  gradesTaught: z.array(GradeBandEnum).optional(),
  subjectsTaught: z.array(SubjectEnum).optional(),
  complete: z.boolean().optional(),
});

function diffValues(before: any, after: any, fields: string[]) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of fields) {
    const b = before?.[field];
    const a = after?.[field];
    const same = Array.isArray(b) || Array.isArray(a)
      ? JSON.stringify(b ?? []) === JSON.stringify(a ?? [])
      : (b ?? null) === (a ?? null);
    if (!same) {
      changes[field] = { from: b ?? null, to: a ?? null };
    }
  }
  return changes;
}

export async function GET() {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
    });

    const school = user.schoolId
      ? await prisma.school.findUnique({
          where: { id: user.schoolId },
          select: { id: true, name: true, county: true },
        })
      : null;

    const schools: { id: string; name: string; county: string | null }[] = [];

    return NextResponse.json({
      user: { id: user.id, schoolId: user.schoolId ?? null },
      profile,
      school,
      schools,
      schoolAssignmentRequired: !user.schoolId,
      options: {
        grades: GradeBandEnum.options,
        subjects: SubjectEnum.options,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    if (body?.userId && body.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = Schema.parse(body);
    const existingProfile = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
    });

    const existingSchoolId = user.schoolId ?? existingProfile?.schoolId ?? null;
    const targetSchoolId = existingSchoolId ?? parsed.schoolId ?? null;

    if (!existingSchoolId && parsed.schoolId) {
      return NextResponse.json({ error: "School assignment required" }, { status: 403 });
    }

    if (existingSchoolId && parsed.schoolId && parsed.schoolId !== existingSchoolId) {
      return NextResponse.json({ error: "School cannot be changed" }, { status: 403 });
    }

    if (!targetSchoolId) {
      return NextResponse.json({ error: "schoolId is required" }, { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { id: targetSchoolId },
      select: { id: true },
    });
    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    if (!existingProfile && !parsed.fullName) {
      return NextResponse.json({ error: "fullName is required" }, { status: 400 });
    }

    const updateData: any = {
      schoolId: targetSchoolId,
    };
    if (parsed.fullName !== undefined) updateData.fullName = parsed.fullName.trim();
    if (parsed.phone !== undefined) updateData.phone = parsed.phone?.trim() || null;
    if (parsed.gradesTaught) updateData.gradesTaught = parsed.gradesTaught;
    if (parsed.subjectsTaught) updateData.subjectsTaught = parsed.subjectsTaught;

    const finalProfile = {
      fullName: updateData.fullName ?? existingProfile?.fullName ?? null,
      phone: updateData.phone ?? existingProfile?.phone ?? null,
      gradesTaught: updateData.gradesTaught ?? existingProfile?.gradesTaught ?? [],
      subjectsTaught: updateData.subjectsTaught ?? existingProfile?.subjectsTaught ?? [],
      schoolId: targetSchoolId,
      isOnboarded: existingProfile?.isOnboarded ?? false,
    };

    const wantsComplete = parsed.complete === true;
    if (wantsComplete) {
      if (!finalProfile.fullName) {
        return NextResponse.json({ error: "fullName is required" }, { status: 400 });
      }
      if (!finalProfile.gradesTaught?.length) {
        return NextResponse.json({ error: "gradesTaught is required" }, { status: 400 });
      }
      if (!finalProfile.subjectsTaught?.length) {
        return NextResponse.json({ error: "subjectsTaught is required" }, { status: 400 });
      }
      if (!existingProfile?.isOnboarded) {
        updateData.isOnboarded = true;
        updateData.onboardedAt = new Date();
      }
    }

    const profile = await prisma.$transaction(async (tx) => {
      if (!user.schoolId) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            schoolId: targetSchoolId,
            ...(updateData.fullName ? { name: updateData.fullName } : {}),
          },
        });
      } else if (updateData.fullName) {
        await tx.user.update({
          where: { id: user.id },
          data: { name: updateData.fullName },
        });
      }

      return tx.teacherProfile.upsert({
        where: { userId: user.id },
        update: updateData,
        create: {
          userId: user.id,
          schoolId: targetSchoolId,
          fullName: updateData.fullName ?? user.name ?? "Teacher",
          phone: updateData.phone ?? null,
          permissions: undefined,
          gradesTaught: updateData.gradesTaught ?? [],
          subjectsTaught: updateData.subjectsTaught ?? [],
          isOnboarded: updateData.isOnboarded ?? false,
          onboardedAt: updateData.onboardedAt ?? null,
        },
      });
    });

    const changes = diffValues(
      existingProfile ?? {},
      profile,
      ["schoolId", "fullName", "phone", "gradesTaught", "subjectsTaught", "isOnboarded", "onboardedAt"]
    );

    if (Object.keys(changes).length > 0) {
      await logAudit({
        userId: user.id,
        action: "teacher.onboarding.update",
        resourceType: "teacherProfile",
        resourceId: profile.id,
        details: {
          schoolId: targetSchoolId,
          changes,
        },
      });
    }

    if (wantsComplete && !existingProfile?.isOnboarded && profile.isOnboarded) {
      await logAudit({
        userId: user.id,
        action: "teacher.onboarding.complete",
        resourceType: "teacherProfile",
        resourceId: profile.id,
        details: {
          schoolId: targetSchoolId,
          onboardedAt: profile.onboardedAt?.toISOString() ?? null,
        },
      });
    }

    return NextResponse.json({ ok: true, profile });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
