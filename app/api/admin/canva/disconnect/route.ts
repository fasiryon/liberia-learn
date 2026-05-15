import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE() {
  try {
    await requireRole("ADMIN");
    await prisma.canvaOAuthCredential.deleteMany({ where: { provider: "canva" } });
    return NextResponse.json({ disconnected: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: err.status ?? 500 }
    );
  }
}
