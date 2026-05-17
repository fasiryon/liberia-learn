import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("TEACHER");
    const pref = await prisma.teacherAlertPreference.findUnique({
      where: { teacherId: user.id },
      select: {
        alertLowGrade: true,
        alertInactive: true,
        alertNewSubmission: true,
        alertGuardianMessage: true,
        dailyDigest: true,
        digestHour: true,
      },
    });
    return NextResponse.json(
      pref ?? {
        alertLowGrade: true,
        alertInactive: true,
        alertNewSubmission: true,
        alertGuardianMessage: true,
        dailyDigest: false,
        digestHour: 7,
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER");
    const body = await req.json();

    const data: Record<string, boolean | number> = {};
    if (typeof body.alertLowGrade === "boolean") data.alertLowGrade = body.alertLowGrade;
    if (typeof body.alertInactive === "boolean") data.alertInactive = body.alertInactive;
    if (typeof body.alertNewSubmission === "boolean") data.alertNewSubmission = body.alertNewSubmission;
    if (typeof body.alertGuardianMessage === "boolean") data.alertGuardianMessage = body.alertGuardianMessage;
    if (typeof body.dailyDigest === "boolean") data.dailyDigest = body.dailyDigest;
    if (typeof body.digestHour === "number" && body.digestHour >= 0 && body.digestHour <= 23) {
      data.digestHour = body.digestHour;
    }

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const updated = await prisma.teacherAlertPreference.upsert({
      where: { teacherId: user.id },
      update: data,
      create: {
        teacherId: user.id,
        alertLowGrade: true,
        alertInactive: true,
        alertNewSubmission: true,
        alertGuardianMessage: true,
        dailyDigest: false,
        digestHour: 7,
        ...data,
      },
      select: {
        alertLowGrade: true,
        alertInactive: true,
        alertNewSubmission: true,
        alertGuardianMessage: true,
        dailyDigest: true,
        digestHour: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}
