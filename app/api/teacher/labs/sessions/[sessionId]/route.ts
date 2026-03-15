import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isVirtualLabsEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

const ReviewSchema = z.object({
  score: z.number().int().min(0).max(100),
  teacherFeedback: z.string().trim().min(10).max(2000),
});

type AuthorizedSessionResult =
  | {
      ok: true;
      session: any;
      scheduledWork: any;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

async function resolveAuthorizedSession(
  sessionId: string,
  userId: string,
  schoolId: string,
  role: string
): Promise<AuthorizedSessionResult> {
  const session = await prisma.labSession.findUnique({
    where: { id: sessionId },
    include: {
      student: { select: { id: true, name: true, email: true } },
    },
  });

  if (!session || session.schoolId !== schoolId) {
    return { ok: false, error: "Not found", status: 404 };
  }

  if (!session.scheduledWorkId) {
    return { ok: false, error: "Not found", status: 404 };
  }

  const scheduledWork = await prisma.scheduledWork.findUnique({
    where: { id: session.scheduledWorkId },
    include: {
      class: { select: { teacherId: true, schoolId: true, name: true } },
    },
  });

  if (!scheduledWork || scheduledWork.class.schoolId !== schoolId) {
    return { ok: false, error: "Not found", status: 404 };
  }

  const isAdminUser = role === "ADMIN";
  if (!isAdminUser && scheduledWork.class.teacherId !== userId) {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  return { ok: true, session, scheduledWork };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  if (!isVirtualLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "No school context" }, { status: 400 });
    }

    const authorized = await resolveAuthorizedSession(params.sessionId, user.id, user.schoolId, user.role);
    if ("error" in authorized) {
      return NextResponse.json({ error: authorized.error }, { status: authorized.status });
    }

    const lab = await prisma.virtualLab.findUnique({
      where: { labId: authorized.session.labId },
      select: { labId: true, title: true, payload: true },
    });

    return NextResponse.json({
      session: authorized.session,
      className: authorized.scheduledWork.class.name,
      lab,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to load lab session" }, { status: err?.status ?? 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  if (!isVirtualLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "No school context" }, { status: 400 });
    }

    const authorized = await resolveAuthorizedSession(params.sessionId, user.id, user.schoolId, user.role);
    if ("error" in authorized) {
      return NextResponse.json({ error: authorized.error }, { status: authorized.status });
    }

    const parsed = ReviewSchema.parse(await req.json());
    const updated = await prisma.labSession.update({
      where: { id: params.sessionId },
      data: {
        score: parsed.score,
        teacherFeedback: parsed.teacherFeedback,
      },
    });

    await logAudit({
      userId: user.id,
      action: "lab.session.reviewed",
      resourceType: "labSession",
      resourceId: params.sessionId,
      schoolId: user.schoolId,
      details: { score: parsed.score },
    });

    return NextResponse.json({ session: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to review lab session" }, { status: err?.status ?? 500 });
  }
}
