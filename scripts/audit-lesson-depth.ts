import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type LessonPayload = {
  title?: string;
  body?: string;
  body_standard?: string;
  body_block?: string;
  labs?: unknown[];
  deliveryProfile?: {
    standardVersion?: unknown;
    blockVersion?: unknown;
  };
};

function asPayload(value: unknown): LessonPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as LessonPayload;
}

function countWords(text: string | undefined) {
  if (!text) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function countSections(text: string | undefined) {
  if (!text) return 0;
  return (text.match(/^##\s+/gm) ?? []).length;
}

async function main() {
  const lessons = await prisma.curriculumContent.findMany({
    where: {
      contentType: "lesson",
      status: "published",
    },
    select: {
      subject: true,
      grade: true,
      contentId: true,
      payload: true,
      deliveryProfile: true,
    },
    orderBy: [{ subject: "asc" }, { grade: "asc" }, { contentId: "asc" }],
  });

  const rows = lessons.map((lesson) => {
    const payload = asPayload(lesson.payload);
    const bodyStandard = payload.body_standard ?? payload.body;
    const bodyBlock = payload.body_block;
    const primaryBody = bodyBlock && countWords(bodyBlock) > countWords(bodyStandard) ? bodyBlock : bodyStandard;
    const words = countWords(primaryBody);
    const sections = countSections(primaryBody);
    const labs = Array.isArray(payload.labs) ? payload.labs : [];
    const deliveryProfile =
      lesson.deliveryProfile && typeof lesson.deliveryProfile === "object" && !Array.isArray(lesson.deliveryProfile)
        ? (lesson.deliveryProfile as LessonPayload["deliveryProfile"])
        : payload.deliveryProfile;
    const hasBlockVersion = Boolean(bodyBlock || deliveryProfile?.blockVersion);
    const quality = words < 800 ? "THIN" : "READY";

    return {
      Subject: lesson.subject,
      Grade: lesson.grade,
      Title: payload.title ?? lesson.contentId,
      Words: words,
      Sections: sections,
      "Has Lab": labs.length > 0 ? "Yes" : "No",
      "Has Block Version": hasBlockVersion ? "Yes" : "No",
      Quality: quality,
    };
  });

  console.table(rows);

  const productionReady = rows.filter((row) => row.Words >= 800 && row.Sections >= 5).length;
  console.log(`${productionReady}/${rows.length} lessons are production-ready`);
}

main()
  .catch((error) => {
    console.error("Lesson depth audit failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
