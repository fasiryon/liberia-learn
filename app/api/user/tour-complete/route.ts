import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH() {
  try {
    const user = await requireUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { tourCompletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}
