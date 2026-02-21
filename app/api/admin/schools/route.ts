// app/api/admin/schools/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    await requireRole("ADMIN");

    const formData = await request.formData();

    const name = (formData.get("name") as string | null)?.trim();
    const timezone = (formData.get("timezone") as string | null)?.trim() || "Africa/Monrovia";
    const primaryHex =
      (formData.get("primaryHex") as string | null)?.trim() || "#22c55e";
    const secondaryHex =
      (formData.get("secondaryHex") as string | null)?.trim() || "#0ea5e9";

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const id = `school-${Date.now()}`;

    await prisma.school.create({
      data: {
        id,
        name,
        timezone,
        primaryHex,
        secondaryHex,
      },
    });

    return NextResponse.redirect(new URL("/admin/schools", request.url));
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error creating school:", err);
    return NextResponse.json(
      { error: "Failed to create school" },
      { status: 500 }
    );
  }
}

