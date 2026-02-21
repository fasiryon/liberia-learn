import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPasswordReset } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalised = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalised },
      select: { id: true, name: true, email: true },
    });

    // Always return ok to avoid leaking account existence
    if (!user) {
      return NextResponse.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const token = await prisma.passwordResetToken.create({
      data: { userId: user.id, expiresAt },
    });

    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${base}/reset-password?token=${token.token}`;

    await sendPasswordReset({
      to: user.email,
      name: user.name ?? undefined,
      resetUrl,
    });

    return NextResponse.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
  } catch (err: any) {
    console.error("[forgot-password]", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}

