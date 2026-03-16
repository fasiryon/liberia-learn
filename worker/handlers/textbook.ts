import { prisma } from "@/lib/db";
import { compileTextbook } from "@/lib/ai/textbook/textbookCompiler";

type TextbookJobPayload = {
  subject: string;
  gradeLevel: number;
  schoolId?: string;
  title?: string;
};

export async function handleGenerateTextbookJob(payload: TextbookJobPayload) {
  if (!payload?.subject || !payload?.gradeLevel) {
    throw new Error("subject and gradeLevel are required for GENERATE_TEXTBOOK");
  }

  const textbook = await compileTextbook(payload);
  const schoolScope = payload.schoolId ?? "national";
  const contentId = `textbook-${payload.subject.toLowerCase()}-g${payload.gradeLevel}-${schoolScope}`;

  await prisma.curriculumContent.upsert({
    where: { contentId },
    update: {
      grade: payload.gradeLevel,
      subject: payload.subject.toUpperCase(),
      contentType: "textbook",
      status: "published",
      version: new Date().toISOString().slice(0, 10),
      payload: textbook as any,
    },
    create: {
      contentId,
      grade: payload.gradeLevel,
      subject: payload.subject.toUpperCase(),
      contentType: "textbook",
      status: "published",
      version: new Date().toISOString().slice(0, 10),
      payload: textbook as any,
    },
  });
}
