import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { generatePermissionSlip } from "@/lib/canva/templates/permissionSlip";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await requireRole("ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { eventId } = await req.json();
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const event = await prisma.schoolEvent.findFirst({
    where: { id: eventId, schoolId: user.schoolId! },
  });

  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.type !== "TRIP")
    return NextResponse.json(
      { error: "Permission slips are only for TRIP events" },
      { status: 400 }
    );

  // Get all enrolled students in the school
  const students = await prisma.user.findMany({
    where: { schoolId: user.schoolId!, role: "STUDENT" },
    include: {
      student: {
        include: {
          guardians: {
            include: { guardian: { select: { name: true } } },
            take: 1,
          },
        },
      },
    },
  });

  const jobs = students.map((student) => {
    const guardianName =
      student.student?.guardians?.[0]?.guardian?.name ?? "Parent/Guardian";
    return generatePermissionSlip(
      {
        studentName: student.name ?? "Student",
        guardianName,
        eventTitle: event.title,
        eventDate: new Date(event.eventDate).toLocaleDateString("en-LR"),
        schoolName: "School",
        returnDate: event.endDate
          ? new Date(event.endDate).toLocaleDateString("en-LR")
          : undefined,
      },
      user.schoolId!,
      student.id,
      user.id
    );
  });

  const docs = await Promise.all(jobs);
  return NextResponse.json({ generated: docs.length, docs }, { status: 201 });
}
