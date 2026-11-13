// route-policy: auth=session; scope=platform; authority=platform-admin-step-up; rationale=only a stepped-up platform ADMIN can delete the platform-wide Canva credential
import { NextResponse } from "next/server";
import { requireRole, requirePrivilegedStepUp } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE() {
  try {
    const user = await requireRole("ADMIN");
    if (user.isPlatformAdmin !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await requirePrivilegedStepUp(user);
    await prisma.canvaOAuthCredential.deleteMany({ where: { provider: "canva" } });
    return NextResponse.json({ disconnected: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: err.status ?? 500 }
    );
  }
}
