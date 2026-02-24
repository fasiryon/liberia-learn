/**
 * GET  /api/admin/ops/findings  — List findings for the caller's school.
 * POST /api/admin/ops/findings  — Run the deterministic findings engine now.
 *
 * ADMIN-only. Tenant-safe: non-platform-admins are scoped to their schoolId.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runFindingsEngine } from "@/lib/ops/findings-engine";

export const dynamic = "force-dynamic";

// ── GET: list findings ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");

    // Tenant isolation: non-platform-admins can only see their own school
    const schoolId = user.isPlatformAdmin
      ? (new URL(req.url).searchParams.get("schoolId") ?? user.schoolId ?? null)
      : (user.schoolId ?? null);

    const { searchParams } = new URL(req.url);
    const severity  = searchParams.get("severity")  ?? undefined;
    const category  = searchParams.get("category")  ?? undefined;
    const status    = searchParams.get("status")    ?? undefined;

    const findings = await prisma.opsFinding.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        ...(severity ? { severity } : {}),
        ...(category ? { category } : {}),
        ...(status   ? { status }   : {}),
      },
      include: { explanation: true },
      orderBy: [
        // critical first, then warn, then info
        { createdAt: "desc" },
      ],
      take: 100,
    });

    return NextResponse.json({ findings });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}

// ── POST: run findings engine ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");

    const schoolId = user.isPlatformAdmin
      ? ((await req.json().catch(() => ({}))) as any)?.schoolId ?? user.schoolId ?? null
      : (user.schoolId ?? null);

    const result = await runFindingsEngine(schoolId);

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
