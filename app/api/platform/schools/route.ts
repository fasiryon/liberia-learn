import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { computeFieldDiff } from "@/lib/audit-diff";

export const dynamic = "force-dynamic";

/** GET: list all schools */
export async function GET() {
  try {
    await requirePlatformAdmin();

    const schools = await prisma.school.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        pilotStatus: true,
        pilotCohort: true,
        pilotStartDate: true,
        pilotNotes: true,
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
    const user = await requirePlatformAdmin();

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
      userId: user.id,
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
    const user = await requirePlatformAdmin();

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "School id is required" }, { status: 400 });
    }

    const allowedFields = [
      "status",
      "pilotStatus",
      "pilotCohort",
      "pilotStartDate",
      "pilotNotes",
    ] as const;

    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        updateData[key] = updates[key];
      }
    }

    if (updateData.pilotStartDate) {
      updateData.pilotStartDate = new Date(updateData.pilotStartDate as string);
    } else if (Object.prototype.hasOwnProperty.call(updateData, "pilotStartDate")) {
      updateData.pilotStartDate = null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const existing = await prisma.school.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        pilotStatus: true,
        pilotCohort: true,
        pilotStartDate: true,
        pilotNotes: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const school = await prisma.school.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        status: true,
        pilotStatus: true,
        pilotCohort: true,
        pilotStartDate: true,
        pilotNotes: true,
      },
    });

    const diff = computeFieldDiff(existing, school, [
      "status",
      "pilotStatus",
      "pilotCohort",
      "pilotStartDate",
      "pilotNotes",
    ]);

    if (Object.keys(diff).length > 0) {
      await logAudit({
        userId: user.id,
        action: "school.update",
        resourceType: "school",
        resourceId: id,
        details: {
          schoolName: school.name,
          changes: diff,
        },
      });
    }

    return NextResponse.json({ school });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
