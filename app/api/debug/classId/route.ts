// app/api/debug/classId/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export async function GET() {
  const { schoolId } = await requireTenant();

  const cls = await prisma.class.findFirst({
    where: { schoolId },
    select: { id: true, name: true, schoolId: true },
  });

  return NextResponse.json({ ok: true, class: cls ?? null });
}
