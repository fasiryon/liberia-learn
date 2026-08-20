import { createHash, randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { routedCompletion } from "@/lib/ai/router";
import { buildPrompt, getPromptMetadata, getSystemPrompt } from "@/lib/ai/promptRegistry";
import { curriculumFramework } from "@/lib/curriculum/framework";
import { generateMediaArtifactsBestEffort } from "@/lib/curriculum/mediaGeneration";
import { createCurriculumContent } from "@/lib/curriculum/mutations/repository";
import { appendCurriculumGovernanceEvent } from "@/lib/curriculum/mutations/governanceWriter";

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

const REQUIRED_ELITE_SECTION_TYPES = [
  "introduction",
  "explanation",
  "worked_examples",
  "guided_practice",
  "independent_practice",
  "assessment",
  "misconceptions",
  "real_world_application",
  "summary",
] as const;

const QualityScoreSchema = z.object(
  Object.fromEntries(
    [...ELITE_QUALITY_CRITERIA, "total"].map((key) => [key, z.number()])
  ) as Record<EliteQualityCriterion | "total", z.ZodNumber>
);

const EliteUpgradeResponseSchema = z.object({
  lesson: z.object({
    title: z.string().min(3),
    objectives: z.array(z.string().min(5)).min(1),
    sections: z
      .array(SectionSchema)
      .min(REQUIRED_ELITE_SECTION_TYPES.length)
      .superRefine((sections, ctx) => {
        const seen = new Set<string>();
        for (const requiredType of REQUIRED_ELITE_SECTION_TYPES) {
          const section = sections.find((entry) => entry.type === requiredType);
          if (!section) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Missing required elite lesson section: ${requiredType}`,
            });
            continue;
          }
          seen.add(requiredType);
          if (
            ["introduction", "explanation", "real_world_application", "summary"].includes(requiredType) &&
            (!section.content || section.content.trim().length < 20)
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Section ${requiredType} must contain meaningful content`,
            });
          }
          if (requiredType === "worked_examples" && toStringArray(section.examples).length < 2) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Section worked_examples must contain at least 2 examples",
            });
          }
          if (
            ["guided_practice", "independent_practice"].includes(requiredType) &&
            toStringArray(section.questions).length < 2
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Section ${requiredType} must contain at least 2 questions`,
            });
          }
          if (requiredType === "assessment" && toStringArray(section.questions).length < 3) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Section assessment must contain at least 3 questions",
            });
          }
          if (requiredType === "misconceptions" && toStringArray(section.items).length < 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Section misconceptions must contain at least 1 item",
            });
          }
        }
        if (seen.size !== REQUIRED_ELITE_SECTION_TYPES.length) return;
      }),
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

function stripMarkdownFences(content: string) {
  const text = content.trim();
  if (!text.startsWith("```")) return text;
  return text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

function extractJsonCandidate(content: string) {
  const text = stripMarkdownFences(content);
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1) return text;
  if (lastBrace > firstBrace) return text.slice(firstBrace, lastBrace + 1).trim();
  return text.slice(firstBrace).trim();
}

function parseJsonCandidate(content: string) {
  const direct = stripMarkdownFences(content);
  try {
    return JSON.parse(direct);
  } catch {
    const extracted = extractJsonCandidate(content);
    if (extracted !== direct) {
      return JSON.parse(extracted);
    }
    throw new Error(
      `AI returned invalid elite upgrade JSON. First 200 chars: ${content.slice(0, 200)}`
    );
  }
}

function scoreTier(total: number, weakCategories: EliteQualityCriterion[]): EliteQualityTier {
  if (total >= 90 && weakCategories.length === 0) return "ELITE";
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
    tier: scoreTier(total, weakCategories),
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

function splitInstructionSegments(value: string[]) {
  return value
    .flatMap((entry) => entry.split(/\n|;|•|\. (?=[A-Z])/g))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 12);
}

function splitActionableTeacherNotes(value: string[]) {
  return value
    .flatMap((entry) => entry.split(/\n|;|\u2022/g))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 12);
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

function truncateText(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}\n...[truncated for elite upgrade prompt]`;
}

function truncateList(value: unknown, maxItems: number, maxItemLength = 400) {
  return toStringArray(value)
    .slice(0, maxItems)
    .map((entry) => truncateText(entry, maxItemLength))
    .filter(Boolean);
}

function buildElitePromptSourcePayload(sourcePayload: Record<string, any>) {
  return {
    title: String(sourcePayload.title ?? ""),
    unitTitle: String(sourcePayload.unitTitle ?? sourcePayload.unit ?? ""),
    objectives: truncateList(sourcePayload.objectives, 6, 220),
    body: truncateText(
      sourcePayload.body_standard ?? sourcePayload.body_block ?? sourcePayload.body ?? "",
      6000
    ),
    workedExamples: truncateList(
      sourcePayload.workedExamples ?? sourcePayload.examples,
      4,
      500
    ),
    guidedPractice: truncateList(sourcePayload.guidedPractice, 5, 320),
    independentPractice: truncateList(sourcePayload.independentPractice, 5, 320),
    assessment: truncateList(
      sourcePayload.assessmentQuestions ?? sourcePayload.assessment,
      6,
      320
    ),
    commonMisconceptions: truncateList(sourcePayload.commonMisconceptions, 4, 240),
    teacherNotes: truncateList(sourcePayload.teacherNotes ?? sourcePayload.teacher_notes, 4, 320),
    studentNotes: truncateText(sourcePayload.studentNotes ?? sourcePayload.student_notes ?? "", 500),
    realWorldApplication: truncateText(sourcePayload.realWorldApplication ?? "", 500),
    localContextEnrichment: truncateList(
      sourcePayload.localContextEnrichment ?? sourcePayload.localContext,
      4,
      220
    ),
    materialsNeeded: truncateList(sourcePayload.materialsNeeded, 6, 120),
    metadata: asObject(sourcePayload.metadata),
  };
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
  const teacherText = teacherNotes.join(" ").toLowerCase();
  const teacherSegments = splitActionableTeacherNotes(teacherNotes);
  const teacherMoveCoverage = [
    /model|demonstrat|show on the board|think aloud/i.test(teacherText),
    /check|observe|monitor|circulate|listen for|collect/i.test(teacherText),
    /reteach|scaffold|differentiat|sentence stem|support|prompt/i.test(teacherText),
  ].filter(Boolean).length;
  const studentText = String(payload.studentNotes ?? payload.student_notes ?? "").toLowerCase();
  const assessmentHighOrderCount = assessment.filter((item) =>
    /explain|justify|why|apply|compare|analyze|evaluate|transfer/i.test(item)
  ).length;
  const assessmentScore = clampTen(
    Math.min(
      assessment.length < 4 ? 8.4 : 10,
      assessment.length * 1.6 +
        Math.min(2.5, assessmentHighOrderCount * 0.8) +
        (assessment.length >= 4 ? 1.5 : 0) +
        (assessment.some((item) => /check|exit ticket|formative|evidence/i.test(item)) ? 0.8 : 0)
    )
  );
  const teacherScore = clampTen(
    Math.min(
      teacherSegments.length < 3 || teacherMoveCoverage < 3 ? 8.4 : 10,
      (teacherText.length >= 120 ? 2.5 : Math.min(2.5, teacherText.length / 48)) +
        Math.min(3, teacherSegments.length * 1.2) +
        Math.min(
          2.5,
          (teacherText.match(/ask|model|check|reteach|pair|board|observe|prompt|differentiat|monitor|circulate/g) ?? []).length *
            0.6
        ) +
        (/without special equipment|materials|group|partner|independent/i.test(teacherText) ? 1 : 0) +
        Math.min(1.5, teacherMoveCoverage * 0.5) +
        (lessonText.includes("teacher") ? 1 : 0)
    )
  );

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
    assessment: assessmentScore,
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
        (lessonText.includes("real-world") || lessonText.includes("real world") || lessonText.includes("apply") ? 2 : 0) +
        (assessment.some((item) => /explain|justify|why|apply|transfer/i.test(item)) ? 2 : 0)
    ),
    teacher: teacherScore,
    student: clampTen(
      (studentText.length >= 80 ? 3 : Math.min(3, studentText.length / 27)) +
        (lessonText.includes("student") || lessonText.includes("learner") ? 2 : 0) +
        (lessonText.includes("practice") ? 3 : 0) +
        (lessonText.includes("check") || studentText.includes("check") ? 1 : 0) +
        (wordCount >= 300 ? 1 : 0)
    ),
    total: 0,
  });
}

function lessonResponseToScorablePayload(lesson: Record<string, any>) {
  const sections = Array.isArray(lesson.sections) ? lesson.sections : [];
  const sectionByType = (type: string) =>
    asObject(sections.find((section) => asObject(section).type === type));
  return {
    title: lesson.title,
    objectives: toStringArray(lesson.objectives),
    body: [
      sectionByType("introduction").content,
      sectionByType("explanation").content,
      ...toStringArray(sectionByType("worked_examples").examples),
      ...toStringArray(sectionByType("guided_practice").questions),
      ...toStringArray(sectionByType("independent_practice").questions),
      ...toStringArray(sectionByType("assessment").questions),
      ...toStringArray(sectionByType("misconceptions").items),
      sectionByType("real_world_application").content,
      sectionByType("summary").content,
    ]
      .filter((entry) => typeof entry === "string" && entry.trim())
      .join("\n"),
    workedExamples: toStringArray(sectionByType("worked_examples").examples),
    guidedPractice: toStringArray(sectionByType("guided_practice").questions),
    independentPractice: toStringArray(sectionByType("independent_practice").questions),
    assessmentQuestions: toStringArray(sectionByType("assessment").questions),
    commonMisconceptions: toStringArray(sectionByType("misconceptions").items),
    teacherNotes: toStringArray(lesson.teacher_notes),
    studentNotes: String(lesson.student_notes ?? ""),
    realWorldApplication: String(sectionByType("real_world_application").content ?? ""),
  };
}

function deriveQualityScoreFromLesson(lesson: Record<string, any>) {
  const derived = scoreLessonQuality(lessonResponseToScorablePayload(lesson));
  return {
    ...Object.fromEntries(
      ELITE_QUALITY_CRITERIA.map((criterion) => [criterion, derived.criteria[criterion]])
    ),
    total: derived.total,
  } as Record<EliteQualityCriterion | "total", number>;
}

function deriveImprovementSummaryFromLesson(lesson: Record<string, any>) {
  const scorable = lessonResponseToScorablePayload(lesson);
  const derived = scoreLessonQuality(scorable);
  const strengths = [
    scorable.objectives.length >= 3 ? "Objectives are explicit and instruction-ready." : "",
    scorable.workedExamples.length >= 2 ? "Worked examples are present and visible." : "",
    scorable.guidedPractice.length >= 3 && scorable.independentPractice.length >= 3
      ? "Practice sequence is structured from guided to independent work."
      : "",
    scorable.assessmentQuestions.length >= 3 ? "Assessment evidence is present." : "",
  ].filter(Boolean);
  const weaknesses = derived.weakCategories.map(
    (criterion) => `${criterion} still needs reviewer attention.`
  );
  const whatWasImproved = [
    "Returned lesson content was normalized into the elite upgrade review schema.",
    scorable.realWorldApplication.length >= 20
      ? "Real-world application is explicitly included."
      : "Real-world application remains limited and should be reviewed.",
    scorable.commonMisconceptions.length >= 2
      ? "Misconception handling is visible in the generated lesson."
      : "Misconception handling remains thin and should be reviewed.",
  ];
  return {
    strengths,
    weaknesses,
    what_was_improved: whatWasImproved,
  };
}

function normalizeEliteUpgradeRaw(raw: unknown) {
  const payload = asObject(raw);
  const lesson = asObject(payload.lesson);
  const qualityScoreParse = QualityScoreSchema.safeParse(payload.quality_score);
  const improvementSummaryParse = z
    .object({
      strengths: z.array(z.string()).default([]),
      weaknesses: z.array(z.string()).default([]),
      what_was_improved: z.array(z.string()).default([]),
    })
    .safeParse(payload.improvement_summary);
  return {
    ...payload,
    lesson,
    quality_score: qualityScoreParse.success ? qualityScoreParse.data : deriveQualityScoreFromLesson(lesson),
    improvement_summary: improvementSummaryParse.success
      ? improvementSummaryParse.data
      : deriveImprovementSummaryFromLesson(lesson),
  };
}

export function parseEliteUpgradeResponse(content: string): {
  response: EliteUpgradeResponse;
  qualityScore: EliteQualityScore;
} {
  let raw: unknown;
  try {
    raw = parseJsonCandidate(content);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(
      `AI returned invalid elite upgrade JSON. First 200 chars: ${content.slice(0, 200)}`
    );
  }

  const response = EliteUpgradeResponseSchema.parse(normalizeEliteUpgradeRaw(raw));
  return {
    response,
    qualityScore: normalizeEliteQualityScore(response.quality_score),
  };
}

function isRetriableEliteUpgradeParseError(error: any) {
  const message = error?.message ?? String(error ?? "");
  return error?.name === "ZodError" || /invalid elite upgrade JSON/i.test(message) || /Invalid input:/i.test(message);
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

function labeledBlock(label: string, value: string | string[]) {
  const body = Array.isArray(value) ? value.filter(Boolean).join("\n") : value;
  return body ? `${label}:\n${body}` : "";
}

function buildSectionImprovementSummary(params: {
  sourcePayload: Record<string, any>;
  upgrade: EliteUpgradeResponse;
}) {
  const originalText = textOf(params.sourcePayload);
  const summaries = [
    {
      section: "objectives",
      improvement: `${toStringArray(params.sourcePayload.objectives).length} original objective(s) expanded to ${params.upgrade.lesson.objectives.length} precise objective(s).`,
    },
    {
      section: "explanation",
      improvement: sectionText(params.upgrade, "explanation")
        ? "Explanation is structured as an explicit teaching sequence with clearer concept progression."
        : "Explanation still needs reviewer attention.",
    },
    {
      section: "worked examples",
      improvement: `${sectionList(params.upgrade, "worked_examples", "examples").length} worked example(s) added with visible reasoning.`,
    },
    {
      section: "practice",
      improvement: `${sectionList(params.upgrade, "guided_practice", "questions").length} guided and ${sectionList(params.upgrade, "independent_practice", "questions").length} independent practice task(s) added.`,
    },
    {
      section: "assessment",
      improvement: `${sectionList(params.upgrade, "assessment", "questions").length} assessment question(s) added; explanation/justification demand is ${/explain|justify|why/i.test(sectionList(params.upgrade, "assessment", "questions").join(" ")) ? "present" : "not yet visible"}.`,
    },
    {
      section: "misconceptions",
      improvement: `${sectionList(params.upgrade, "misconceptions", "items").length} misconception item(s) added to prevent common errors.`,
    },
    {
      section: "application",
      improvement:
        sectionText(params.upgrade, "real_world_application") && !originalText.includes("real world")
          ? "Real-world application made explicit for review."
          : "Real-world application retained and clarified.",
    },
  ];
  return summaries;
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
    labeledBlock("Introduction", sectionText(upgrade, "introduction")),
    labeledBlock("Explanation", sectionText(upgrade, "explanation")),
    labeledBlock("Worked examples", workedExamples),
    labeledBlock("Guided practice", guidedPractice),
    labeledBlock("Independent practice", independentPractice),
    labeledBlock("Assessment", assessmentQuestions),
    labeledBlock("Misconceptions", commonMisconceptions),
    labeledBlock("Real-world application", sectionText(upgrade, "real_world_application")),
    labeledBlock("Summary", sectionText(upgrade, "summary")),
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
    sectionImprovements: buildSectionImprovementSummary({ sourcePayload, upgrade }),
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
  generationCorrelationId: string;
}) {
  const promptSourcePayload = buildElitePromptSourcePayload(params.sourcePayload);
  const sourceLessonJson = JSON.stringify(
    {
      contentId: params.source.contentId,
      grade: params.source.grade,
      subject: params.source.subject,
      contentType: params.source.contentType,
      status: params.source.status,
      version: params.source.version,
      moeAlignments: params.source.moeAlignments,
      payload: promptSourcePayload,
    },
    null,
    2
  );
  const systemMeta = getPromptMetadata("curriculum.lesson_upgrade_elite_v1.system");
  const userMeta = getPromptMetadata("curriculum.lesson_upgrade_elite_v1.user");
  const messages = [
    { role: "system" as const, content: getSystemPrompt(systemMeta.key) },
    {
      role: "user" as const,
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
  ];

  const aiUsageBase = {
    route: "/api/admin/curriculum/upgrade",
    feature: "curriculum" as const,
    schoolId: params.schoolId ?? null,
    userId: params.userId,
    subject: params.source.subject,
    contentId: params.source.contentId,
    promptKey: systemMeta.key,
    promptVersion: systemMeta.version,
    promptHash: systemMeta.hash,
    contentVersion: params.source.version,
    requestType: "elite_curriculum_upgrade" as const,
    generationCorrelationId: params.generationCorrelationId,
  };

  let lastInvalidJsonContent = "";
  let lastParseErrorMessage = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const completion = await routedCompletion({
      messages,
      maxTokens: attempt === 0 ? 10000 : 14000,
      forceSmartTier: true,
      aiUsage: {
        ...aiUsageBase,
        metadata: {
          userPromptKey: userMeta.key,
          userPromptVersion: userMeta.version,
          sourceRecordId: params.source.id,
          retryAttempt: attempt,
        },
      },
    });

    try {
      return {
        ...parseEliteUpgradeResponse(completion.content),
        promptMetadata: [systemMeta, userMeta],
        completionModel: completion.model,
      };
    } catch (error: any) {
      if (!isRetriableEliteUpgradeParseError(error)) {
        throw error;
      }
      lastInvalidJsonContent = extractJsonCandidate(completion.content);
      lastParseErrorMessage = error?.message ?? String(error);
      if (attempt === 1) break;
    }
  }

  if (lastInvalidJsonContent) {
    let repairErrorMessage = "";
    for (let repairAttempt = 0; repairAttempt < 2; repairAttempt += 1) {
      const repaired = await routedCompletion({
        messages: [
          { role: "system", content: getSystemPrompt(systemMeta.key) },
          {
            role: "user",
            content: [
              "Repair the following malformed elite curriculum response into strictly valid JSON.",
              "The source may be truncated. Reconstruct only enough to produce one complete schema-valid object.",
              "Keep the same schema with keys lesson, quality_score, and improvement_summary.",
              "lesson must contain title, objectives, sections, teacher_notes, and student_notes.",
              `lesson.sections must include exactly these types: ${REQUIRED_ELITE_SECTION_TYPES.join(", ")}.`,
              "quality_score must be an object containing clarity, structure, objectives, examples, practice, assessment, misconception, application, transfer, teacher, student, and total as numbers.",
              "improvement_summary must be an object containing strengths, weaknesses, and what_was_improved arrays.",
              "Do not wrap the JSON in markdown fences.",
              "Do not include commentary before or after the JSON object.",
              `Parse failure context: ${lastParseErrorMessage || "invalid_json"}`,
              repairAttempt === 0
                ? "Return one complete JSON object only."
                : [
                    "Previous repair output was still invalid or truncated.",
                    "Return a compact but complete lesson to stay within token limits:",
                    "- exactly 3 objectives",
                    "- 2 worked examples",
                    "- 3 guided-practice questions",
                    "- 3 independent-practice questions",
                    "- 4 assessment questions",
                    "- 2 misconception items",
                    "- concise teacher_notes with 3 semicolon-separated actionable moves",
                    "- concise student_notes",
                  ].join("\n"),
              "Return JSON only with no markdown fences or commentary.",
              "",
              lastInvalidJsonContent,
            ].join("\n"),
          },
        ],
        maxTokens: repairAttempt === 0 ? 12000 : 8000,
        forceSmartTier: true,
        aiUsage: {
          ...aiUsageBase,
          requestType: "elite_curriculum_upgrade_json_repair",
          metadata: {
            userPromptKey: userMeta.key,
            userPromptVersion: userMeta.version,
            sourceRecordId: params.source.id,
            repairTriggered: true,
            repairAttempt,
          },
        },
      });

      try {
        return {
          ...parseEliteUpgradeResponse(repaired.content),
          promptMetadata: [systemMeta, userMeta],
          completionModel: repaired.model,
        };
      } catch (error: any) {
        repairErrorMessage = error?.message ?? String(error);
      }
    }

    throw new Error(`Elite upgrade repair output remained invalid. ${repairErrorMessage}`);
  }

  throw new Error("Elite upgrade completion retry exhausted");
}

async function tryRefineWeakUpgrade(params: {
  firstPass: EliteUpgradeResponse;
  firstScore: EliteQualityScore;
  source: { contentId: string; subject: string; version: string | null };
  userId: string;
  schoolId?: string | null;
  generationCorrelationId: string;
  firstPassModel: string;
}) {
  if (params.firstScore.total >= 90 || params.firstScore.weakCategories.length === 0) {
    return {
      response: params.firstPass,
      qualityScore: params.firstScore,
      refinement: { attempted: false, applied: false },
      promptMetadata: [] as ReturnType<typeof getPromptMetadata>[],
      completionModel: params.firstPassModel,
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
        generationCorrelationId: params.generationCorrelationId,
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
      completionModel: completion.model,
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
      completionModel: params.firstPassModel,
    };
  }
}

export async function createEliteUpgradeDraft(input: CreateEliteUpgradeDraftInput) {
  const generationCorrelationId = randomUUID();
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
    generationCorrelationId,
  });
  const firstPassPayload = normalizeUpgradePayload(sourcePayload, firstPass.response, source);
  const firstPassContentScore = scoreLessonQuality(firstPassPayload);
  const refined = await tryRefineWeakUpgrade({
    firstPass: firstPass.response,
    firstScore: firstPassContentScore,
    source,
    userId: input.userId,
    schoolId: input.schoolId,
    generationCorrelationId,
    firstPassModel: firstPass.completionModel,
  });
  const upgrade = refined.response;
  const upgradedPayload = normalizeUpgradePayload(sourcePayload, upgrade, source);
  const upgradedScore = scoreLessonQuality(upgradedPayload);
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
        firstPass: firstPassContentScore,
        after: upgradedScore,
        delta: scoreDelta,
      },
      modelSelfScores: {
        firstPass: firstPass.qualityScore,
        final: refined.qualityScore,
      },
      scoreSource: "platform_content_rubric",
      improvementSummary: upgrade.improvement_summary,
      improvementsSummary: upgrade.improvement_summary.what_was_improved,
      weakCategories: upgradedScore.weakCategories,
      sectionImprovements: upgradedPayload.sectionImprovements,
      goldStandardLesson: upgradedScore.total >= 90 && upgradedScore.weakCategories.length === 0,
      goldStandardCriteria:
        upgradedScore.total >= 90 && upgradedScore.weakCategories.length === 0
          ? "ELITE score from platform content rubric with no hidden weak categories below 9/10."
          : null,
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

  const primaryPrompt = getPromptMetadata("curriculum.lesson_upgrade_elite_v1.system");
  const completionModel = refined.completionModel ?? firstPass.completionModel ?? null;
  const write = await createCurriculumContent(
    {
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
      schoolId: input.schoolId ?? null,
    },
    {
      revisionKind: "AI_UPGRADE",
      originKind: "AI_UPGRADED",
      actorUserId: input.userId,
      authorUserId: input.userId,
      generatorName: "createEliteUpgradeDraft",
      generatorVersion: "1.0.0",
      aiProvider: completionModel ? (completionModel.startsWith("llama") ? "groq" : "openai") : null,
      aiModel: completionModel,
      generatedAt: new Date(),
      generationCorrelationId,
      primaryPromptKey: primaryPrompt.key,
      primaryPromptVersion: primaryPrompt.version,
      primaryPromptHash: primaryPrompt.hash,
      requestedCompleteness: completionModel ? "VERIFIED" : "PARTIAL",
      auditAction: "curriculum.revision.ai_upgrade",
      idempotencyKey: `elite-upgrade:${contentId}`,
      schoolId: input.schoolId ?? null,
    },
  );
  const draft = write.content;
  if (write.revision) {
    await appendCurriculumGovernanceEvent({
      contentId: draft.contentId,
      revisionId: write.revision.id,
      eventType: "SUBMITTED",
      actorType: "USER",
      actorUserId: input.userId,
      idempotencyKey: `elite-upgrade-submit:${contentId}`,
      schoolId: input.schoolId ?? null,
    });
  }

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
