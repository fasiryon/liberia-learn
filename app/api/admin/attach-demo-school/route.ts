import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEMO_SCHOOL_ID = "demo-school-monrovia";

/**
 * POST /api/admin/attach-demo-school
 * Attaches the calling admin (and optionally other null-schoolId demo users)
 * to the demo school. Requires ADMIN role. Idempotent.
 */
export async function POST() {
  try {
    const user = await requireRole("ADMIN");

    const school = await prisma.school.findUnique({
      where: { id: DEMO_SCHOOL_ID },
      select: { id: true, name: true },
    });
    if (!school) {
      return NextResponse.json(
        { error: "Demo school not found. Run onboarding first." },
        { status: 404 }
      );
    }

    const logs: string[] = [];
    logs.push(`Demo school: ${school.name} (${school.id})`);

    // Attach calling user if their schoolId is null
    const callingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, schoolId: true },
    });

    if (callingUser && !callingUser.schoolId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { schoolId: DEMO_SCHOOL_ID },
      });
      logs.push(`Attached ${callingUser.email} to demo school`);
    } else if (callingUser?.schoolId === DEMO_SCHOOL_ID) {
      logs.push(`${callingUser.email} already on demo school`);
    } else {
      logs.push(`${callingUser?.email} has schoolId=${callingUser?.schoolId}, skipped`);
    }

    // Also attach other well-known demo users with null schoolId
    const demoEmails = [
      "admin@school.lr",
      "teacher@school.lr",
      "student@school.lr",
      "admin@liberialearn.lr",
    ];
    for (const email of demoEmails) {
      const u = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, schoolId: true },
      });
      if (u && !u.schoolId) {
        await prisma.user.update({
          where: { id: u.id },
          data: { schoolId: DEMO_SCHOOL_ID },
        });
        logs.push(`Attached ${email} to demo school`);
      }
    }

    return NextResponse.json({ ok: true, schoolId: DEMO_SCHOOL_ID, logs });
  } catch (err: any) {
    console.error("Attach demo school error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}

