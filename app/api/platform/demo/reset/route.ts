import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";

export async function POST() {
  try {
    await requirePlatformAdmin();
    // In production, this would call the seed script
    // For now, return a message directing to use npx prisma db seed
    return NextResponse.json({
      message: "Run 'npx prisma db seed' to reset demo data",
      note: "Automated reset requires server-side execution",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

