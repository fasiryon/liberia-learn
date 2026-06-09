import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { completeTeacherLesson } from "@/lib/student/completeTeacherLesson";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { contentId: string } }
) {
  try {
    const user = await requireRole("STUDENT");
    const result = await completeTeacherLesson(user, params.contentId);
    return NextResponse.json({
      success: true,
      completedAt: result.completedAt,
      exitTicketScore: result.exitTicketScore,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to complete lesson" },
      { status: err?.status ?? 500 }
    );
  }
}
