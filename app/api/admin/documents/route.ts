import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireRole("ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { schoolId: user.schoolId! };
  if (type) where.type = type;
  if (status) where.status = status;

  const docs = await prisma.generatedDocument.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      student: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(docs);
}
