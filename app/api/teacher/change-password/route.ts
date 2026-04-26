import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function PATCH(req: Request) {
  try {
    const teacher = await requireRole("TEACHER");

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

    await prisma.user.update({
      where: { id: teacher.id },
      data: {
        hashedPwd,
        mustChangePIN: false,
        passwordChangedAt: new Date(),
      },
    });

    void logAudit({
      userId: teacher.id,
      schoolId: teacher.schoolId ?? undefined,
      action: "teacher.password_changed",
      resourceType: "user",
      resourceId: teacher.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}
