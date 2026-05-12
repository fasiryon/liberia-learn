import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ROLE_VISIBILITY: Record<string, string[]> = {
  STUDENT:  ["ALL", "STUDENTS"],
  TEACHER:  ["ALL", "TEACHERS"],
  GUARDIAN: ["ALL", "GUARDIANS"],
  ADMIN:    ["ALL", "STUDENTS", "TEACHERS", "GUARDIANS"],
};

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user.schoolId) return NextResponse.json({ events: [] });

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const allowed = ROLE_VISIBILITY[user.role] ?? ["ALL"];

    const events = await prisma.schoolEvent.findMany({
      where: {
        schoolId: user.schoolId,
        published: true,
        visibility: { in: allowed },
        ...(from || to
          ? {
              eventDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { eventDate: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        eventDate: true,
        endDate: true,
        type: true,
        visibility: true,
      },
    });

    return NextResponse.json({ events });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
