import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function GET() {
  try {
    const user = await requireRole("ADMIN");
    const schoolId = user.schoolId;
    if (!schoolId) {
      return NextResponse.json({ error: "No school assigned" }, { status: 400 });
    }
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        primaryHex: true,
        secondaryHex: true,
        accentHex: true,
        logoUrl: true,
        motto: true,
        welcomeMsg: true,
      },
    });
    return NextResponse.json(school ?? {});
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    const schoolId = user.schoolId;
    if (!schoolId) {
      return NextResponse.json({ error: "No school assigned" }, { status: 400 });
    }

    const body = await req.json();
    const { primaryHex, secondaryHex, accentHex, logoUrl, motto, welcomeMsg } = body;

    // Validate hex values if provided
    for (const [key, val] of Object.entries({ primaryHex, secondaryHex, accentHex })) {
      if (val !== undefined && val !== null && val !== "" && !HEX_RE.test(val as string)) {
        return NextResponse.json(
          { error: `Invalid hex color for ${key}` },
          { status: 400 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (primaryHex !== undefined) data.primaryHex = primaryHex || null;
    if (secondaryHex !== undefined) data.secondaryHex = secondaryHex || null;
    if (accentHex !== undefined) data.accentHex = accentHex || null;
    if (logoUrl !== undefined) data.logoUrl = logoUrl || null;
    if (motto !== undefined) data.motto = motto || null;
    if (welcomeMsg !== undefined) data.welcomeMsg = welcomeMsg || null;

    const updated = await prisma.school.update({
      where: { id: schoolId },
      data,
      select: {
        primaryHex: true,
        secondaryHex: true,
        accentHex: true,
        logoUrl: true,
        motto: true,
        welcomeMsg: true,
      },
    });

    await logAudit({
      userId: user.id,
      action: "school.branding.update",
      resourceType: "school",
      resourceId: schoolId,
      details: data as Record<string, unknown>,
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}

