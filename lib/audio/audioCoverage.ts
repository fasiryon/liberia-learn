import { isLessonAudioIntegrityCurrent } from "@/lib/audio/lessonAudioIntegrity";
import { selectStudentLessonAudioText } from "@/lib/curriculum/studentLessonProjection";

export type AudioCoverageLesson = {
  contentId: string;
  grade: number;
  subject: string;
  version: string;
  payload: unknown;
  audioAssets: Array<{ status: string; contentVersion: string; audioParts?: unknown }>;
};

export type AudioCoverageSummary = {
  eligible: number;
  ready: number;
  missing: number;
  stale: number;
  failed: number;
  optedOut: number;
  excluded: number;
};

function audioOptedOut(payload: unknown): boolean {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      (payload as Record<string, unknown>).audioOptOut === true,
  );
}

export function classifyAudioCoverage(lesson: AudioCoverageLesson) {
  if (audioOptedOut(lesson.payload)) return "optedOut" as const;
  const sourceText = selectStudentLessonAudioText(lesson.payload);
  const current = lesson.audioAssets.find((audio) => audio.contentVersion === lesson.version);
  if (!current || !sourceText) return "missing" as const;
  if (current.status === "FAILED") return "failed" as const;
  if (current.status !== "GENERATED") return "missing" as const;
  return isLessonAudioIntegrityCurrent(current.audioParts, sourceText) ? "ready" as const : "stale" as const;
}

export function summarizeAudioCoverage(lessons: AudioCoverageLesson[]): AudioCoverageSummary {
  const summary: AudioCoverageSummary = {
    eligible: 0,
    ready: 0,
    missing: 0,
    stale: 0,
    failed: 0,
    optedOut: 0,
    excluded: 0,
  };
  for (const lesson of lessons) {
    const status = classifyAudioCoverage(lesson);
    if (status === "optedOut") summary.optedOut++;
    else {
      summary.eligible++;
      summary[status]++;
    }
  }
  return summary;
}
