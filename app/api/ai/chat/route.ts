// app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import { TutorAgent } from "@/lib/ai/tutor-agent";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      typeof session !== "object" ||
      !session.user ||
      typeof session.user !== "object"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role;
    const userId = (session.user as any).id as string | undefined;

    if (role !== "STUDENT" || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { message } = body ?? {};

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (message.length > 1000) {
      return NextResponse.json(
        { error: "Message too long (max 1000 characters)" },
        { status: 400 }
      );
    }

    const tutor = new TutorAgent(student.id);
    const response = await tutor.chat(message);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}


