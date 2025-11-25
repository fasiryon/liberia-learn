// app/api/homework/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  // Only teachers can create homework
  if (!session || (session.user as any).role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { classId, title, instructions, questionsText, dueDate } =
    await req.json();

  if (!classId || !title) {
    return NextResponse.json(
      { error: "Class and title are required." },
      { status: 400 }
    );
  }

  // Simple “one question per line” parsing
  const questions = (questionsText ?? "")
    .split("\n")
    .map((line: string) => line.trim())
    .filter(Boolean)
    .map((prompt: string, index: number) => ({
      id: `q${index + 1}`,
      type: "short_answer",
      prompt,
      points: 5,
    }));

  const parsedDueAt = dueDate ? new Date(dueDate) : null;

  const homework = await prisma.homework.create({
    data: {
      classId,
      title,
      instructions: instructions ?? "",
      questions,
      dueAt: parsedDueAt,
      // ⛔️ DO NOT put teacherId here – Homework model doesn’t have it
    },
  });

  return NextResponse.json({ id: homework.id }, { status: 201 });
}
