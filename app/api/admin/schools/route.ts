// app/api/admin/schools/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  try {
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
  } catch (err) {
    console.error("Error creating school:", err);
    return NextResponse.json(
      { error: "Failed to create school" },
      { status: 500 }
    );
  }
}


