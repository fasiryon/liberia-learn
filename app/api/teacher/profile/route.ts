import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  mergeTeacherProfileSettings,
  readTeacherProfileSettings,
} from "@/lib/teacher/profileSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("TEACHER");
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
      select: {
        fullName: true,
        phone: true,
        permissions: true,
      },
    });

    const settings = readTeacherProfileSettings(profile?.permissions);
    return NextResponse.json({
      fullName: profile?.fullName ?? user.name ?? "",
      phone: profile?.phone ?? "",
      bio: settings.bio ?? "",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to load teacher profile" },
      { status: err?.status ?? 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireRole("TEACHER");
    const body = await req.json().catch(() => null);
    const bio =
      typeof body?.bio === "string" ? body.bio.trim().slice(0, 600) : null;

    if (!bio) {
      return NextResponse.json(
        { error: "Bio is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        schoolId: true,
        fullName: true,
        permissions: true,
      },
    });

    const data = {
      fullName: existing?.fullName ?? user.name ?? "Teacher",
      schoolId: existing?.schoolId ?? user.schoolId ?? "",
      permissions: mergeTeacherProfileSettings(existing?.permissions, { bio }),
    };

    if (!data.schoolId) {
      return NextResponse.json(
        { error: "Teacher school is missing" },
        { status: 400 }
      );
    }

    await prisma.teacherProfile.upsert({
      where: { userId: user.id },
      update: data,
      create: {
        id: existing?.id ?? user.id,
        fullName: data.fullName,
        permissions: data.permissions,
        updatedAt: new Date(),
        User: { connect: { id: user.id } },
        School: { connect: { id: data.schoolId } },
      },
    });

    void logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "teacher.profile.updated",
      resourceType: "teacher_profile",
      resourceId: user.id,
    });

    return NextResponse.json({ ok: true, bio });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to update teacher profile" },
      { status: err?.status ?? 500 }
    );
  }
}
