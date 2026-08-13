import { prisma } from "@/lib/db";
import { routedCompletion } from "@/lib/ai/router";
import {
  generateAssessmentItems,
  generateMasteryChecks,
  generateRubric,
  slugify,
} from "@/lib/curriculum-helpers";
import { gradeToBand } from "@/lib/moe/alignment-engine";
import { liberianize } from "@/lib/localization/liberia-context";
import { standardizeTone } from "@/lib/localization/tone-standardizer";
import { z } from "zod";
import { randomUUID } from "crypto";
import type { CurriculumContent } from "@prisma/client";
import { buildPrompt, getPromptMetadata } from "@/lib/ai/promptRegistry";
import { createCurriculumContent, provenanceWritersEnabled, updateCurriculumContent } from "@/lib/curriculum/mutations/repository";
import { appendCurriculumGovernanceEvent } from "@/lib/curriculum/mutations/governanceWriter";
import { revokeCurriculum } from "@/lib/curriculum/mutations/revocationWriter";

const SUBJECT_VALUES = [
  "MATH",
  "SCIENCE",
  "COMPUTER_SCIENCE",
  "ENGINEERING",
  "LITERACY",
  "CIVICS",
  "ARTS",
  "PE",
  "CAREER",
] as const;

const LESSON_TYPE_ORDER = [
  "intro",
  "core",
  "core",
  "core",
  "practice",
  "review",
  "assessment",
] as const;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "that",
  "this",
  "your",
  "their",
  "will",
  "have",
  "about",
  "lesson",
  "unit",
  "grade",
  "students",
]);

const BlueprintSchema = z.object({
  introObjective: z.string().min(8),
  coreObjectives: z.array(z.string().min(8)).length(3),
  practiceFocus: z.string().min(8),
  reviewObjective: z.string().min(8),
});

const GeneratedLessonSchema = z.object({
  title: z.string().min(3),
  objectives: z.array(z.string().min(1)).min(1),
  body: z.string().min(50),
  activities: z.array(z.string().min(1)).default([]),
  assessmentQuestions: z.array(z.string().min(1)).default([]),
  answerKey: z.array(z.string().min(1)).default([]),
  estimatedMinutes: z.number().int().min(15).max(180),
  moeAlignments: z.array(z.string()).default([]),
});

type ExistingLesson = {
  id: string;
  contentId: string;
  contentType: string;
  status: string;
  grade: number;
  subject: string;
  unitId: string | null;
  orderInUnit: number | null;
  lessonType: string | null;
  payload: any;
};

type CurriculumUnitRecord = Awaited<
  ReturnType<typeof prisma.curriculumUnit.create>
>;

type CurriculumContentRecord = CurriculumContent;

export type AssembledUnit = {
  unit: CurriculumUnitRecord;
  lessons: CurriculumContentRecord[];
};

export async function assembleUnit(params: {
  subject: string;
  gradeLevel: number;
  unitTitle: string;
  unitDescription: string;
  schoolId?: string;
  createdById?: string;
}): Promise<AssembledUnit> {
  const generationCorrelationId = randomUUID();
  const subject = params.subject.trim().toUpperCase();
  if (!SUBJECT_VALUES.includes(subject as (typeof SUBJECT_VALUES)[number])) {
    throw Object.assign(new Error("Invalid subject"), { status: 400 });
  }
  if (!params.schoolId) {
    throw Object.assign(new Error("School context is required for unit assembly"), {
      status: 400,
    });
  }
  if (!params.createdById) {
    throw Object.assign(new Error("createdById is required for unit assembly"), {
      status: 400,
    });
  }

  const standards = await prisma.standard.findMany({
    where: {
      subject: subject as any,
      band: gradeToBand(params.gradeLevel),
    },
    select: {
      code: true,
      description: true,
    },
    orderBy: { code: "asc" },
  });

  const [existingLessons, lastUnit] = await Promise.all([
    prisma.curriculumContent.findMany({
      where: {
        grade: params.gradeLevel,
        subject,
        contentType: { in: ["lesson", "assessment"] },
        status: { in: ["published", "APPROVED"] },
        unitId: null,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        contentId: true,
        contentType: true,
        status: true,
        grade: true,
        subject: true,
        unitId: true,
        orderInUnit: true,
        lessonType: true,
        payload: true,
      },
    }),
    prisma.curriculumUnit.findFirst({
      where: {
        schoolId: params.schoolId,
        subject,
        grade: params.gradeLevel,
      },
      orderBy: [{ weekEnd: "desc" }, { createdAt: "desc" }],
      select: { weekEnd: true },
    }),
  ]);

  const blueprint = await buildBlueprint({
    subject,
    gradeLevel: params.gradeLevel,
    unitTitle: params.unitTitle,
    unitDescription: params.unitDescription,
    standards,
    existingLessons,
    generationCorrelationId,
  });

  const weekStart = (lastUnit?.weekEnd ?? 0) + 1;
  const unit = await prisma.curriculumUnit.create({
    data: {
      name: params.unitTitle.trim(),
      description: params.unitDescription.trim() || null,
      subject,
      grade: params.gradeLevel,
      schoolId: params.schoolId,
      targetStandardCodes: standards.map((standard) => standard.code),
      weekStart,
      weekEnd: weekStart + 1,
      createdById: params.createdById,
    },
  });

  const previousAssignments: Array<{
    id: string;
    unitId: string | null;
    orderInUnit: number | null;
    lessonType: string | null;
  }> = [];
  const createdLessonIds: string[] = [];

  try {
    const selections = selectExistingLessons(existingLessons, {
      unitTitle: params.unitTitle,
      unitDescription: params.unitDescription,
      blueprint,
    });

    const persistedLessons: CurriculumContentRecord[] = [];

    for (let index = 0; index < LESSON_TYPE_ORDER.length; index += 1) {
      const lessonType = LESSON_TYPE_ORDER[index];
      const orderInUnit = index + 1;
      const selected = selections[index];

      if (selected) {
        previousAssignments.push({
          id: selected.id,
          unitId: selected.unitId,
          orderInUnit: selected.orderInUnit,
          lessonType: selected.lessonType,
        });

        const updatedWrite = await updateCurriculumContent(
          { id: selected.id },
          {
            unitId: unit.unitId,
            orderInUnit,
            lessonType,
          },
          {
            revisionKind: "METADATA_CHANGE",
            originKind: "HUMAN_AUTHORED",
            actorUserId: params.createdById,
            authorUserId: params.createdById,
            requestedCompleteness: "VERIFIED",
            auditAction: "curriculum.revision.unit_placement",
            idempotencyKey: `unit-placement:${unit.id}:${selected.id}:${orderInUnit}`,
            schoolId: params.schoolId,
          },
        );
        persistedLessons.push(updatedWrite.content);
        continue;
      }

      const created =
        lessonType === "assessment"
          ? await createAssessmentArtifact({
              unit,
              subject,
              gradeLevel: params.gradeLevel,
              unitTitle: params.unitTitle,
              unitDescription: params.unitDescription,
              orderInUnit,
              createdById: params.createdById,
              standardCodes: standards.map((standard) => standard.code),
            })
          : await createGeneratedArtifact({
              unit,
              subject,
              gradeLevel: params.gradeLevel,
              unitTitle: params.unitTitle,
              unitDescription: params.unitDescription,
              orderInUnit,
              lessonType,
              objective: getObjectiveForSlot(lessonType, index, blueprint),
              standardCodes: standards.map((standard) => standard.code),
              createdById: params.createdById,
              generationCorrelationId,
            });

      createdLessonIds.push(created.id);
      persistedLessons.push(created);
    }

    return {
      unit,
      lessons: persistedLessons.sort(
        (left, right) => (left.orderInUnit ?? 0) - (right.orderInUnit ?? 0)
      ),
    };
  } catch (error) {
    console.error("[UNIT_ASSEMBLY] Failed", error);

    for (const assignment of previousAssignments.reverse()) {
      try {
        await updateCurriculumContent(
          { id: assignment.id },
          {
            unitId: assignment.unitId,
            orderInUnit: assignment.orderInUnit,
            lessonType: assignment.lessonType,
          },
          {
            revisionKind: "METADATA_CHANGE",
            originKind: "HUMAN_AUTHORED",
            actorUserId: params.createdById,
            authorUserId: params.createdById,
            requestedCompleteness: "VERIFIED",
            auditAction: "curriculum.revision.unit_placement_rollback",
            idempotencyKey: `unit-placement-rollback:${unit.id}:${assignment.id}`,
            schoolId: params.schoolId,
          },
        );
      } catch (rollbackError) {
        console.error("[UNIT_ASSEMBLY] Failed to rollback lesson assignment", rollbackError);
      }
    }

    if (createdLessonIds.length > 0) {
      try {
        for (const id of createdLessonIds) {
          const created = await prisma.curriculumContent.findUnique({ where: { id } });
          if (created) {
            await revokeCurriculum({
              contentId: created.contentId,
              actorType: "SYSTEM",
              actorLabel: "unit-assembly-rollback",
              reason: "Unit assembly failed before completion",
              urgent: false,
              reviewAuthority: "SYSTEM",
              idempotencyKey: `unit-assembly-rollback:${unit.id}:${id}`,
              schoolId: params.schoolId,
            });
          }
        }
      } catch (rollbackError) {
        console.error("[UNIT_ASSEMBLY] Failed to delete generated lessons", rollbackError);
      }
    }

    try {
      await prisma.curriculumUnit.delete({ where: { id: unit.id } });
    } catch (rollbackError) {
      console.error("[UNIT_ASSEMBLY] Failed to delete incomplete unit", rollbackError);
    }

    throw error;
  }
}

async function buildBlueprint(params: {
  subject: string;
  gradeLevel: number;
  unitTitle: string;
  unitDescription: string;
  standards: Array<{ code: string; description: string }>;
  existingLessons: ExistingLesson[];
  generationCorrelationId: string;
}) {
  const standardBlock =
    params.standards.length > 0
      ? params.standards
          .slice(0, 8)
          .map((standard) => `${standard.code}: ${standard.description}`)
          .join("\n")
      : "No MOE standards were found for this subject and grade.";

  const existingLessonTitles =
    params.existingLessons.length > 0
      ? params.existingLessons
          .slice(0, 12)
          .map((lesson) => `- ${extractLessonTitle(lesson)}`)
          .join("\n")
      : "No existing lessons available.";

  const result = await routedCompletion({
    messages: [
      {
        role: "system",
        content: buildPrompt("unit.blueprint.system"),
      },
      {
        role: "user",
        content: buildPrompt("unit.blueprint.user", {
          subject: params.subject,
          gradeLevel: params.gradeLevel,
          unitTitle: params.unitTitle,
          unitDescription: params.unitDescription || "None provided",
          standardBlock,
          existingLessonTitles,
        }),
      },
    ],
    maxTokens: 900,
    forceSmartTier: true,
    aiUsage: {
      route: "curriculum.unit.blueprint",
      feature: "curriculum",
      subject: params.subject,
      requestType: "unit_blueprint",
      promptKey: "unit.blueprint.system",
      generationCorrelationId: params.generationCorrelationId,
    },
  });

  return parseJson(result.content, BlueprintSchema, "unit blueprint");
}

async function createGeneratedArtifact(params: {
  unit: CurriculumUnitRecord;
  subject: string;
  gradeLevel: number;
  unitTitle: string;
  unitDescription: string;
  orderInUnit: number;
  lessonType: "intro" | "core" | "practice" | "review";
  objective: string;
  standardCodes: string[];
  createdById: string;
  generationCorrelationId: string;
}) {
  const lessonLabel =
    params.lessonType === "practice"
      ? "practice exercise set"
      : params.lessonType === "review"
      ? "review lesson"
      : params.lessonType === "intro"
      ? "introductory lesson"
      : "core lesson";

  const guidance =
    params.lessonType === "practice"
      ? "Include 8-10 varied exercises with increasing difficulty and provide a clear answer key."
      : params.lessonType === "review"
      ? "Synthesize the unit's main concepts and prepare students for the assessment."
      : params.lessonType === "intro"
      ? "Orient students to the unit, activate prior knowledge, and preview the main concepts."
      : "Teach one main concept clearly with examples, guided practice, and classroom activities.";

  const result = await routedCompletion({
    messages: [
      {
        role: "system",
        content: buildPrompt("unit.artifact.system"),
      },
      {
        role: "user",
        content: buildPrompt("unit.artifact.user", {
          lessonLabel,
          subject: params.subject,
          gradeLevel: params.gradeLevel,
          unitTitle: params.unitTitle,
          unitDescription: params.unitDescription || "None provided",
          objective: params.objective,
          lessonType: params.lessonType,
          standardCodes: params.standardCodes.join(", ") || "none",
          guidance,
        }),
      },
    ],
    maxTokens: 1800,
    forceSmartTier: true,
    aiUsage: {
      route: "curriculum.unit.artifact",
      feature: "curriculum",
      subject: params.subject,
      requestType: "unit_artifact",
      promptKey: "unit.artifact.system",
      generationCorrelationId: params.generationCorrelationId,
    },
  });

  const lesson = parseJson(result.content, GeneratedLessonSchema, params.lessonType);
  const localized = localizeGeneratedLesson(lesson, params.gradeLevel);

  const prompt = getPromptMetadata("unit.artifact.system");
  const write = await createCurriculumContent(
    {
      contentId: buildAssembledContentId(params.unit.unitId, params.lessonType, params.orderInUnit),
      title: localized.title,
      grade: params.gradeLevel,
      subject: params.subject,
      contentType: "lesson",
      status: "draft",
      version: new Date().toISOString().slice(0, 10),
      unitId: params.unit.unitId,
      orderInUnit: params.orderInUnit,
      lessonType: params.lessonType,
      payload: {
        title: localized.title,
        grade: params.gradeLevel,
        subject: params.subject,
        objectives: localized.objectives,
        body: localized.body,
        activities: localized.activities,
        assessmentQuestions: localized.assessmentQuestions,
        answerKey: params.lessonType === "practice" ? localized.answerKey : [],
        estimatedMinutes: localized.estimatedMinutes,
        moeAlignments: localized.moeAlignments,
        approvalStatus: "DRAFT",
        createdByRole: "ADMIN",
        createdByUserId: params.createdById,
        metadata: {
          topic: params.unitTitle,
          locale: "LR",
          generatedAt: new Date().toISOString(),
          source: "unit_assembly",
          unitTitle: params.unit.name,
        },
      } as any,
      moeAlignments: localized.moeAlignments as any,
      schoolId: params.unit.schoolId,
    },
    {
      revisionKind: "ORIGINAL_GENERATION",
      originKind: "AI_GENERATED",
      actorUserId: params.createdById,
      authorUserId: params.createdById,
      generatorName: "unitAssembler",
      generatorVersion: "1.0.0",
      aiProvider: result.model.startsWith("llama") ? "groq" : "openai",
      aiModel: result.model,
      generatedAt: new Date(),
      generationCorrelationId: params.generationCorrelationId,
      primaryPromptKey: prompt.key,
      primaryPromptVersion: prompt.version,
      primaryPromptHash: prompt.hash,
      requestedCompleteness: "VERIFIED",
      auditAction: "curriculum.revision.unit_artifact_generated",
      idempotencyKey: `unit-artifact:${params.unit.id}:${params.orderInUnit}`,
      schoolId: params.unit.schoolId,
    },
  );
  if (write.revision) {
    await appendCurriculumGovernanceEvent({
      contentId: write.content.contentId,
      revisionId: write.revision.id,
      eventType: "APPROVED",
      actorType: "USER",
      actorUserId: params.createdById,
      approvalBasis: "ROLE_POLICY",
      reviewAuthority: "SCHOOL",
      reviewerRoleSnapshot: "ADMIN",
      idempotencyKey: `unit-artifact-approve:${params.unit.id}:${params.orderInUnit}`,
      schoolId: params.unit.schoolId,
    });
  }
  return provenanceWritersEnabled()
    ? prisma.curriculumContent.findUniqueOrThrow({ where: { id: write.content.id } })
    : write.content;
}

async function createAssessmentArtifact(params: {
  unit: CurriculumUnitRecord;
  subject: string;
  gradeLevel: number;
  unitTitle: string;
  unitDescription: string;
  orderInUnit: number;
  standardCodes: string[];
  createdById: string;
}) {
  const items = generateAssessmentItems(
    params.gradeLevel,
    params.subject,
    params.unitTitle,
    params.standardCodes
  );
  const rubric = generateRubric(params.unitTitle, params.standardCodes);
  const masteryChecks = generateMasteryChecks(
    params.gradeLevel,
    params.subject,
    params.unitTitle
  );

  const assessmentQuestions = items.map((item) =>
    `${item.question} Choices: ${item.options.map((option) => `${option.label}. ${option.text}`).join(" ")}`
  );
  const answerKey = items.map(
    (item) => `${item.id}: ${item.correctAnswer} (${item.options.find((option) => option.label === item.correctAnswer)?.text ?? ""})`
  );

  const generatedAt = new Date();
  const write = await createCurriculumContent(
    {
      contentId: buildAssembledContentId(params.unit.unitId, "assessment", params.orderInUnit),
      title: `${params.unitTitle} Unit Assessment`,
      grade: params.gradeLevel,
      subject: params.subject,
      contentType: "assessment",
      status: "draft",
      version: new Date().toISOString().slice(0, 10),
      unitId: params.unit.unitId,
      orderInUnit: params.orderInUnit,
      lessonType: "assessment",
      payload: {
        title: `${params.unitTitle} Unit Assessment`,
        grade: params.gradeLevel,
        subject: params.subject,
        objectives: [
          `Demonstrate mastery of the ${params.unitTitle} unit.`,
          "Apply key concepts independently.",
        ],
        body: standardizeTone(
          liberianize(
            `This unit assessment measures student understanding of ${params.unitTitle}. Students should answer each question carefully, show their reasoning where needed, and review their work before submission.`
          ),
          params.gradeLevel
        ),
        activities: [],
        assessmentQuestions,
        answerKey,
        rubric,
        masteryChecks,
        estimatedMinutes: 45,
        moeAlignments: params.standardCodes,
        approvalStatus: "DRAFT",
        createdByRole: "ADMIN",
        createdByUserId: params.createdById,
        metadata: {
          topic: params.unitTitle,
          locale: "LR",
          generatedAt: generatedAt.toISOString(),
          source: "unit_assembly",
          unitTitle: params.unit.name,
        },
      } as any,
      moeAlignments: params.standardCodes as any,
      schoolId: params.unit.schoolId,
    },
    {
      revisionKind: "ORIGINAL_GENERATION",
      originKind: "DETERMINISTIC_GENERATED",
      actorUserId: params.createdById,
      authorUserId: params.createdById,
      generatorName: "unitAssessmentAssembler",
      generatorVersion: "1.0.0",
      generatedAt,
      requestedCompleteness: "VERIFIED",
      auditAction: "curriculum.revision.unit_assessment_generated",
      idempotencyKey: `unit-assessment:${params.unit.id}:${params.orderInUnit}`,
      schoolId: params.unit.schoolId,
    },
  );
  if (write.revision) {
    await appendCurriculumGovernanceEvent({
      contentId: write.content.contentId,
      revisionId: write.revision.id,
      eventType: "APPROVED",
      actorType: "USER",
      actorUserId: params.createdById,
      approvalBasis: "ROLE_POLICY",
      reviewAuthority: "SCHOOL",
      reviewerRoleSnapshot: "ADMIN",
      idempotencyKey: `unit-assessment-approve:${params.unit.id}:${params.orderInUnit}`,
      schoolId: params.unit.schoolId,
    });
  }
  return provenanceWritersEnabled()
    ? prisma.curriculumContent.findUniqueOrThrow({ where: { id: write.content.id } })
    : write.content;
}

function selectExistingLessons(
  lessons: ExistingLesson[],
  params: {
    unitTitle: string;
    unitDescription: string;
    blueprint: z.infer<typeof BlueprintSchema>;
  }
) {
  const used = new Set<string>();
  const selections: Array<ExistingLesson | null> = Array.from(
    { length: LESSON_TYPE_ORDER.length },
    () => null
  );

  const introTokens = tokenize(
    `${params.unitTitle} ${params.unitDescription} ${params.blueprint.introObjective}`
  );
  selections[0] = pickLesson(lessons, used, introTokens, "intro", true);

  params.blueprint.coreObjectives.forEach((objective, index) => {
    const coreTokens = tokenize(`${params.unitTitle} ${params.unitDescription} ${objective}`);
    selections[index + 1] = pickLesson(lessons, used, coreTokens, "core", false);
  });

  const practiceTokens = tokenize(
    `${params.unitTitle} ${params.unitDescription} ${params.blueprint.practiceFocus}`
  );
  selections[4] = pickLesson(lessons, used, practiceTokens, "practice", false);

  const reviewTokens = tokenize(
    `${params.unitTitle} ${params.unitDescription} ${params.blueprint.reviewObjective}`
  );
  selections[5] = pickLesson(lessons, used, reviewTokens, "review", true);

  const assessmentTokens = tokenize(`${params.unitTitle} ${params.unitDescription} assessment`);
  selections[6] = pickLesson(lessons, used, assessmentTokens, "assessment", false);

  return selections;
}

function pickLesson(
  lessons: ExistingLesson[],
  used: Set<string>,
  targetTokens: string[],
  desiredType: (typeof LESSON_TYPE_ORDER)[number],
  allowGeneralFallback: boolean
) {
  const scored = lessons
    .filter((lesson) => !used.has(lesson.id))
    .map((lesson) => ({ lesson, score: scoreLesson(lesson, targetTokens, desiredType) }))
    .sort((left, right) => right.score - left.score);

  const best = scored.find((entry) => entry.score > 0);
  if (best) {
    used.add(best.lesson.id);
    return best.lesson;
  }

  if (!allowGeneralFallback) {
    // ACCEPTABLE NULL - return type includes null.
    return null;
  }

  const fallback = lessons
    .filter((lesson) => !used.has(lesson.id))
    .map((lesson) => ({ lesson, score: scoreTokenOverlap(tokenize(extractLessonSearchText(lesson)), targetTokens) }))
    .sort((left, right) => right.score - left.score)[0];

  if (!fallback || fallback.score <= 0) {
    // ACCEPTABLE NULL - return type includes null.
    return null;
  }

  used.add(fallback.lesson.id);
  return fallback.lesson;
}

function scoreLesson(
  lesson: ExistingLesson,
  targetTokens: string[],
  desiredType: (typeof LESSON_TYPE_ORDER)[number]
) {
  const text = extractLessonSearchText(lesson);
  const tokens = tokenize(text);
  const overlap = scoreTokenOverlap(tokens, targetTokens);
  const keywords = keywordBias(text, lesson.contentType, desiredType);
  return overlap + keywords;
}

function keywordBias(text: string, contentType: string, desiredType: string) {
  const normalized = text.toLowerCase();
  if (desiredType === "assessment") {
    return contentType === "assessment" || /assessment|quiz|test|exam/.test(normalized)
      ? 6
      : 0;
  }
  if (desiredType === "practice" && /practice|exercise|worksheet|problem set/.test(normalized)) {
    return 5;
  }
  if (desiredType === "review" && /review|recap|summary|revision/.test(normalized)) {
    return 5;
  }
  if (desiredType === "intro" && /intro|introduction|overview|foundation|basics/.test(normalized)) {
    return 5;
  }
  if (desiredType === "core" && !/review|assessment|practice|quiz|test/.test(normalized)) {
    return 2;
  }
  return 0;
}

function scoreTokenOverlap(candidateTokens: string[], targetTokens: string[]) {
  if (candidateTokens.length === 0 || targetTokens.length === 0) {
    return 0;
  }

  const candidateSet = new Set(candidateTokens);
  let score = 0;
  for (const token of targetTokens) {
    if (candidateSet.has(token)) {
      score += 1;
    }
  }
  return score;
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function extractLessonTitle(lesson: ExistingLesson) {
  return typeof lesson.payload?.title === "string"
    ? lesson.payload.title
    : lesson.contentId;
}

function extractLessonSearchText(lesson: ExistingLesson) {
  const objectives = Array.isArray(lesson.payload?.objectives)
    ? lesson.payload.objectives.join(" ")
    : "";
  const activities = Array.isArray(lesson.payload?.activities)
    ? lesson.payload.activities.join(" ")
    : "";
  const questions = Array.isArray(lesson.payload?.assessmentQuestions)
    ? lesson.payload.assessmentQuestions.join(" ")
    : "";

  return [
    extractLessonTitle(lesson),
    typeof lesson.payload?.body === "string" ? lesson.payload.body : "",
    objectives,
    activities,
    questions,
  ]
    .filter(Boolean)
    .join(" ");
}

function localizeGeneratedLesson(
  lesson: z.infer<typeof GeneratedLessonSchema>,
  gradeLevel: number
) {
  return {
    ...lesson,
    title: standardizeTone(liberianize(lesson.title), gradeLevel),
    objectives: lesson.objectives.map((objective) =>
      standardizeTone(liberianize(objective), gradeLevel)
    ),
    body: standardizeTone(liberianize(lesson.body), gradeLevel),
    activities: lesson.activities.map((activity) =>
      standardizeTone(liberianize(activity), gradeLevel)
    ),
    assessmentQuestions: lesson.assessmentQuestions.map((question) =>
      standardizeTone(liberianize(question), gradeLevel)
    ),
    answerKey: lesson.answerKey.map((answer) =>
      standardizeTone(liberianize(answer), gradeLevel)
    ),
  };
}

function buildAssembledContentId(unitId: string, lessonType: string, orderInUnit: number) {
  return `unit-${unitId}-${lessonType}-${orderInUnit}-${slugify(new Date().toISOString())}`;
}

function getObjectiveForSlot(
  lessonType: (typeof LESSON_TYPE_ORDER)[number],
  index: number,
  blueprint: z.infer<typeof BlueprintSchema>
) {
  if (lessonType === "intro") {
    return blueprint.introObjective;
  }
  if (lessonType === "practice") {
    return blueprint.practiceFocus;
  }
  if (lessonType === "review") {
    return blueprint.reviewObjective;
  }
  return blueprint.coreObjectives[Math.max(0, index - 1)] ?? blueprint.coreObjectives[0];
}

function parseJson<T>(raw: string, schema: z.ZodType<T>, label: string) {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`AI returned invalid JSON for ${label}`);
  }

  return schema.parse(parsed);
}
