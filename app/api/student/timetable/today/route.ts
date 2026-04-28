import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { getTimetableForStudent } from "@/lib/timetable/timetableService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("STUDENT");

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ timetable: null });
    }

    const timetable = await getTimetableForStudent(student.id, new Date());

    return NextResponse.json({ timetable });
  } catch (err: any) {
    return handleApiError(err, {
      requestId: "",
      route: "/api/student/timetable/today",
      method: "GET",
    });
  }
}
