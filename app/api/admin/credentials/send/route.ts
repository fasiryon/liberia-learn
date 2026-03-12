import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendCredentialSms } from "@/lib/credentials";

const Schema = z.object({
  userId: z.string().min(1),
  pin: z.string().regex(/^\d{4,6}$/),
});

export async function POST(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    if (!admin.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { id: parsed.data.userId, schoolId: admin.schoolId, role: { in: ["STUDENT", "TEACHER"] } },
      select: {
        id: true,
        name: true,
        role: true,
        loginId: true,
        email: true,
        guardianPhoneE164: true,
        school: { select: { name: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.guardianPhoneE164) {
      return NextResponse.json({ error: "No phone number on file. Use Print instead." }, { status: 400 });
    }

    const result = await sendCredentialSms({
      to: user.guardianPhoneE164,
      schoolName: user.school?.name ?? "LiberiaLearn",
      name: user.name ?? user.email,
      loginId: user.loginId ?? user.email,
      pin: parsed.data.pin,
      role: user.role === "TEACHER" ? "Teacher" : "Student",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "SMS failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, phone: user.guardianPhoneE164 });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}

