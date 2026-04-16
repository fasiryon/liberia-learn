import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { approveSchoolEnrollment, rejectSchoolEnrollment } from "@/lib/school-operations";

export const dynamic = "force-dynamic";

const ActionSchema = z.object({
  schoolId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
});

async function requirePlatformAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN" || !user.isPlatformAdmin) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return user;
}

export async function GET() {
  try {
    await requirePlatformAdmin();
    const schools = await prisma.school.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        county: true,
        district: true,
        schoolType: true,
        estimatedEnrollment: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ ok: true, schools });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePlatformAdmin();
    const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.action === "approve") {
      const result = await approveSchoolEnrollment(user.id, parsed.data.schoolId);
      return NextResponse.json({ ok: true, ...result });
    }

    await rejectSchoolEnrollment(user.id, parsed.data.schoolId, parsed.data.reason);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}
