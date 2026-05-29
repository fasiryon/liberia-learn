/**
 * GET /api/adaptive/scaffold/[variantId]
 *
 * Returns the body of a LessonVariant (scaffold/simplified).
 * Called by StuckHelper when a scaffold route is returned.
 *
 * Auth: STUDENT role required
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { variantId: string } }
) {
  try {
    await requireRole("STUDENT");

    const variant = await prisma.lessonVariant.findUnique({
      where: { id: params.variantId },
      select: { id: true, lessonId: true, variantType: true, body: true },
    });

    if (!variant) {
      return NextResponse.json({ error: "variant_not_found" }, { status: 404 });
    }

    return NextResponse.json({
      id: variant.id,
      lessonId: variant.lessonId,
      variantType: variant.variantType,
      body: variant.body,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "scaffold_fetch_failed" },
      { status: error?.status ?? 500 }
    );
  }
}
