import { config } from "dotenv";
import { prisma } from "@/lib/db";
import { generateCurriculumPayload } from "@/lib/ai/curriculum-factory";
import { embedLesson } from "@/lib/ai/rag/embeddingService";

config({ path: ".env.local" });
config();

type LessonRow = {
  id: string;
  subject: string;
  grade: number;
  moeAlignments: unknown;
  payload: unknown;
};

type LessonPayload = {
  title?: string;
  objectives?: string[];
  body?: string;
  body_standard?: string;
  body_block?: string;
  metadata?: {
    topic?: string;
  };
};

const MAX_GENERATION_ATTEMPTS = 4;

function asPayload(value: unknown): LessonPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as LessonPayload;
}

function toAlignmentCodes(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const codes = value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object" && typeof (entry as { code?: unknown }).code === "string") {
        return (entry as { code: string }).code.trim();
      }
      return "";
    })
    .filter(Boolean);

  return codes.length > 0 ? codes : undefined;
}

function inferTopic(payload: LessonPayload): string {
  const topic = payload.metadata?.topic?.trim();
  if (topic) return topic;

  const title = payload.title?.trim();
  if (title) return title;

  const objective = payload.objectives?.find((entry) => typeof entry === "string" && entry.trim().length > 0)?.trim();
  if (objective) return objective;

  throw new Error("Could not infer lesson topic from payload");
}

function countWords(text: string | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countLessonWords(payload: LessonPayload): number {
  if (payload.body_standard && payload.body_block) {
    return countWords(payload.body_standard) + countWords(payload.body_block);
  }

  if (payload.body && payload.body_standard && payload.body.trim() === payload.body_standard.trim()) {
    return countWords(payload.body_standard);
  }

  return countWords(payload.body_block ?? payload.body_standard ?? payload.body);
}

function countSections(text: string | undefined): number {
  if (!text) return 0;
  return (text.match(/^##\s+/gm) ?? []).length;
}

function shouldRegenerate(payload: LessonPayload): boolean {
  if (!payload.body_standard || !payload.body_block) {
    return true;
  }

  const primaryBody =
    countWords(payload.body_block) > countWords(payload.body_standard)
      ? payload.body_block
      : payload.body_standard;

  if (countSections(primaryBody) < 5) {
    return true;
  }

  return countLessonWords(payload) < 1000;
}

async function loadApprovedLessons(): Promise<LessonRow[]> {
  return prisma.curriculumContent.findMany({
    where: {
      status: "APPROVED",
      contentType: "lesson",
    },
    select: {
      id: true,
      subject: true,
      grade: true,
      moeAlignments: true,
      payload: true,
    },
    orderBy: [{ subject: "asc" }, { grade: "asc" }, { id: "asc" }],
  });
}

async function main() {
  const lessons = await loadApprovedLessons().then((rows) =>
    rows.filter((lesson) => shouldRegenerate(asPayload(lesson.payload)))
  );

  let regeneratedCount = 0;
  let failedCount = 0;
  let totalWords = 0;

  for (const lesson of lessons) {
    try {
      const existingPayload = asPayload(lesson.payload);
      const topic = inferTopic(existingPayload);
      const moeAlignmentCodes = toAlignmentCodes(lesson.moeAlignments);
      let newPayload: Awaited<ReturnType<typeof generateCurriculumPayload>> | null = null;
      let lastGenerationError: unknown = null;

      for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
        try {
          newPayload = await generateCurriculumPayload({
            grade: lesson.grade,
            subject: lesson.subject,
            topic,
            contentType: "lesson",
            moeAlignmentCodes,
            lessonFormat: "either",
            liberiaContext: true,
            forceSmartTier: true,
          });
          break;
        } catch (error) {
          lastGenerationError = error;
          console.error(
            `[REGEN_LESSONS] Generation attempt ${attempt}/${MAX_GENERATION_ATTEMPTS} failed for ${lesson.id}`,
            error
          );
        }
      }

      if (!newPayload) {
        throw lastGenerationError instanceof Error
          ? lastGenerationError
          : new Error("Lesson generation failed after retries");
      }

      const wordCount = countWords(newPayload.body);

      await prisma.curriculumContent.update({
        where: { id: lesson.id },
        data: {
          payload: newPayload,
          updatedAt: new Date(),
        },
      });

      try {
        await embedLesson(lesson.id);
      } catch (error) {
        console.error(`[REGEN_LESSONS] Embedding failed for ${lesson.id}`, error);
      }

      regeneratedCount += 1;
      totalWords += wordCount;
      console.log(`Regenerated: ${lesson.subject} Grade ${lesson.grade} - ${wordCount} words`);
    } catch (error) {
      failedCount += 1;
      console.error(`[REGEN_LESSONS] Failed lesson ${lesson.id}`, error);
    }
  }

  const averageWordCount = regeneratedCount > 0 ? Math.round(totalWords / regeneratedCount) : 0;
  console.log(`Regenerated ${regeneratedCount} lessons. Average word count: ${averageWordCount}`);
  console.log(`Failed: ${failedCount} lessons (see errors above)`);
}

main()
  .catch((error) => {
    console.error("[REGEN_LESSONS] Fatal failure", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
