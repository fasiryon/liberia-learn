// route-policy: auth=session; scope=record; authority=self; rationale=a signed-in teacher changes only their own password after re-entering the current one; revokes their earlier sessions; refused on any deployed Preview/staging after authority and before body or data work (PREVIEW_IDENTITY_FROZEN)
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { advanceSecurityStamp } from "@/lib/auth/sessionRevocation";
import { logAudit } from "@/lib/audit";
import { previewIdentityFrozen } from "@/lib/preview/identityFreeze";
import { previewSafeErrorResponse } from "@/lib/preview/safeError";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function PATCH(req: Request) {
  try {
    const teacher = await requireRole("TEACHER");

    const frozen = previewIdentityFrozen();
    if (frozen) return frozen;
    const body = await req.json().catch(() => null);
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: teacher.id },
      select: { hashedPwd: true },
    });

    if (!user?.hashedPwd) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentPassword, user.hashedPwd);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const hashedPwd = await bcrypt.hash(newPassword, 10);

    // Revokes every session authenticated before this change, including the current one: the client signs in again.
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: teacher.id }, data: { hashedPwd, mustChangePIN: false } });
      await advanceSecurityStamp(tx, teacher.id); // compare-and-set; a concurrent change makes this 409
    });

    void logAudit({
      userId: teacher.id,
      schoolId: teacher.schoolId ?? undefined,
      action: "teacher.password_changed",
      resourceType: "user",
      resourceId: teacher.id,
    });

    return NextResponse.json({ ok: true, reauthenticate: true });
  } catch (err: any) {
    const safe = previewSafeErrorResponse(err);
    if (safe) return safe;
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}
