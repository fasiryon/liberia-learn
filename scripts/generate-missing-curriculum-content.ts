import { config } from "dotenv";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { routedCompletion } from "@/lib/ai/router";
import { buildPrompt, getPromptMetadata, getSystemPrompt } from "@/lib/ai/promptRegistry";
import {
  assertGenerationApproved,
  assertNoDuplicatePlannedLessons,
  buildDraftLessonSkeleton,
  buildMissingCurriculumPlan,
  estimateMissingCurriculumCost,
  validateDraftLessonSkeleton,
  type PlannedMissingLesson,
} from "@/lib/curriculum/missingContentPlan";
import { phase6PersistenceDecision } from "@/lib/curriculum/phase6Persistence";
import {
  type Grade5EnglishTopicBucket,
  isMalformedJsonError,
  phase6ValidationFailures,
  selectBalancedGrade5EnglishTopic,
  shouldRetryTitleCollision,
  topicDistribution,
} from "@/lib/curriculum/phase6GenerationSafety";
import { getYearReadinessReport, mapGeneratedPhase6DraftsToYearPlan } from "@/lib/curriculum/yearPlan";

config({ path: ".env.local" });
config();

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumberArg(flag: string) {
  const value = readArg(flag);
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readListArg(flag: string) {
  return readArg(flag)
    ?.split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSubjectArg(subject?: string) {
  if (!subject) return undefined;
  return subject.trim().toUpperCase();
}

function normalizeTitle(title: string): string {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleSimilarity(left: string, right: string) {
  const leftWords = new Set(normalizeTitle(left).split(" ").filter(Boolean));
  const rightWords = new Set(normalizeTitle(right).split(" ").filter(Boolean));
  if (leftWords.size === 0 || rightWords.size === 0) return 0;
  const intersection = [...leftWords].filter((word) => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  return intersection / union;
}

function extractJsonObject(raw: string) {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response did not contain a JSON object");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

async function repairJsonOutput(input: {
  raw: string;
  lesson: PlannedMissingLesson;
  promptMetadata: ReturnType<typeof getPromptMetadata>;
}) {
  return routedCompletion({
    forceSmartTier: true,
    maxTokens: 6000,
    messages: [
      {
        role: "system",
        content: "You repair malformed JSON for LiberiaLearn curriculum generation. Return ONLY valid JSON. No markdown. No prose outside JSON.",
      },
      {
        role: "user",
        content: [
          "Repair this invalid model output into valid JSON matching this exact schema:",
          "{",
          '  "title": "string",',
          '  "learningObjectives": ["string", "string", "string"],',
          '  "content": "string",',
          '  "assessmentQuestions": [{ "question": "string", "type": "recall|comprehension|application|analysis|open", "expectedAnswer": "string" }],',
          '  "teacherNotesSummary": "string"',
          "}",
          "Do not change lesson content meaning unless needed to fix JSON structure.",
          "Invalid raw model output:",
          input.raw,
        ].join("\n"),
      },
    ],
    aiUsage: {
      route: "scripts/generate-missing-curriculum-content",
      feature: "curriculum",
      subject: input.lesson.subject,
      requestType: "elite_curriculum_missing_content_json_repair",
      contentId: input.lesson.plannedContentId,
      promptKey: input.promptMetadata.key,
      promptVersion: input.promptMetadata.version,
      promptHash: input.promptMetadata.hash,
      contentVersion: "phase6-sample-v1",
      metadata: {
        grade: input.lesson.grade,
        weekNumber: input.lesson.weekNumber,
        dayNumber: input.lesson.dayNumber,
        lessonType: input.lesson.lessonType,
        repairAttempt: true,
      },
    },
  });
}

async function repairTitle(input: {
  collidingTitle: string;
  existingTitles: string[];
  lesson: PlannedMissingLesson;
  promptMetadata: ReturnType<typeof getPromptMetadata>;
}) {
  const result = await routedCompletion({
    forceSmartTier: true,
    maxTokens: 500,
    messages: [
      { role: "system", content: "Return ONLY valid JSON. No markdown. No prose outside JSON." },
      {
        role: "user",
        content: [
          `Create one distinct Grade ${input.lesson.grade} ${input.lesson.subject} lesson title for week ${input.lesson.weekNumber} day ${input.lesson.dayNumber}.`,
          `Do not use a title similar to: ${input.existingTitles.slice(-20).join(" | ")}`,
          "Do not start with generic words like Understanding, Introduction, Basics, or Review.",
          "Return JSON: { \"title\": \"specific skill-based title\" }",
        ].join("\n"),
      },
    ],
    aiUsage: {
      route: "scripts/generate-missing-curriculum-content",
      feature: "curriculum",
      subject: input.lesson.subject,
      requestType: "elite_curriculum_missing_content_title_repair",
      contentId: input.lesson.plannedContentId,
      promptKey: input.promptMetadata.key,
      promptVersion: input.promptMetadata.version,
      promptHash: input.promptMetadata.hash,
      contentVersion: "phase6-sample-v1",
      metadata: {
        grade: input.lesson.grade,
        weekNumber: input.lesson.weekNumber,
        dayNumber: input.lesson.dayNumber,
        lessonType: input.lesson.lessonType,
        titleRepairAttempt: true,
      },
    },
  });
  const parsed = extractJsonObject(result.content);
  return { title: String(parsed.title ?? input.collidingTitle), result };
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function validateGeneratedLesson(payload: Record<string, unknown>) {
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const objectives = stringArray(payload.learningObjectives);
  const content = typeof payload.content === "string" ? payload.content.trim() : "";
  const assessmentQuestions = Array.isArray(payload.assessmentQuestions) ? payload.assessmentQuestions : [];
  const teacherNotesSummary = typeof payload.teacherNotesSummary === "string" ? payload.teacherNotesSummary.trim() : "";

  if (title.length < 5) return { passed: false, reason: "missing_title" };
  if (objectives.length < 3) return { passed: false, reason: "too_few_objectives" };
  if (content.length < 3000) return { passed: false, reason: "content_too_short" };
  if (assessmentQuestions.length < 5) return { passed: false, reason: "too_few_assessment_questions" };
  const validQuestions = assessmentQuestions.every(
    (q) => q && typeof q === "object" && typeof (q as Record<string, unknown>).question === "string" && typeof (q as Record<string, unknown>).expectedAnswer === "string"
  );
  if (!validQuestions) return { passed: false, reason: "assessment_questions_missing_fields" };
  if (teacherNotesSummary.length < 40) return { passed: false, reason: "teacher_notes_too_short" };
  return { passed: true, reason: null };
}

function displaySubject(input: string | undefined, storageSubject: string | undefined) {
  return (input ?? storageSubject ?? "").trim().toUpperCase();
}

function topicForLesson(lesson: PlannedMissingLesson, topics: string[] | undefined, index: number) {
  return topics?.[index] ?? `${lesson.subject.replace(/_/g, " ")} Week ${lesson.weekNumber} Day ${lesson.dayNumber} ${lesson.lessonType.toLowerCase()}`;
}

function unitForLesson(lesson: PlannedMissingLesson) {
  return `Grade ${lesson.grade} ${lesson.subject.replace(/_/g, " ")} Week ${lesson.weekNumber}`;
}

async function recordNeedsReviewFailure(input: { lesson: PlannedMissingLesson; reason: string; approved: boolean }) {
  const existing = await prisma.curriculumContent.findUnique({
    where: { contentId: input.lesson.plannedContentId },
    select: { contentId: true, status: true },
  });
  if (existing) return "skipped_existing_protected_content" as const;
  const payload = {
    lessonContent: "",
    teacherGuide: "",
    studentWorksheet: "",
    homeworkSet: "",
    quiz: { questions: [] },
    aiTutorContext: "",
    approvalStatus: "NEEDS_REVIEW",
    generationMetadata: {
      qualityPassed: false,
      qualityFailureReason: input.reason,
      generatedAt: new Date().toISOString(),
      approved: input.approved,
    },
  };
  await prisma.curriculumContent.create({
    data: {
      contentId: input.lesson.plannedContentId,
      title: `${input.lesson.subject.replace(/_/g, " ")} Week ${input.lesson.weekNumber} Day ${input.lesson.dayNumber}`,
      grade: input.lesson.grade,
      subject: input.lesson.subject,
      contentType: "lesson",
      status: "NEEDS_REVIEW",
      version: "phase6-sample-v1",
      unitId: `phase6-g${input.lesson.grade}-${input.lesson.subject.toLowerCase()}`,
      orderInUnit: input.lesson.dayNumber,
      lessonType: input.lesson.lessonType.toLowerCase(),
      teacherCreated: false,
      hash: createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 40),
      payload,
    },
  });
  return "created" as const;
}

function limitPlanToBatch<T extends ReturnType<typeof buildMissingCurriculumPlan>>(plan: T, batchSize: number): T {
  if (plan.lessons.length <= batchSize) return plan;
  const batchLessons = plan.lessons.slice(0, batchSize);
  const batchIds = new Set(batchLessons.map((lesson) => lesson.plannedContentId));
  return {
    ...plan,
    lessons: batchLessons,
    groups: plan.groups
      .map((group) => ({
        ...group,
        plannedLessons: group.plannedLessons.filter((lesson) => batchIds.has(lesson.plannedContentId)),
      }))
      .filter((group) => group.plannedLessons.length > 0),
  };
}

async function assertTitleNotSimilar(input: {
  grade: number;
  subject: string;
  title: string;
  currentContentId?: string;
  generatedInRun?: string[];
}) {
  const existing = await prisma.curriculumContent.findMany({
    where: {
      grade: input.grade,
      subject: input.subject,
      NOT: {
        contentId: {
          startsWith: "draft-phase6-",
        },
      },
    },
    select: { contentId: true, title: true, status: true },
  });
  const candidates = [
    ...existing
      .filter((lesson) => lesson.contentId !== input.currentContentId)
      .map((lesson) => lesson.title)
      .filter((title): title is string => Boolean(title)),
    ...(input.generatedInRun ?? []),
  ];
  const duplicate = candidates.find((title) => titleSimilarity(input.title, title) > 0.7);
  if (duplicate) {
    throw new Error(`Title similarity guard blocked "${input.title}" because it is too similar to "${duplicate}".`);
  }
}

async function existingTitlesForPrompt(input: { grade: number; subject: string; generatedTitles: string[] }) {
  const existing = await prisma.curriculumContent.findMany({
    where: { grade: input.grade, subject: input.subject },
    orderBy: { updatedAt: "desc" },
    take: 25,
    select: { title: true },
  });
  return [
    ...existing.map((lesson) => lesson.title).filter((title): title is string => Boolean(title)),
    ...input.generatedTitles,
  ].slice(-30);
}

async function existingTopicItems(input: { grade: number; subject: string }) {
  const rows = await prisma.curriculumContent.findMany({
    where: {
      grade: input.grade,
      subject: input.subject,
      OR: [
        { status: { in: ["APPROVED", "PUBLISHED"] } },
        { contentId: { startsWith: "draft-phase6-" }, status: { in: ["DRAFT", "NEEDS_REVIEW"] } },
      ],
    },
    orderBy: { updatedAt: "asc" },
    select: { title: true, payload: true },
  });
  return rows.map((row) => ({
    title: row.title,
    content:
      typeof row.payload === "object" && row.payload && "lessonContent" in row.payload
        ? String((row.payload as Record<string, unknown>).lessonContent ?? "")
        : "",
  }));
}

async function generateLesson(
  lesson: PlannedMissingLesson,
  requestedSubject: string | undefined,
  topic: string,
  topicBucket: Grade5EnglishTopicBucket,
  currentTopicDistribution: Record<Grade5EnglishTopicBucket, number>,
  generatedTitles: string[],
  approved: boolean
) {
  const existingTitles = await existingTitlesForPrompt({ grade: lesson.grade, subject: lesson.subject, generatedTitles });
  const systemPrompt = buildPrompt("curriculum.missingContent.v1", {
    grade: lesson.grade,
    subject: displaySubject(requestedSubject, lesson.subject),
  });
  const promptMetadata = getPromptMetadata("curriculum.missingContent.v1");
  const userPrompt = buildPrompt("curriculum.missingContent.user.v1", {
    grade: lesson.grade,
    subject: displaySubject(requestedSubject, lesson.subject),
    topic,
    weekNumber: lesson.weekNumber,
    unit: unitForLesson(lesson),
    dayNumber: lesson.dayNumber,
    lessonType: lesson.lessonType,
    contentId: lesson.plannedContentId,
    gapReason: lesson.reason,
    existingTitles: existingTitles.join(" | "),
  });
  await assertTitleNotSimilar({
    grade: lesson.grade,
    subject: lesson.subject,
    title: topic,
    currentContentId: lesson.plannedContentId,
    generatedInRun: generatedTitles,
  });

  const startedAt = Date.now();
  let result = await routedCompletion({
    forceSmartTier: true,
    maxTokens: 6000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    aiUsage: {
      route: "scripts/generate-missing-curriculum-content",
      feature: "curriculum",
      subject: lesson.subject,
      requestType: "elite_curriculum_missing_content_sample",
      contentId: lesson.plannedContentId,
      promptKey: promptMetadata.key,
      promptVersion: promptMetadata.version,
      promptHash: promptMetadata.hash,
      contentVersion: "phase6-sample-v1",
      metadata: {
        grade: lesson.grade,
        weekNumber: lesson.weekNumber,
        dayNumber: lesson.dayNumber,
        lessonType: lesson.lessonType,
        sampleRun: true,
      },
    },
  });
  const latencyMs = Date.now() - startedAt;
  let repairCostUsd = 0;
  let jsonRepairSucceeded = false;
  let malformedJsonAfterRepair = false;
  let generated: Record<string, unknown>;
  try {
    generated = extractJsonObject(result.content);
  } catch (error) {
    if (!isMalformedJsonError(error)) throw error;
    try {
      const repairResult = await repairJsonOutput({ raw: result.content, lesson, promptMetadata });
      repairCostUsd += repairResult.estimatedCostUSD;
      generated = extractJsonObject(repairResult.content);
      jsonRepairSucceeded = true;
    } catch {
      malformedJsonAfterRepair = true;
      throw new Error("malformed_json_after_repair");
    }
  }
  let title = String(generated.title);
  let titleRetrySucceeded = false;
  try {
    await assertTitleNotSimilar({
      grade: lesson.grade,
      subject: lesson.subject,
      title,
      currentContentId: lesson.plannedContentId,
      generatedInRun: generatedTitles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!shouldRetryTitleCollision(message)) throw error;
    const titleRepair = await repairTitle({ collidingTitle: title, existingTitles, lesson, promptMetadata });
    repairCostUsd += titleRepair.result.estimatedCostUSD;
    title = titleRepair.title;
    generated.title = title;
    generated.content = String(generated.content ?? "").replace(/^LESSON TITLE:\n.*?(\n\n)/s, `LESSON TITLE:\n${title}$1`);
    try {
      await assertTitleNotSimilar({
        grade: lesson.grade,
        subject: lesson.subject,
        title,
        currentContentId: lesson.plannedContentId,
        generatedInRun: generatedTitles,
      });
      titleRetrySucceeded = true;
    } catch {
      throw new Error("title_collision_after_retry");
    }
  }
  const baseQuality = validateGeneratedLesson(generated);
  const validationFailures = phase6ValidationFailures({
    title,
    content: String(generated.content ?? ""),
    topicBucket,
    distribution: currentTopicDistribution,
  });
  const quality = validationFailures.length > 0 ? { passed: false, reason: validationFailures[0] } : baseQuality;
  const draft = buildDraftLessonSkeleton(lesson);
  if (!validateDraftLessonSkeleton(draft)) {
    throw new Error(`Invalid draft skeleton for ${lesson.plannedContentId}`);
  }

  generatedTitles.push(title);
  const payload = {
    ...draft.payload,
    title,
    subjectDisplay: displaySubject(requestedSubject, lesson.subject),
    learningObjectives: stringArray(generated.learningObjectives),
    lessonContent: String(generated.content ?? ""),
    assessmentQuestions: Array.isArray(generated.assessmentQuestions) ? generated.assessmentQuestions : [],
    teacherNotesSummary: String(generated.teacherNotesSummary ?? ""),
    teacherGuide: String(generated.teacherGuide ?? ""),
    studentWorksheet: String(generated.studentWorksheet ?? ""),
    homeworkSet: String(generated.homeworkSet ?? ""),
    aiTutorContext: String(generated.aiTutorContext ?? ""),
    quiz: { questions: Array.isArray(generated.assessmentQuestions) ? generated.assessmentQuestions : [] },
    approvalStatus: "NEEDS_REVIEW",
    generationMetadata: {
      promptKey: promptMetadata.key,
      promptVersion: promptMetadata.version,
      promptHash: promptMetadata.hash,
      routedCompletion: true,
      model: result.model,
      tier: result.tier,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUSD: result.estimatedCostUSD,
      repairCostUSD: repairCostUsd,
      totalEstimatedCostUSD: result.estimatedCostUSD + repairCostUsd,
      latencyMs,
      qualityPassed: quality.passed,
      qualityFailureReason: quality.reason,
      jsonRepairSucceeded,
      malformedJsonAfterRepair,
      titleRetrySucceeded,
      topicBucket,
      validationFailures,
      generatedAt: new Date().toISOString(),
    },
  };

  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 40);
  const writeData = {
    title,
    status: quality.passed ? "DRAFT" : "NEEDS_REVIEW",
    hash,
    payload,
  };
  const existing = await prisma.curriculumContent.findUnique({
    where: { contentId: lesson.plannedContentId },
    select: { contentId: true, status: true },
  });
  const persistenceAction = phase6PersistenceDecision({
    existing,
    approved,
    qualityPassed: quality.passed,
  });

  if (persistenceAction === "created") {
    await prisma.curriculumContent.create({
      data: {
      contentId: lesson.plannedContentId,
      title,
      grade: lesson.grade,
      subject: lesson.subject,
      contentType: "lesson",
      status: quality.passed ? "DRAFT" : "NEEDS_REVIEW",
      version: "phase6-sample-v1",
      unitId: `phase6-g${lesson.grade}-${lesson.subject.toLowerCase()}`,
      orderInUnit: lesson.dayNumber,
      lessonType: lesson.lessonType.toLowerCase(),
      teacherCreated: false,
      hash,
      payload,
      },
    });
  } else if (persistenceAction === "updated_existing_phase6_draft") {
    await prisma.curriculumContent.update({
      where: { contentId: lesson.plannedContentId },
      data: {
        ...writeData,
        updatedAt: new Date(),
      },
    });
  } else {
    console.warn(
      `[PHASE 6] skipped_existing_protected_content ${lesson.plannedContentId} status=${existing?.status ?? "UNKNOWN"} qualityPassed=${quality.passed}`
    );
    throw new Error(
      `Skipped existing protected content ${lesson.plannedContentId}. Existing rows can only be replaced when contentId starts with draft-phase6-, status is DRAFT or NEEDS_REVIEW, generation is approved, and the new lesson passes quality.`
    );
  }

  console.log(`[PHASE 6] ${persistenceAction} ${lesson.plannedContentId}`);
  const mapping = quality.passed
    ? await mapGeneratedPhase6DraftsToYearPlan({ grade: lesson.grade, subject: lesson.subject, contentIds: [lesson.plannedContentId] })
    : { draftMappedLessons: 0 };

  return {
    contentId: lesson.plannedContentId,
    title,
    lessonType: lesson.lessonType,
    status: quality.passed ? "DRAFT" : "NEEDS_REVIEW",
    learningObjectives: stringArray(generated.learningObjectives),
    content: String(generated.content ?? ""),
    assessmentQuestions: Array.isArray(generated.assessmentQuestions) ? generated.assessmentQuestions : [],
    teacherNotesSummary: String(generated.teacherNotesSummary ?? ""),
    trustMetadataLogged: result.inputTokens + result.outputTokens > 0 && result.estimatedCostUSD >= 0,
    costUsd: result.estimatedCostUSD + repairCostUsd,
    latencyMs,
    qualityPassed: quality.passed,
    qualityFailureReason: quality.reason,
    validationFailures,
    topicBucket,
    persistenceAction,
    jsonRepairSucceeded,
    malformedJsonAfterRepair,
    titleRetrySucceeded,
    draftMappedLessons: mapping.draftMappedLessons,
    wordCount: String(generated.content ?? "").trim().split(/\s+/).filter(Boolean).length,
  };
}

function needsReviewFailureFromGeneratedLesson(lesson: Awaited<ReturnType<typeof generateLesson>>) {
  const qualityFailureReason = lesson.qualityFailureReason ?? "unknown_needs_review_reason";
  return {
    contentId: lesson.contentId,
    title: lesson.title,
    lessonType: lesson.lessonType,
    status: lesson.status,
    reason: qualityFailureReason,
    qualityFailureReason,
    parseFailureReason: lesson.malformedJsonAfterRepair ? "malformed_json_after_repair" : null,
    titleCollision: false,
    malformedJsonAfterRepair: lesson.malformedJsonAfterRepair,
    titleCollisionAfterRetry: false,
    persistenceAction: lesson.persistenceAction,
    fromGeneratedLesson: true,
  };
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const estimateCost = hasFlag("--estimate-cost");
  const approved = hasFlag("--approved") || process.env.PHASE6_GENERATION_APPROVED === "true";
  const grade = readNumberArg("--grade");
  const requestedSubject = readArg("--subject");
  const subject = normalizeSubjectArg(requestedSubject);
  const limit = readNumberArg("--limit");
  const batchSize = readNumberArg("--batch-size") ?? 10;
  const resume = hasFlag("--resume");
  const topics = readListArg("--topics");

  assertGenerationApproved({ dryRun, approved });

  const report = await getYearReadinessReport();
  const completedContentIds = resume
    ? (await prisma.curriculumContent.findMany({
        where: {
          ...(grade !== undefined ? { grade } : {}),
          ...(subject ? { subject } : {}),
          contentId: { startsWith: "draft-phase6-" },
        },
        select: { contentId: true },
      })).map((lesson) => lesson.contentId)
    : [];
  const effectiveLimit = limit ?? (!dryRun ? batchSize : undefined);
  const planningLimit = resume && !dryRun ? undefined : effectiveLimit;
  const fullPlan = buildMissingCurriculumPlan(report, {
    grade,
    subject,
    limit: resume && planningLimit !== undefined ? planningLimit + completedContentIds.length : planningLimit,
    batchSize,
    completedContentIds,
  });
  const plan = !dryRun && effectiveLimit !== undefined ? limitPlanToBatch(fullPlan, effectiveLimit) : fullPlan;
  assertNoDuplicatePlannedLessons(plan);

  const costEstimate = estimateCost ? estimateMissingCurriculumCost(plan) : null;
  const groups = plan.groups.map((group) => ({
    grade: group.grade,
    subject: group.subject,
    classification: group.classification,
    readinessPct: group.readinessPct,
    currentLessons: group.currentLessons,
    mappedLessons: group.mappedLessons,
    lessonsNeeded: group.lessonsNeeded,
    plannedLessons: group.plannedLessons.length,
    missingWeeks: group.missingWeeks.length,
  }));

  const output: Record<string, unknown> = {
    action: "phase6_missing_curriculum_dry_run",
    generatedAt: new Date().toISOString(),
    dryRun,
    generatedContent: false,
    databaseWrites: false,
    llmCalls: false,
    approvalRequiredForGeneration: true,
    options: {
      grade,
      subject,
      limit: effectiveLimit,
      batchSize,
      resume,
      topics,
    },
    auditSummary: {
      groupsAudited: report.length,
      strongGroupsSkipped: plan.skippedStrongGroups,
      groupsSelected: plan.groups.length,
      totalMappedLessons: report.reduce((sum, row) => sum + row.mappedLessons, 0),
    },
    totalLessonsToGenerate: plan.lessons.length,
    breakdownByGradeSubject: groups,
    highestPriorityGaps: groups.slice(0, 10),
    samplePlannedContentIds: plan.lessons.slice(0, 15).map((lesson) => lesson.plannedContentId),
    costEstimate,
    suggestedBatchPlan: {
      sample: plan.groups[0]
        ? {
            grade: plan.groups[0].grade,
            subject: plan.groups[0].subject,
            limit: Math.min(10, plan.groups[0].plannedLessons.length),
          }
        : null,
      fullRunFlags: "--approved --batch-size 10 --resume",
      note: "Full generation remains disabled until explicit human approval.",
    },
  };

  if (!dryRun) {
    if (!grade || !subject) {
      throw new Error("Grade and subject are required for approved generation.");
    }
    if (!effectiveLimit || effectiveLimit > batchSize) {
      throw new Error("An effective limit no greater than batch size is required for approved generation.");
    }
    if (plan.lessons.length > batchSize) {
      throw new Error("Generation batch guard failed: plan exceeds batch size.");
    }
    if (topics && topics.length !== plan.lessons.length) {
      throw new Error("Topic count must match the approved sample lesson count.");
    }
    const startedAt = Date.now();
    const generatedLessons = [];
    const failedLessons = [];
    const generatedTitles: string[] = [];
    const existingTopicDistribution = topicDistribution(await existingTopicItems({ grade: 5, subject: "ENGLISH" }));
    const runningTopicDistribution = { ...existingTopicDistribution };
    const recentTopicBuckets: Grade5EnglishTopicBucket[] = [];
    for (let index = 0; index < plan.lessons.length; index += 1) {
      const lesson = plan.lessons[index];
      try {
        const selectedTopic = topics?.[index]
          ? {
              topic: topics[index] ?? topicForLesson(lesson, topics, index),
              bucket: selectBalancedGrade5EnglishTopic({
                distribution: runningTopicDistribution,
                recentBuckets: recentTopicBuckets,
                weekNumber: lesson.weekNumber,
                dayNumber: lesson.dayNumber,
              }).bucket,
            }
          : selectBalancedGrade5EnglishTopic({
              distribution: runningTopicDistribution,
              recentBuckets: recentTopicBuckets,
              weekNumber: lesson.weekNumber,
              dayNumber: lesson.dayNumber,
            });
        const generatedLesson = await generateLesson(
          lesson,
          requestedSubject,
          selectedTopic.topic,
          selectedTopic.bucket,
          { ...runningTopicDistribution },
          generatedTitles,
          approved
        );
        generatedLessons.push(generatedLesson);
        runningTopicDistribution[selectedTopic.bucket] += 1;
        recentTopicBuckets.push(selectedTopic.bucket);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const persistenceAction = message === "malformed_json_after_repair"
          ? await recordNeedsReviewFailure({ lesson, reason: message, approved })
          : "skipped_existing_protected_content";
        failedLessons.push({
          contentId: lesson.plannedContentId,
          title: null,
          lessonType: lesson.lessonType,
          status: "NEEDS_REVIEW",
          reason: message,
          qualityFailureReason: message === "malformed_json_after_repair" ? message : null,
          parseFailureReason: message === "malformed_json_after_repair" ? message : null,
          titleCollision: /Title similarity guard blocked/i.test(message),
          malformedJsonAfterRepair: message === "malformed_json_after_repair",
          titleCollisionAfterRetry: message === "title_collision_after_retry",
          persistenceAction,
          fromGeneratedLesson: false,
        });
        console.error(`[PHASE 6] failed ${lesson.plannedContentId}: ${message}`);
      }
    }
    failedLessons.push(...generatedLessons.filter((lesson) => lesson.status === "NEEDS_REVIEW").map(needsReviewFailureFromGeneratedLesson));
    const attemptedLessons = generatedLessons.length + failedLessons.filter((lesson) => !lesson.fromGeneratedLesson).length;
    const qualityPassedCount = generatedLessons.filter((lesson) => lesson.qualityPassed).length;
    const passRate = attemptedLessons > 0 ? qualityPassedCount / attemptedLessons : 1;
    const titleCollisionCount = failedLessons.filter((lesson) => lesson.titleCollision).length;
    const malformedJsonAfterRepairCount = failedLessons.filter((lesson) => lesson.malformedJsonAfterRepair).length;
    const titleCollisionAfterRetryCount = failedLessons.filter((lesson) => lesson.titleCollisionAfterRetry).length;
    const unknownNeedsReviewReasonCount = failedLessons.filter((lesson) => lesson.reason === "unknown_needs_review_reason").length;
    const jsonRepairSuccessCount = generatedLessons.filter((lesson) => lesson.jsonRepairSucceeded).length;
    const titleRetrySuccessCount = generatedLessons.filter((lesson) => lesson.titleRetrySucceeded).length;
    output.action = "phase6_missing_curriculum_sample_generation";
    output.generatedContent = true;
    output.databaseWrites = true;
    output.llmCalls = true;
    output.generatedLessons = generatedLessons;
    output.failedLessons = failedLessons;
    output.topicDistributionBefore = existingTopicDistribution;
    output.topicDistributionAfter = runningTopicDistribution;
    output.newTopicMix = generatedLessons.reduce((counts, lesson) => {
      counts[lesson.topicBucket] = (counts[lesson.topicBucket] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    output.attemptedLessons = attemptedLessons;
    output.titleCollisionCount = titleCollisionCount;
    output.malformedJsonAfterRepairCount = malformedJsonAfterRepairCount;
    output.jsonRepairSuccessCount = jsonRepairSuccessCount;
    output.titleCollisionAfterRetryCount = titleCollisionAfterRetryCount;
    output.titleRetrySuccessCount = titleRetrySuccessCount;
    output.unknownNeedsReviewReasonCount = unknownNeedsReviewReasonCount;
    output.draftMappedLessonsAdded = generatedLessons.reduce((sum, lesson) => sum + lesson.draftMappedLessons, 0);
    output.actualCostUsd = Number(generatedLessons.reduce((sum, lesson) => sum + lesson.costUsd, 0).toFixed(6));
    output.actualTimeSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(1));
    output.qualityGatePassRate = `${qualityPassedCount}/${attemptedLessons}`;
    output.qualityGatePassRatePct = Number((passRate * 100).toFixed(1));
  }

  console.log(JSON.stringify(output, null, 2));

  if (!dryRun) {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[PHASE 6] Missing curriculum generation planning failed", error);
  process.exitCode = 1;
});
