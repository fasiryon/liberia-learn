import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { routedCompletion } from "@/lib/ai/router";
import { buildPrompt, getPromptMetadata, getSystemPrompt } from "@/lib/ai/promptRegistry";
import { curriculumFramework } from "@/lib/curriculum/framework";
import { generateMediaArtifactsBestEffort } from "@/lib/curriculum/mediaGeneration";

export const ELITE_QUALITY_WEIGHTS = {
  clarity: 15,
  structure: 10,
  objectives: 10,
  examples: 10,
  practice: 10,
  assessment: 10,
  misconception: 10,
  application: 10,
  transfer: 10,
  teacher: 5,
  student: 5,
} as const;

export const ELITE_QUALITY_CRITERIA = Object.keys(
  ELITE_QUALITY_WEIGHTS
) as EliteQualityCriterion[];

export type EliteQualityCriterion = keyof typeof ELITE_QUALITY_WEIGHTS;

export type EliteQualityTier = "ELITE" | "STRONG" | "ADEQUATE" | "WEAK" | "REJECT";

export type EliteQualityScore = {
  criteria: Record<EliteQualityCriterion, number>;
  weighted: Record<EliteQualityCriterion, number>;
  overall: number;
  total: number;
  tier: EliteQualityTier;
  weakCategories: EliteQualityCriterion[];
  evidence: string[];
};

type CreateEliteUpgradeDraftInput = {
  contentId: string;
  userId: string;
  schoolId?: string | null;
};

const SectionSchema = z
  .object({
    type: z.enum([
      "introduction",
      "explanation",
      "worked_examples",
      "guided_practice",
      "independent_practice",
      "assessment",
      "misconceptions",
      "real_world_application",
      "summary",
    ]),
    content: z.string().optional(),
    examples: z.array(z.unknown()).optional(),
    questions: z.array(z.unknown()).optional(),
    items: z.array(z.unknown()).optional(),
  })
  .passthrough();

const QualityScoreSchema = z.object(
  Object.fromEntries(
    [...ELITE_QUALITY_CRITERIA, "total"].map((key) => [key, z.number()])
  ) as Record<EliteQualityCriterion | "total", z.ZodNumber>
);

const EliteUpgradeResponseSchema = z.object({
  lesson: z.object({
    title: z.string().min(3),
    objectives: z.array(z.string().min(5)).min(1),
    sections: z.array(SectionSchema).min(1),
    teacher_notes: z.string().min(1),
    student_notes: z.string().min(1),
  }),
  quality_score: QualityScoreSchema,
  improvement_summary: z.object({
    strengths: z.array(z.string()).default([]),
    weaknesses: z.array(z.string()).default([]),
    what_was_improved: z.array(z.string()).default([]),
  }),
});

export type EliteUpgradeResponse = z.infer<typeof EliteUpgradeResponseSchema>;

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|;/g)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.values(record).flatMap(toStringArray);
  }
  return [];
}

function clampTen(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

function scoreTier(total: number): EliteQualityTier {
  if (total >= 90) return "ELITE";
  if (total >= 80) return "STRONG";
  if (total >= 70) return "ADEQUATE";
  if (total >= 60) return "WEAK";
  return "REJECT";
}

function normalizeEliteQualityScore(
  raw: Record<EliteQualityCriterion | "total", number>
): EliteQualityScore {
  const criteria = Object.fromEntries(
    ELITE_QUALITY_CRITERIA.map((criterion) => [criterion, clampTen(Number(raw[criterion]))])
  ) as Record<EliteQualityCriterion, number>;
  const weighted = Object.fromEntries(
    ELITE_QUALITY_CRITERIA.map((criterion) => [
      criterion,
      Math.round((criteria[criterion] / 10) * ELITE_QUALITY_WEIGHTS[criterion]),
    ])
  ) as Record<EliteQualityCriterion, number>;
  const total = Math.max(
    0,
    Math.min(
      100,
      Math.round(ELITE_QUALITY_CRITERIA.reduce((sum, criterion) => sum + weighted[criterion], 0))
    )
  );
  const weakCategories = ELITE_QUALITY_CRITERIA.filter(
    (criterion) => criteria[criterion] < 9
  );

  return {
    criteria,
    weighted,
    overall: total,
    total,
    tier: scoreTier(total),
    weakCategories,
    evidence: ELITE_QUALITY_CRITERIA.map(
      (criterion) =>
        `${criterion}: ${criteria[criterion]}/10, weight ${ELITE_QUALITY_WEIGHTS[criterion]}, contribution ${weighted[criterion]}`
    ),
  };
}

function presenceScore(payload: Record<string, any>, fields: string[]) {
  const present = fields.filter((field) => {
    const value = payload[field];
    if (Array.isArray(value)) return value.filter(Boolean).length > 0;
    return typeof value === "string" && value.trim().length > 0;
  }).length;
  return clampTen((present / fields.length) * 10);
}

function textOf(payload: Record<string, any>) {
  return [
    payload.title,
    ...toStringArray(payload.objectives),
    payload.body,
    payload.body_standard,
    payload.body_block,
    ...toStringArray(payload.activities),
    ...toStringArray(payload.assessmentQuestions ?? payload.assessment),
    ...toStringArray(payload.workedExamples),
    ...toStringArray(payload.guidedPractice),
    ...toStringArray(payload.independentPractice),
    ...toStringArray(payload.formativeChecks),
    ...toStringArray(payload.commonMisconceptions),
    ...toStringArray(payload.teacherNotes ?? payload.teacher_notes),
    payload.studentNotes ?? payload.student_notes,
    payload.realWorldApplication,
    payload.careerConnection,
  ]
    .filter((entry) => typeof entry === "string")
    .join("\n")
    .toLowerCase();
}

export function scoreLessonQuality(input: unknown): EliteQualityScore {
  const payload = asObject(input);
  const lessonText = textOf(payload);
  const wordCount = lessonText.split(/\s+/).filter(Boolean).length;
  const workedExamples = toStringArray(payload.workedExamples);
  const guidedPractice = toStringArray(payload.guidedPractice);
  const independentPractice = toStringArray(payload.independentPractice);
  const assessment = toStringArray(payload.assessmentQuestions ?? payload.assessment);
  const misconceptions = toStringArray(payload.commonMisconceptions);
  const teacherNotes = toStringArray(payload.teacherNotes ?? payload.teacher_notes);

  return normalizeEliteQualityScore({
    clarity: clampTen(
      presenceScore(payload, ["title", "objectives", "body"]) * 0.55 +
        (lessonText.includes("example") ? 1.5 : 0) +
        (lessonText.includes("summary") || lessonText.includes("closing") ? 1.5 : 0) +
        (wordCount >= 300 ? 1.5 : Math.min(1.5, wordCount / 200))
    ),
    structure: clampTen(
      (lessonText.includes("introduction") || lessonText.includes("opening") ? 1.5 : 0) +
        (lessonText.includes("explanation") || lessonText.includes("direct instruction") ? 2 : 0) +
        (lessonText.includes("guided") ? 2 : 0) +
        (lessonText.includes("independent") ? 2 : 0) +
        (lessonText.includes("summary") || lessonText.includes("closing") ? 2.5 : 0)
    ),
    objectives: clampTen(Math.min(10, toStringArray(payload.objectives).length * 3.2)),
    examples: clampTen(Math.min(10, workedExamples.length * 4 + (lessonText.includes("step") ? 2 : 0))),
    practice: clampTen(Math.min(10, guidedPractice.length * 3 + independentPractice.length * 3)),
    assessment: clampTen(
      Math.min(10, assessment.length * 2.5 + (lessonText.includes("explain") ? 2 : 0))
    ),
    misconception: clampTen(Math.min(10, misconceptions.length * 5)),
    application: clampTen(
      (String(payload.realWorldApplication ?? "").length > 20 ? 5 : 0) +
        (lessonText.includes("liberia") ||
        lessonText.includes("market") ||
        lessonText.includes("community") ||
        lessonText.includes("farm")
          ? 3
          : 0) +
        (lessonText.includes("apply") ? 2 : 0)
    ),
    transfer: clampTen(
      (lessonText.includes("transfer") || lessonText.includes("why") ? 3 : 0) +
        (lessonText.includes("compare") || lessonText.includes("justify") ? 3 : 0) +
        (lessonText.includes("real-world") || lessonText.includes("real world") ? 2 : 0) +
        (assessment.some((item) => /explain|justify|why/i.test(item)) ? 2 : 0)
    ),
    teacher: clampTen(Math.min(10, teacherNotes.length * 4 + (lessonText.includes("teacher") ? 2 : 0))),
    student: clampTen(
      (lessonText.includes("student") || lessonText.includes("learner") ? 3 : 0) +
        (lessonText.includes("practice") ? 3 : 0) +
        (lessonText.includes("check") ? 2 : 0) +
        (wordCount >= 300 ? 2 : 0)
    ),
    total: 0,
  });
}

export function parseEliteUpgradeResponse(content: string): {
  response: EliteUpgradeResponse;
  qualityScore: EliteQualityScore;
} {
  let text = content.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`AI returned invalid elite upgrade JSON. First 200 chars: ${content.slice(0, 200)}`);
  }

  const response = EliteUpgradeResponseSchema.parse(raw);
  return {
    response,
    qualityScore: normalizeEliteQualityScore(response.quality_score),
  };
}

function gradeBandCode(grade: number): "G1_3" | "G4_6" | "G7_9" | "G10_12" {
  if (grade <= 3) return "G1_3";
  if (grade <= 6) return "G4_6";
  if (grade <= 9) return "G7_9";
  return "G10_12";
}

function buildFrameworkConstraints(subject: string, grade: number): string {
  const subjectMeta = curriculumFramework.subjects.find(
    (entry) => entry.code === subject || entry.title.toLowerCase() === subject.toLowerCase()
  );
  const profile = curriculumFramework.pedagogyMatrix.find(
    (entry) => entry.subjectCode === subjectMeta?.code || entry.subjectCode === subject
  );
  const band = gradeBandCode(grade);
  const pedagogy = profile?.gradeBandProfiles?.[band];

  return JSON.stringify(
    {
      governance: curriculumFramework.governance,
      generationBlueprint: curriculumFramework.generationBlueprint,
      teacherWorkloadGuardrails: curriculumFramework.teacherWorkloadGuardrails,
      lessonSchema: curriculumFramework.lessonSchema,
      assessmentSchema: curriculumFramework.assessmentSchema,
      subject: subjectMeta
        ? {
            code: subjectMeta.code,
            title: subjectMeta.title,
            description: subjectMeta.description,
            family: subjectMeta.family,
            weicFocus: subjectMeta.weicFocus,
          }
        : { code: subject, title: subject },
      gradeBand: {
        code: band,
        focus: curriculumFramework.gradeBands.find((entry) => entry.code === band)?.pedagogicalFocus ?? [],
        pedagogy,
      },
    },
    null,
    2
  );
}

function qualityRubric() {
  return JSON.stringify(
    {
      weights: ELITE_QUALITY_WEIGHTS,
      interpretation: {
        "90-100": "ELITE",
        "80-89": "STRONG",
        "70-79": "ADEQUATE",
        "60-69": "WEAK",
        "<60": "REJECT",
      },
      categoryScale: "Each category score is 0-10. Total is weighted 0-100.",
    },
    null,
    2
  );
}

function sectionOf(response: EliteUpgradeResponse, type: string) {
  return response.lesson.sections.find((section) => section.type === type);
}

function sectionText(response: EliteUpgradeResponse, type: string) {
  const section = sectionOf(response, type);
  return typeof section?.content === "string" ? section.content.trim() : "";
}

function sectionList(response: EliteUpgradeResponse, type: string, key: "examples" | "questions" | "items") {
  const section = sectionOf(response, type);
  return toStringArray(section?.[key]);
}

function normalizeUpgradePayload(
  sourcePayload: Record<string, any>,
  upgrade: EliteUpgradeResponse,
  source: { contentId: string; version: string | null; grade: number; subject: string }
): Record<string, any> {
  const workedExamples = sectionList(upgrade, "worked_examples", "examples");
  const guidedPractice = sectionList(upgrade, "guided_practice", "questions");
  const independentPractice = sectionList(upgrade, "independent_practice", "questions");
  const assessmentQuestions = sectionList(upgrade, "assessment", "questions");
  const commonMisconceptions = sectionList(upgrade, "misconceptions", "items");
  const body = [
    sectionText(upgrade, "introduction"),
    sectionText(upgrade, "explanation"),
    workedExamples.length ? `Worked examples:\n${workedExamples.join("\n")}` : "",
    guidedPractice.length ? `Guided practice:\n${guidedPractice.join("\n")}` : "",
    independentPractice.length ? `Independent practice:\n${independentPractice.join("\n")}` : "",
    commonMisconceptions.length ? `Misconceptions:\n${commonMisconceptions.join("\n")}` : "",
    sectionText(upgrade, "real_world_application"),
    sectionText(upgrade, "summary"),
  ]
    .filter(Boolean)
    .join("\n\n");

  const media = generateMediaArtifactsBestEffort({
    sourceLessonId: `${source.contentId}-elite-upgrade`,
    subject: source.subject,
    grade: source.grade,
    unitTitle: String(sourcePayload.unitTitle ?? sourcePayload.metadata?.topic ?? upgrade.lesson.title),
    lessonTitle: upgrade.lesson.title,
    objective: upgrade.lesson.objectives[0] ?? upgrade.lesson.title,
    teacherExplanation: body,
    workedExamples,
    guidedPractice,
    groupWorkTask:
      guidedPractice[0] ??
      `Students apply ${upgrade.lesson.title} in pairs and explain their reasoning.`,
    guardianSupportNote:
      sourcePayload.guardianSupportNote ??
      `Ask your child to explain the main idea from ${upgrade.lesson.title} and show one example.`,
    homePracticeSuggestion:
      sourcePayload.homePracticeSuggestion ??
      `Review one short task connected to ${upgrade.lesson.title} at home.`,
    realWorldApplication: sectionText(upgrade, "real_world_application"),
    digitalConnection:
      sourcePayload.digitalConnection ??
      "If devices exist, use a simple digital practice task; otherwise keep the activity fully offline.",
    materialsNeeded: Array.isArray(sourcePayload.materialsNeeded)
      ? sourcePayload.materialsNeeded.map(String)
      : ["board", "paper", "exercise books"],
  });

  return {
    ...sourcePayload,
    title: upgrade.lesson.title,
    grade: source.grade,
    subject: source.subject,
    objectives: upgrade.lesson.objectives,
    body,
    body_standard: body,
    activities: guidedPractice,
    assessmentQuestions,
    workedExamples,
    guidedPractice,
    independentPractice,
    formativeChecks: assessmentQuestions.slice(0, 3),
    commonMisconceptions,
    teacherNotes: toStringArray(upgrade.lesson.teacher_notes),
    studentNotes: upgrade.lesson.student_notes,
    realWorldApplication: sectionText(upgrade, "real_world_application"),
    careerConnection:
      sourcePayload.careerConnection ??
      "Students connect the lesson skill to disciplined reasoning, problem solving, and future work.",
    localContextEnrichment: toStringArray(sourcePayload.localContextEnrichment),
    workforceReadinessEnrichment: [
      "Students practice explaining reasoning, checking accuracy, and applying the concept beyond one example.",
    ],
    approvalStatus: "PENDING_APPROVAL",
    reviewStage: "AI_UPGRADED_DRAFT",
    eliteUpgrade: true,
    visualAssetSpecs: media.visualAssetSpecs,
    audioScriptSpecs: media.audioScriptSpecs,
    slideDeckSpecs: media.slideDeckSpecs,
    videoStoryboardSpecs: media.videoStoryboardSpecs,
    labDefinitionSpecs: media.labDefinitionSpecs,
    mediaGenerationStatus: media.mediaGenerationStatus,
    mediaGenerationErrors: media.mediaGenerationErrors,
    originalImportedVersion: false,
    originalContentReference: {
      contentId: source.contentId,
      version: source.version,
    },
  };
}

async function runEliteUpgradeCompletion(params: {
  source: {
    id: string;
    contentId: string;
    grade: number;
    subject: string;
    title: string | null;
    status: string;
    version: string | null;
    contentType: string;
    moeAlignments: any;
  };
  sourcePayload: Record<string, any>;
  userId: string;
  schoolId?: string | null;
}) {
  const sourceLessonJson = JSON.stringify(
    {
      contentId: params.source.contentId,
      grade: params.source.grade,
      subject: params.source.subject,
      contentType: params.source.contentType,
      status: params.source.status,
      version: params.source.version,
      moeAlignments: params.source.moeAlignments,
      payload: params.sourcePayload,
    },
    null,
    2
  );
  const systemMeta = getPromptMetadata("curriculum.lesson_upgrade_elite_v1.system");
  const userMeta = getPromptMetadata("curriculum.lesson_upgrade_elite_v1.user");
  const completion = await routedCompletion({
    messages: [
      { role: "system", content: getSystemPrompt(systemMeta.key) },
      {
        role: "user",
        content: buildPrompt(userMeta.key, {
          subject: params.source.subject,
          grade: params.source.grade,
          unit: String(params.sourcePayload.unitTitle ?? params.sourcePayload.unit ?? "Current unit"),
          lessonTitle: String(params.sourcePayload.title ?? params.source.title ?? params.source.contentId),
          existing_curriculum_guidelines: [
            buildFrameworkConstraints(params.source.subject, params.source.grade),
            "Quality rubric:",
            qualityRubric(),
          ].join("\n\n"),
          lessonContent: sourceLessonJson,
          objectives: JSON.stringify(toStringArray(params.sourcePayload.objectives)),
          assessment: JSON.stringify(params.sourcePayload.assessment ?? params.sourcePayload.assessmentQuestions ?? []),
          examples: JSON.stringify(params.sourcePayload.workedExamples ?? params.sourcePayload.examples ?? []),
          localContext: JSON.stringify(params.sourcePayload.localContextEnrichment ?? params.sourcePayload.localContext ?? []),
        }),
      },
    ],
    maxTokens: 6000,
    forceSmartTier: true,
    aiUsage: {
      route: "/api/admin/curriculum/upgrade",
      feature: "curriculum",
      schoolId: params.schoolId ?? null,
      userId: params.userId,
      subject: params.source.subject,
      contentId: params.source.contentId,
      promptKey: systemMeta.key,
      promptVersion: systemMeta.version,
      promptHash: systemMeta.hash,
      contentVersion: params.source.version,
      requestType: "elite_curriculum_upgrade",
      metadata: {
        userPromptKey: userMeta.key,
        userPromptVersion: userMeta.version,
        sourceRecordId: params.source.id,
      },
    },
  });

  return {
    ...parseEliteUpgradeResponse(completion.content),
    promptMetadata: [systemMeta, userMeta],
  };
}

async function tryRefineWeakUpgrade(params: {
  firstPass: EliteUpgradeResponse;
  firstScore: EliteQualityScore;
  source: { contentId: string; subject: string; version: string | null };
  userId: string;
  schoolId?: string | null;
}) {
  if (params.firstScore.total >= 90 || params.firstScore.weakCategories.length === 0) {
    return {
      response: params.firstPass,
      qualityScore: params.firstScore,
      refinement: { attempted: false, applied: false },
      promptMetadata: [] as ReturnType<typeof getPromptMetadata>[],
    };
  }

  const systemMeta = getPromptMetadata("curriculum.lesson_upgrade_elite_v1.system");
  const refinementMeta = getPromptMetadata("curriculum.lesson_upgrade_refinement_v1.user");
  try {
    const completion = await routedCompletion({
      messages: [
        { role: "system", content: getSystemPrompt(systemMeta.key) },
        {
          role: "user",
          content: buildPrompt(refinementMeta.key, {
            previousGeneratedLesson: JSON.stringify(params.firstPass, null, 2),
            qualityScore: JSON.stringify(params.firstScore, null, 2),
            weakCategories: params.firstScore.weakCategories.join(", "),
          }),
        },
      ],
      maxTokens: 6000,
      forceSmartTier: true,
      aiUsage: {
        route: "/api/admin/curriculum/upgrade",
        feature: "curriculum",
        schoolId: params.schoolId ?? null,
        userId: params.userId,
        subject: params.source.subject,
        contentId: params.source.contentId,
        promptKey: refinementMeta.key,
        promptVersion: refinementMeta.version,
        promptHash: refinementMeta.hash,
        contentVersion: params.source.version,
        requestType: "elite_curriculum_refinement",
        metadata: {
          systemPromptKey: systemMeta.key,
          weakCategories: params.firstScore.weakCategories,
          firstTotal: params.firstScore.total,
        },
      },
    });
    const refined = parseEliteUpgradeResponse(completion.content);
    return {
      ...refined,
      refinement: {
        attempted: true,
        applied: true,
        previousScore: params.firstScore,
      },
      promptMetadata: [systemMeta, refinementMeta],
    };
  } catch (error: any) {
    return {
      response: params.firstPass,
      qualityScore: params.firstScore,
      refinement: {
        attempted: true,
        applied: false,
        error: error?.message ?? String(error),
        previousScore: params.firstScore,
      },
      promptMetadata: [systemMeta, refinementMeta],
    };
  }
}

export async function createEliteUpgradeDraft(input: CreateEliteUpgradeDraftInput) {
  const source = await prisma.curriculumContent.findUnique({
    where: { contentId: input.contentId },
    select: {
      id: true,
      contentId: true,
      title: true,
      grade: true,
      subject: true,
      contentType: true,
      status: true,
      version: true,
      payload: true,
      moeAlignments: true,
      versionId: true,
    },
  });

  if (!source) {
    throw Object.assign(new Error("Curriculum content not found"), { status: 404 });
  }

  if (source.contentType !== "lesson") {
    throw Object.assign(new Error("Elite upgrade is available for lesson content only"), { status: 400 });
  }

  const sourcePayload = asObject(source.payload);
  const originalScore = scoreLessonQuality({ ...sourcePayload, grade: source.grade, subject: source.subject });
  const firstPass = await runEliteUpgradeCompletion({
    source,
    sourcePayload,
    userId: input.userId,
    schoolId: input.schoolId,
  });
  const refined = await tryRefineWeakUpgrade({
    firstPass: firstPass.response,
    firstScore: firstPass.qualityScore,
    source,
    userId: input.userId,
    schoolId: input.schoolId,
  });
  const upgrade = refined.response;
  const upgradedScore = refined.qualityScore;
  const upgradedPayload = normalizeUpgradePayload(sourcePayload, upgrade, source);
  const scoreDelta = upgradedScore.total - originalScore.total;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const contentId = `${source.contentId}-elite-${timestamp.slice(0, 19).toLowerCase()}`;
  const versionName = `elite-upgrade-${source.contentId}-${timestamp}`;

  const promptChain = [
    ...firstPass.promptMetadata,
    ...refined.promptMetadata,
    ...[
      "curriculum.eliteUpgrade.objectives",
      "curriculum.eliteUpgrade.examples",
      "curriculum.eliteUpgrade.misconceptions",
      "curriculum.eliteUpgrade.assessment",
      "curriculum.eliteUpgrade.teacherSupport",
      "curriculum.eliteUpgrade.localContext",
      "curriculum.eliteUpgrade.workforce",
    ].map(getPromptMetadata),
  ];

  const payloadWithMetadata = {
    ...upgradedPayload,
    upgradeMetadata: {
      kind: "elite_curriculum_upgrade",
      originalContentId: source.contentId,
      originalRecordId: source.id,
      originalVersionId: source.versionId,
      originalVersion: source.version,
      originalSnapshot: sourcePayload,
      upgradedDraftCreatedAt: new Date().toISOString(),
      upgradedByUserId: input.userId,
      promptChain,
      qualityRubric: {
        weights: ELITE_QUALITY_WEIGHTS,
        highestMode: "ELITE",
        interpretation: {
          ELITE: "90-100",
          STRONG: "80-89",
          ADEQUATE: "70-79",
          WEAK: "60-69",
          REJECT: "<60",
        },
      },
      qualityScores: {
        before: originalScore,
        firstPass: firstPass.qualityScore,
        after: upgradedScore,
        delta: scoreDelta,
      },
      improvementSummary: upgrade.improvement_summary,
      improvementsSummary: upgrade.improvement_summary.what_was_improved,
      weakCategories: upgradedScore.weakCategories,
      refinement: refined.refinement,
      governance: {
        preservesOriginalContent: true,
        originalContentId: source.contentId,
        reviewFlow: "CurriculumContent pending_approval -> existing approve/reject routes",
        frameworkVersion: curriculumFramework.governance.curriculumVersion,
      },
    },
  };

  const payloadHash = createHash("sha256")
    .update(JSON.stringify(payloadWithMetadata), "utf8")
    .digest("hex")
    .slice(0, 40);

  const version = await prisma.curriculumVersion.create({
    data: {
      versionName,
      status: "DRAFT",
      createdById: input.userId,
    },
  });

  const draft = await prisma.curriculumContent.create({
    data: {
      contentId,
      title: upgrade.lesson.title,
      grade: source.grade,
      subject: source.subject,
      contentType: source.contentType,
      status: "pending_approval",
      version: versionName,
      payload: payloadWithMetadata,
      moeAlignments: source.moeAlignments ?? [],
      hash: payloadHash,
      versionId: version.id,
    },
  });

  return {
    ok: true,
    originalContentId: source.contentId,
    draftContentId: draft.contentId,
    draftRecordId: draft.id,
    versionName,
    qualityScores: payloadWithMetadata.upgradeMetadata.qualityScores,
    qualityRubric: payloadWithMetadata.upgradeMetadata.qualityRubric,
    weakCategories: upgradedScore.weakCategories,
    refinement: refined.refinement,
    improvementSummary: upgrade.improvement_summary,
    improvementsSummary: upgrade.improvement_summary.what_was_improved,
  };
}
