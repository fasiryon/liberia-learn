import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const Schema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = Schema.parse(body);

    const invite = await prisma.inviteToken.findUnique({
      where: { token: parsed.token, usedAt: null },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invalid or already used invite link" }, { status: 400 });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite link has expired" }, { status: 400 });
    }

    if (invite.usedAt) {
      return NextResponse.json({ error: "Invite link has already been used" }, { status: 400 });
    }

    const hashedPwd = await bcrypt.hash(parsed.password, 12);

    const role = invite.role as "TEACHER" | "STUDENT" | "GUARDIAN" | "ADMIN";

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: parsed.name,
          email: invite.email!,
          hashedPwd,
          role,
          schoolId: invite.schoolId,
        },
      });

      if (role === "STUDENT") {
        await tx.student.create({
          data: { userId: newUser.id },
        });
      }

      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });

      return newUser;
    });

    return NextResponse.json({ ok: true, role: result.role });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status }
    );
  }
}

