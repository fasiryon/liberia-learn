// route-policy: auth=session; scope=record; authority=self; rationale=a signed-in student changes only their own PIN (account id from the session, never the request); revokes their earlier sessions
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { advanceSecurityStamp } from "@/lib/auth/sessionRevocation";

const ChangePinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
  confirmPin: z.string().regex(/^\d{4,6}$/),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("STUDENT");
    const body = await req.json().catch(() => null);
    const parsed = ChangePinSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "PIN must be 4 to 6 digits." }, { status: 400 });
    }

    if (parsed.data.pin !== parsed.data.confirmPin) {
      return NextResponse.json({ error: "PIN entries do not match." }, { status: 400 });
    }

    const [student, hashedPwd] = await Promise.all([
      prisma.student.findFirst({
        where: { userId: user.id },
        select: {
          id: true,
          placementTests: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      bcrypt.hash(parsed.data.pin, 10),
    ]);

    if (!student) {
      return NextResponse.json({ error: "Student record not found." }, { status: 404 });
    }

    // A PIN is the student's password: revoke every session authenticated before this change, including the current
    // one (the client signs in again with the new PIN).
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { hashedPwd, mustChangePIN: false } });
      await advanceSecurityStamp(tx, user.id); // compare-and-set; a concurrent change makes this 409
    });

    const nextPath = student.placementTests.length > 0 ? "/dashboard" : "/student/placement";

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId ?? null,
      action: "student.pin.changed",
      resourceType: "user",
      resourceId: user.id,
      details: {
        nextPath,
      },
    });

    return NextResponse.json({ ok: true, nextPath, reauthenticate: true }, { status: 200 });
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403 || err?.status === 409) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to update PIN." }, { status: 500 });
  }
}
