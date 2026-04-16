import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAdminStudentDetail } from "@/lib/adminStudentDetail";
import { moveStudentBetweenClasses } from "@/lib/school-operations";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const schoolId = user.schoolId ?? null;
    if (!schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const { id } = await params;
    const student = await getAdminStudentDetail(id, schoolId);

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({ student });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const schoolId = user.schoolId ?? null;
    if (!schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (body?.action !== "moveClass" || typeof body?.targetClassId !== "string") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { id } = await params;
    await moveStudentBetweenClasses({
      actorUserId: user.id,
      schoolId,
      studentId: id,
      targetClassId: body.targetClassId,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}
