/**
 * GET   /api/admin/ops/findings/[findingId]  — Fetch finding + explanation.
 * PATCH /api/admin/ops/findings/[findingId]  — Update status (ack | resolved).
 *
 * ADMIN-only. Tenant isolation enforced via schoolId check.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: { findingId: string } };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("ADMIN");
    const finding = await prisma.opsFinding.findUnique({
      where: { id: params.findingId },
      include: { explanation: true },
    });

    if (!finding) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Tenant isolation: non-platform-admins can only read their own school's findings
    if (!user.isPlatformAdmin && finding.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ finding });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}

// ── PATCH (ack / resolve) ─────────────────────────────────────────────────────

const VALID_STATUSES = ["ack", "resolved"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("ADMIN");

    const body = await req.json().catch(() => ({})) as { status?: string };
    const newStatus = body.status as ValidStatus | undefined;

    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await prisma.opsFinding.findUnique({
      where: { id: params.findingId },
      select: { id: true, schoolId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!user.isPlatformAdmin && existing.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const finding = await prisma.opsFinding.update({
      where: { id: params.findingId },
      data: {
        status:     newStatus,
        ackedAt:    newStatus === "ack"      ? now : undefined,
        resolvedAt: newStatus === "resolved" ? now : undefined,
      },
    });

    return NextResponse.json({ finding });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
