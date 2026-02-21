// app/api/admin/classes/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

// Must match prisma enum Subject exactly:
const SubjectEnum = z.enum([
  "MATH",
  "SCIENCE",
  "COMPUTER_SCIENCE",
  "ENGINEERING",
  "LITERACY",
  "CIVICS",
  "ARTS",
  "PE",
  "CAREER",
]);

const Schema = z.object({
  name: z.string().min(2).max(80),
  subject: SubjectEnum,
  teacherId: z.string().optional().nullable(),
});

export async function GET() {
  await requireRole("ADMIN");
  const { schoolId } = await requireTenant();

  const classes = await prisma.class.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, subject: true, teacherId: true, createdAt: true, schoolId: true },
  });

  return NextResponse.json({ ok: true, classes });
}

export async function POST(req: Request) {
  await requireRole("ADMIN");
  const { schoolId } = await requireTenant();

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { name, subject, teacherId } = parsed.data;

  const created = await prisma.class.create({
    data: {
      name,
      subject,                // enum value like "MATH"
      schoolId,               // scalar FK
      teacherId: teacherId ?? null, // now allowed since teacherId is optional
    },
    select: { id: true, name: true, subject: true, teacherId: true, schoolId: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, class: created }, { status: 201 });
}

