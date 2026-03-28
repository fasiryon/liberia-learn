import type { Prisma } from "@prisma/client";

type Scope = "GLOBAL" | "SCHOOL";

export type CurriculumChunkSeed = {
  sourceType: string;
  sourceId: string;
  title: string;
  content: string;
  subject?: string | null;
  grade?: number | null;
  schoolId?: string | null;
  scope: Scope;
  sourceLabel?: string | null;
  metadata?: Prisma.JsonValue;
};

type StructuredChunkType =
  | "concept"
  | "example"
  | "practice"
  | "teacher_support"
  | "guardian_support"
  | "assessment"
  | "media_support"
  | "lab_support"
  | "simulation_support"
  | "teacher_lab_support"
  | "guardian_lab_support";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function collectLines(value: unknown, prefix?: string): string[] {
  if (typeof value === "string" && value.trim()) {
    return [prefix ? `${prefix}: ${value.trim()}` : value.trim()];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectLines(item, prefix));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, part]) =>
      collectLines(part, prefix ? `${prefix}.${key}` : key)
    );
  }

  return [];
}

function stringifyValue(value: unknown): string | null {
  const lines = collectLines(value);
  if (lines.length > 0) return lines.join("\n");
  return null;
}

function filterRenderableArtifacts(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    if ("approved" in record || "renderStatus" in record) {
      return record.approved === true && record.renderStatus === "ready";
    }
    if ("status" in record) {
      return record.status === "three_d_ready";
    }
    return true;
  });
}

function buildStructuredChunk(params: {
  chunkType: StructuredChunkType;
  lessonTitle: string;
  unitTitle: string | null;
  subject: string;
  grade: number | null;
  unitId: string | null;
  lessonId: string | null;
  conceptTags: string[];
  skillTags: string[];
  difficultyLevel: string | null;
  curriculumVersion: string | null;
  generationBatchId: string | null;
  sourceId: string;
  schoolId: string | null;
  scope: Scope;
  content: string;
  sourceLabel: string | null;
  weicTags: string[];
  waecFlag: boolean;
}) {
  return {
    sourceType: "curriculum_content",
    sourceId: params.sourceId,
    title: `${params.lessonTitle} [${params.chunkType}]`,
    content: params.content,
    subject: params.subject,
    grade: params.grade,
    schoolId: params.schoolId,
    scope: params.scope,
    sourceLabel: params.sourceLabel,
    metadata: {
      chunkType: params.chunkType,
      subject: params.subject,
      gradeLevel: params.grade,
      unitId: params.unitId,
      unitTitle: params.unitTitle,
      lessonId: params.lessonId,
      lessonTitle: params.lessonTitle,
      conceptTags: params.conceptTags,
      skillTags: params.skillTags,
      difficultyLevel: params.difficultyLevel,
      curriculumVersion: params.curriculumVersion,
      generationBatchId: params.generationBatchId,
      waecFlag: params.waecFlag,
      weicTags: params.weicTags,
    },
  } satisfies CurriculumChunkSeed;
}

export function buildCurriculumChunkSeeds(params: {
  sourceId: string;
  sourceLabel: string | null;
  payload: Record<string, unknown>;
  subject: string;
  grade: number | null;
  schoolId: string | null;
  scope: Scope;
}): CurriculumChunkSeed[] {
  const lessonTitle =
    typeof params.payload.title === "string" && params.payload.title.trim()
      ? params.payload.title.trim()
      : params.sourceLabel ?? params.sourceId;
  const unitTitle =
    typeof params.payload.unitTitle === "string" && params.payload.unitTitle.trim()
      ? params.payload.unitTitle.trim()
      : null;
  const unitId =
    typeof params.payload.unitId === "string" && params.payload.unitId.trim()
      ? params.payload.unitId.trim()
      : null;
  const lessonId =
    typeof params.payload.lessonId === "string" && params.payload.lessonId.trim()
      ? params.payload.lessonId.trim()
      : null;
  const weicTags = asStringArray(params.payload.weicTags);
  const conceptTags = asStringArray(params.payload.conceptTags);
  const skillTags = asStringArray(params.payload.skillTags);
  const difficultyLevel =
    typeof params.payload.difficultyLevel === "string" && params.payload.difficultyLevel.trim()
      ? params.payload.difficultyLevel.trim()
      : null;
  const curriculumVersion =
    typeof params.payload.curriculumVersion === "string" && params.payload.curriculumVersion.trim()
      ? params.payload.curriculumVersion.trim()
      : null;
  const generationBatchId =
    typeof params.payload.generationBatchId === "string" && params.payload.generationBatchId.trim()
      ? params.payload.generationBatchId.trim()
      : null;
  const waecAlignment = params.payload.waecAlignment as Record<string, unknown> | undefined;
  const waecFlag =
    waecAlignment?.required === true ||
    typeof waecAlignment?.examStyle === "string" && waecAlignment.examStyle !== "none";

  const sections: Array<{ chunkType: StructuredChunkType; value: unknown }> = [
    { chunkType: "concept", value: [params.payload.objective, params.payload.teacherExplanation, params.payload.body] },
    { chunkType: "example", value: params.payload.workedExamples },
    { chunkType: "practice", value: [params.payload.guidedPractice, params.payload.independentPractice] },
    {
      chunkType: "teacher_support",
      value: [
        params.payload.lessonOpeningRoutine,
        params.payload.classroomActivities,
        params.payload.groupWorkTask,
        params.payload.projectTask,
        params.payload.discussionPrompt,
        params.payload.pacingGuidance,
        params.payload.materialsNeeded,
        params.payload.differentiationNotes,
        params.payload.commonMisconceptions,
        params.payload.teacherNotes,
        params.payload.labDefinitionSpecs,
      ],
    },
    {
      chunkType: "guardian_support",
      value: [
        params.payload.guardianSupportNote,
        params.payload.homePracticeSuggestion,
        params.payload.whatToLookFor,
        params.payload.labDefinitionSpecs,
        filterRenderableArtifacts(params.payload.pseudoLabs),
      ],
    },
    {
      chunkType: "assessment",
      value: [
        params.payload.quickChecks,
        params.payload.practiceSets,
        params.payload.quizzes,
        params.payload.remediationQuizzes,
        params.payload.challengeTasks,
        params.payload.unitTests,
        params.payload.termExams,
        params.payload.waecStyleItems,
      ],
    },
    {
      chunkType: "media_support",
      value: [
        params.payload.realWorldApplication,
        params.payload.careerConnection,
        params.payload.digitalConnection,
        params.payload.visualAssetSpecs,
        params.payload.audioScriptSpecs,
        params.payload.slideDeckSpecs,
        params.payload.videoStoryboardSpecs,
      ],
    },
    {
      chunkType: "lab_support",
      value: [
        params.payload.labDefinitionSpecs,
        params.payload.labs,
        filterRenderableArtifacts(params.payload.pseudoLabs),
      ],
    },
    {
      chunkType: "simulation_support",
      value: [
        filterRenderableArtifacts(params.payload.simulationDefinitions),
      ],
    },
    {
      chunkType: "teacher_lab_support",
      value: [
        filterRenderableArtifacts(params.payload.pseudoLabs),
        filterRenderableArtifacts(params.payload.simulationDefinitions),
      ],
    },
    {
      chunkType: "guardian_lab_support",
      value: [
        filterRenderableArtifacts(params.payload.pseudoLabs),
        filterRenderableArtifacts(params.payload.simulationDefinitions),
      ],
    },
  ];

  return sections
    .map(({ chunkType, value }) => {
      const content = stringifyValue(value);
      if (!content) return null;
      return buildStructuredChunk({
        chunkType,
        lessonTitle,
        unitTitle,
        subject: params.subject,
        grade: params.grade,
        unitId,
        lessonId,
        conceptTags,
        skillTags,
        difficultyLevel,
        curriculumVersion,
        generationBatchId,
        sourceId: params.sourceId,
        schoolId: params.schoolId,
        scope: params.scope,
        content,
        sourceLabel: params.sourceLabel,
        weicTags,
        waecFlag,
      });
    })
    .filter(Boolean) as CurriculumChunkSeed[];
}
