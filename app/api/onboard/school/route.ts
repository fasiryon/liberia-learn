// app/api/onboard/school/route.ts
// Creates a new school + the first ADMIN user in one transaction.
// No auth required (brand-new school onboarding).

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { z } from "zod";

const Schema = z.object({
  schoolName: z.string().min(3).max(100),
  timezone:   z.string().default("Africa/Monrovia"),
  adminName:  z.string().min(2).max(80),
  adminEmail: z.string().email(),
  password:   z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body   = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { schoolName, timezone, adminName, adminEmail, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashedPwd = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: { name: schoolName, timezone },
      });

      const admin = await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          role: "ADMIN",
          hashedPwd,
          schoolId: school.id, // requires User.schoolId in schema
        },
      });

      return { school, admin };
    });

    return NextResponse.json(
      {
        ok: true,
        schoolId: result.school.id,
        schoolName: result.school.name,
        adminId: result.admin.id,
        message: "School registered. Sign in to continue setup.",
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("School onboard error:", err);
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: 500 });
  }
}