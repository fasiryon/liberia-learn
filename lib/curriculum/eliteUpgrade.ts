import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { routedCompletion } from "@/lib/ai/router";
import { buildPrompt, getPromptMetadata, getSystemPrompt } from "@/lib/ai/promptRegistry";
import { curriculumFramework } from "@/lib/curriculum/framework";
import { generateMediaArtifactsBestEffort } from "@/lib/curriculum/mediaGeneration";

const QUALITY_CRITERIA = [
  "clarity",
  "rigor",
  "sequencing",
  "completeness",
  "ageAppropriateness",
  "assessmentQuality",
  "transferValue",
  "workforceRelevance",
] as const;

export type EliteQualityCriterion = (typeof QUALITY_CRITERIA)[number];

export type EliteQualityScore = {
  criteria: Record<EliteQualityCriterion, number>;
  overall: number;
  evidence: string[];
};

const EliteUpgradeResponseSchema = z.object({
  title: z.string().min(3),
  objectives: z.array(z.string().min(5)).min(1),
  body: z.string().min(100),
  body_standard: z.string().nullable().optional(),
  body_block: z.string().nullable().optional(),
  activities: z.array(z.string()).default([]),
  assessmentQuestions: z.array(z.string()).default([]),
  workedExamples: z.array(z.string()).default([]),
  guidedPractice: z.array(z.string()).default([]),
  independentPractice: z.array(z.string()).default([]),
  formativeChecks: z.array(z.string()).default([]),
  commonMisconceptions: z.array(z.string()).default([]),
  teacherNotes: z.array(z.string()).default([]),
  realWorldApplication: z.string().min(10),
  careerConnection: z.string().min(10),
  localContextEnrichment: z.array(z.string()).default([]),
  workforceReadinessEnrichment: z.array(z.string()).default([]),
  improvementsSummary: z.array(z.string()).min(1),
  qualityRationale: z.record(z.string(), z.string()).default({}),
});

type EliteUpgradeResponse = z.infer<typeof EliteUpgradeResponseSchema>;

type CreateEliteUpgradeDraftInput = {
  contentId: string;
  userId: string;
  schoolId?: string | null;
};

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
    return [value.trim()];
  }
  return [];
}

function textOf(payload: Record<string, any>): string {
  return [
    payload.title,
    ...toStringArray(payload.objectives),
    payload.body,
    payload.body_standard,
    payload.body_block,
    ...toStringArray(payload.activities),
    ...toStringArray(payload.assessmentQuestions),
    ...toStringArray(payload.workedExamples),
    ...toStringArray(payload.guidedPractice),
    ...toStringArray(payload.independentPractice),
    ...toStringArray(payload.formativeChecks),
    ...toStringArray(payload.commonMisconceptions),
    ...toStringArray(payload.teacherNotes),
    payload.realWorldApplication,
    payload.careerConnection,
  ]
    .filter((entry) => typeof entry === "string")
    .join("\n")
    .toLowerCase();
}

function scorePresence(payload: Record<string, any>, fields: string[]): number {
  const count = fields.filter((field) => {
    const value = payload[field];
    if (Array.isArray(value)) return value.filter(Boolean).length > 0;
    return typeof value === "string" && value.trim().length > 0;
  }).length;
  return Math.round((count / fields.length) * 100);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreLessonQuality(input: unknown): EliteQualityScore {
  const payload = asObject(input);
  const lessonText = textOf(payload);
  const wordCount = lessonText.split(/\s+/).filter(Boolean).length;
  const objectives = toStringArray(payload.objectives);
  const assessment = [
    ...toStringArray(payload.assessmentQuestions),
    ...toStringArray(payload.formativeChecks),
    String(payload.body ?? ""),
  ].join(" ").toLowerCase();

  const criteria: Record<EliteQualityCriterion, number> = {
    clarity: clampScore(
      scorePresence(payload, ["title", "objectives", "body"]) * 0.55 +
        (lessonText.includes("objective") ? 15 : 0) +
        (lessonText.includes("example") ? 15 : 0) +
        (lessonText.includes("summary") || lessonText.includes("closing") ? 15 : 0)
    ),
    rigor: clampScore(
      (toStringArray(payload.workedExamples).length >= 2 ? 30 : 10) +
        (toStringArray(payload.independentPractice).length >= 3 ? 25 : 10) +
        (assessment.includes("explain") || assessment.includes("why") ? 20 : 0) +
        (wordCount >= 500 ? 25 : Math.min(25, wordCount / 20))
    ),
    sequencing: clampScore(
      (lessonText.includes("opening") ? 20 : 0) +
        (lessonText.includes("direct instruction") || lessonText.includes("explain") ? 20 : 0) +
        (lessonText.includes("guided") ? 20 : 0) +
        (lessonText.includes("independent") ? 20 : 0) +
        (lessonText.includes("closing") || lessonText.includes("exit") ? 20 : 0)
    ),
    completeness: scorePresence(payload, [
      "objectives",
      "body",
      "activities",
      "assessmentQuestions",
      "teacherNotes",
      "commonMisconceptions",
      "realWorldApplication",
      "careerConnection",
    ]),
    ageAppropriateness: clampScore(
      (typeof payload.grade === "number" ? 25 : 10) +
        (lessonText.includes("grade") ? 15 : 0) +
        (lessonText.includes("clear") || lessonText.includes("simple") ? 20 : 0) +
        (lessonText.includes("teacher") ? 20 : 0) +
        (lessonText.includes("student") || lessonText.includes("learner") ? 20 : 0)
    ),
    assessmentQuality: clampScore(
      (toStringArray(payload.assessmentQuestions).length >= 3 ? 35 : 10) +
        (toStringArray(payload.formativeChecks).length >= 2 ? 25 : 5) +
        (assessment.includes("answer") ? 15 : 0) +
        (assessment.includes("explain") || assessment.includes("evidence") ? 25 : 0)
    ),
    transferValue: clampScore(
      (String(payload.realWorldApplication ?? "").length > 20 ? 35 : 5) +
        (lessonText.includes("apply") || lessonText.includes("transfer") ? 25 : 0) +
        (lessonText.includes("market") ||
        lessonText.includes("farm") ||
        lessonText.includes("community") ||
        lessonText.includes("liberia")
          ? 25
          : 0) +
        (toStringArray(payload.activities).length > 0 ? 15 : 0)
    ),
    workforceRelevance: clampScore(
      (String(payload.careerConnection ?? "").length > 20 ? 45 : 5) +
        (lessonText.includes("career") || lessonText.includes("work") ? 30 : 0) +
        (lessonText.includes("skill") || lessonText.includes("livelihood") ? 25 : 0)
    ),
  };

  const overall = Math.round(
    QUALITY_CRITERIA.reduce((sum, criterion) => sum + criteria[criterion], 0) /
      QUALITY_CRITERIA.length
  );

  const evidence = QUALITY_CRITERIA.map((criterion) => `${criterion}: ${criteria[criterion]}`);
  return { criteria, overall, evidence };
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

  return JSON.stringify({
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
  });
}

function buildUpgradePasses(): string {
  const promptKeys = [
    "curriculum.eliteUpgrade.objectives",
    "curriculum.eliteUpgrade.examples",
    "curriculum.eliteUpgrade.misconceptions",
    "curriculum.eliteUpgrade.assessment",
    "curriculum.eliteUpgrade.teacherSupport",
    "curriculum.eliteUpgrade.localContext",
    "curriculum.eliteUpgrade.workforce",
  ];

  return promptKeys
    .map((key) => {
      const prompt = getPromptMetadata(key);
      return `${prompt.key}@${prompt.version}: ${prompt.preview}`;
    })
    .join("\n");
}

function qualityRubric(): string {
  return QUALITY_CRITERIA.map((criterion) => `${criterion}: 0-100 based on evidence in the upgraded lesson.`).join("\n");
}

function stripCodeFence(content: string): string {
  let text = content.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }
  return text;
}

function normalizeUpgradePayload(
  sourcePayload: Record<string, any>,
  upgrade: EliteUpgradeResponse,
  source: { contentId: string; version: string | null; grade: number; subject: string }
): Record<string, any> {
  const bodyStandard = upgrade.body_standard?.trim() || upgrade.body;
  const bodyBlock = upgrade.body_block?.trim() || sourcePayload.body_block || null;
  const media = generateMediaArtifactsBestEffort({
    sourceLessonId: `${source.contentId}-elite-upgrade`,
    subject: source.subject,
    grade: source.grade,
    unitTitle: String(sourcePayload.unitTitle ?? sourcePayload.metadata?.topic ?? upgrade.title),
    lessonTitle: upgrade.title,
    objective: upgrade.objectives[0] ?? upgrade.title,
    teacherExplanation: upgrade.body,
    workedExamples: upgrade.workedExamples,
    guidedPractice: upgrade.guidedPractice,
    groupWorkTask: upgrade.activities[0] ?? `Students apply ${upgrade.title} in pairs and explain their reasoning.`,
    guardianSupportNote:
      sourcePayload.guardianSupportNote ??
      `Ask your child to explain the main idea from ${upgrade.title} and show one example.`,
    homePracticeSuggestion:
      sourcePayload.homePracticeSuggestion ??
      `Review one short task connected to ${upgrade.title} at home.`,
    realWorldApplication: upgrade.realWorldApplication,
    digitalConnection:
      sourcePayload.digitalConnection ??
      `If devices exist, use a simple digital practice task; otherwise keep the activity fully offline.`,
    materialsNeeded: Array.isArray(sourcePayload.materialsNeeded)
      ? sourcePayload.materialsNeeded.map(String)
      : ["board", "paper", "exercise books"],
  });

  return {
    ...sourcePayload,
    title: upgrade.title,
    grade: source.grade,
    subject: source.subject,
    objectives: upgrade.objectives,
    body: upgrade.body,
    body_standard: bodyStandard,
    ...(bodyBlock ? { body_block: bodyBlock } : {}),
    activities: upgrade.activities,
    assessmentQuestions: upgrade.assessmentQuestions,
    workedExamples: upgrade.workedExamples,
    guidedPractice: upgrade.guidedPractice,
    independentPractice: upgrade.independentPractice,
    formativeChecks: upgrade.formativeChecks,
    commonMisconceptions: upgrade.commonMisconceptions,
    teacherNotes: upgrade.teacherNotes,
    realWorldApplication: upgrade.realWorldApplication,
    careerConnection: upgrade.careerConnection,
    localContextEnrichment: upgrade.localContextEnrichment,
    workforceReadinessEnrichment: upgrade.workforceReadinessEnrichment,
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
  const sourcePromptJson = JSON.stringify(
    {
      contentId: source.contentId,
      grade: source.grade,
      subject: source.subject,
      contentType: source.contentType,
      status: source.status,
      version: source.version,
      moeAlignments: source.moeAlignments,
      payload: sourcePayload,
    },
    null,
    2
  );

  const systemPrompt = getSystemPrompt("curriculum.eliteUpgrade.system");
  const userPrompt = buildPrompt("curriculum.eliteUpgrade.user", {
    frameworkConstraints: buildFrameworkConstraints(source.subject, source.grade),
    upgradePasses: buildUpgradePasses(),
    qualityRubric: qualityRubric(),
    sourceLessonJson: sourcePromptJson,
  });
  const systemMeta = getPromptMetadata("curriculum.eliteUpgrade.system");
  const userMeta = getPromptMetadata("curriculum.eliteUpgrade.user");

  const completion = await routedCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 6000,
    forceSmartTier: true,
    aiUsage: {
      route: "/api/admin/curriculum/upgrade",
      feature: "curriculum",
      schoolId: input.schoolId ?? null,
      userId: input.userId,
      subject: source.subject,
      contentId: source.contentId,
      promptKey: systemMeta.key,
      promptVersion: systemMeta.version,
      promptHash: systemMeta.hash,
      contentVersion: source.version,
      requestType: "elite_curriculum_upgrade",
      metadata: {
        userPromptKey: userMeta.key,
        userPromptVersion: userMeta.version,
        sourceRecordId: source.id,
      },
    },
  });

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(stripCodeFence(completion.content));
  } catch {
    throw new Error(`AI returned invalid elite upgrade JSON. First 200 chars: ${completion.content.slice(0, 200)}`);
  }

  const upgrade = EliteUpgradeResponseSchema.parse(parsedRaw);
  const upgradedPayload = normalizeUpgradePayload(sourcePayload, upgrade, source);
  const upgradedScore = scoreLessonQuality(upgradedPayload);
  const scoreDelta = upgradedScore.overall - originalScore.overall;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const contentId = `${source.contentId}-elite-${timestamp.slice(0, 19).toLowerCase()}`;
  const versionName = `elite-upgrade-${source.contentId}-${timestamp}`;

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
      promptChain: [
        systemMeta,
        userMeta,
        ...[
          "curriculum.eliteUpgrade.objectives",
          "curriculum.eliteUpgrade.examples",
          "curriculum.eliteUpgrade.misconceptions",
          "curriculum.eliteUpgrade.assessment",
          "curriculum.eliteUpgrade.teacherSupport",
          "curriculum.eliteUpgrade.localContext",
          "curriculum.eliteUpgrade.workforce",
        ].map(getPromptMetadata),
      ],
      qualityScores: {
        before: originalScore,
        after: upgradedScore,
        delta: scoreDelta,
      },
      improvementsSummary: upgrade.improvementsSummary,
      qualityRationale: upgrade.qualityRationale,
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
      title: upgrade.title,
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
    improvementsSummary: upgrade.improvementsSummary,
  };
}

