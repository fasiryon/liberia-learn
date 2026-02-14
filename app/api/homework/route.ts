import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

const QuerySchema = z.object({
  classId: z.string().min(10),
});

export async function GET(req: Request) {
  const { schoolId } = await requireTenant();

  const url = new URL(req.url);
  const classId = url.searchParams.get("classId");

  const parsed = QuerySchema.safeParse({ classId });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Missing/invalid classId" },
      { status: 400 }
    );
  }

  // Tenant verification: class must belong to this schoolId
  const cls = await prisma.class.findFirst({
    where: { id: parsed.data.classId, schoolId },
    select: { id: true },
  });

  if (!cls) {
    return NextResponse.json(
      { ok: false, error: "Class not found for tenant" },
      { status: 404 }
    );
  }

  const homework = await prisma.homework.findMany({
    where: { classId: parsed.data.classId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      classId: true,
      title: true,
      description: true,
      instructions: true,
      dueAt: true,
      createdAt: true,
      createdById: true,
    },
  });

  return NextResponse.json({ ok: true, homework });
}
