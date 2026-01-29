import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const rows = await prisma.governedArtifact.findMany({
      where: { decision: "ACCEPT" },
      orderBy: { governanceTimestamp: "desc" },
      take: 50,
    });

    return NextResponse.json({ ok: true, count: rows.length, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
