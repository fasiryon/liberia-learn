import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: { contentId: string } }
) {
  let user: Awaited<ReturnType<typeof requireRole>>;
  try {
    user = await requireRole("STUDENT");
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }

  const { contentId } = params;

  const sessionStart = new Date();
  sessionStart.setHours(0, 0, 0, 0);

  const conversation = await prisma.tutorConversation.findFirst({
    where: {
      studentId: user.id,
      contentId,
      sessionDate: { gte: sessionStart },
    },
    orderBy: { createdAt: "desc" },
    select: { messages: true, questionsAsked: true },
  });

  return NextResponse.json({
    messages: conversation?.messages ?? [],
    questionsAsked: conversation?.questionsAsked ?? 0,
  });
}
