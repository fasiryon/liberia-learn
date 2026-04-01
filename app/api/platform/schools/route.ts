import { NextRequest, NextResponse } from "next/server";
import { requireMoePlatformAdmin } from "@/lib/moeAccess";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** GET: list all schools */
export async function GET() {
  try {
    await requireMoePlatformAdmin();

    const schools = await prisma.school.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        county: true,
        district: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        motto: true,
        logoUrl: true,
        primaryHex: true,
        createdAt: true,
        _count: { select: { users: true, classes: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ schools });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}

/** POST: create a new school */
export async function POST(req: NextRequest) {
  try {
    await requireMoePlatformAdmin();

    const body = await req.json();
    const { name, county, district, contactName, contactEmail, contactPhone, motto, status } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "School name is required" }, { status: 400 });
    }

    const school = await prisma.school.create({
      data: {
        name: name.trim(),
        county: county?.trim() || null,
        district: district?.trim() || null,
        contactName: contactName?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        motto: motto?.trim() || null,
        status: status || "ACTIVE",
      },
    });

    await logAudit({
      userId: (await requireMoePlatformAdmin()).id,
      action: "school.create",
      resourceType: "school",
      resourceId: school.id,
      details: { name: school.name, county: school.county },
    });

    return NextResponse.json({ school }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}

/** PATCH: update a school */
export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireMoePlatformAdmin();

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "School id is required" }, { status: 400 });
    }

    const school = await prisma.school.update({
      where: { id },
      data: updates,
    });

    void logAudit({
      userId: actor.id,
      action: "platform.schools.updated",
      resourceType: "school",
      resourceId: id,
    });

    return NextResponse.json({ school });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
