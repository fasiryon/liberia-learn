import type { StudentSkillBadge } from "@/lib/badges/studentBadges";
import type { StudentExamReadiness } from "@/lib/outcomes/examReadiness";

export type PathwayReadinessCategory =
  | "academic"
  | "technical"
  | "STEM"
  | "literacy"
  | "leadership_civic"
  | "vocational_foundation";

export type PathwayReadinessLevel = "emerging" | "developing" | "ready";

export type ExternalPathwayIntegration = {
  providerKey: string;
  status: "not_configured";
  intendedUse: "jobs" | "university" | "training" | "partner";
};

export type PathwayHook = {
  id: string;
  pathwayKey: string;
  label: string;
  category: PathwayReadinessCategory;
  readinessLevel: PathwayReadinessLevel;
  supportingBadges: string[];
  supportingSubjects: string[];
  gaps: string[];
  recommendedNextActions: string[];
  readinessTags: string[];
  skillSignals: string[];
  partnerIntegrationStatus: "placeholder";
  externalIntegrations: ExternalPathwayIntegration[];
};

function readinessLevel(score: number): PathwayReadinessLevel {
  if (score >= 75) return "ready";
  if (score >= 55) return "developing";
  return "emerging";
}

function subjectScore(readiness: StudentExamReadiness, matcher: (subject: string) => boolean): number {
  const scores = readiness.subjects.filter((subject) => matcher(subject.subject)).map((subject) => subject.score);
  if (scores.length === 0) return readiness.readinessScore ?? 0;
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100;
}

function weakSubjectGaps(readiness: StudentExamReadiness, matcher: (subject: string) => boolean): string[] {
  return readiness.subjects
    .filter((subject) => matcher(subject.subject) && subject.score < 70)
    .flatMap((subject) =>
      subject.weakTopics.length > 0
        ? subject.weakTopics.map((topic) => `${subject.subject}: ${topic}`)
        : [`${subject.subject}: raise readiness above 70%`]
    )
    .slice(0, 4);
}

export function buildPathwayHooks(
  readiness: StudentExamReadiness,
  badges: StudentSkillBadge[]
): PathwayHook[] {
  const earnedBadgeIds = new Set(badges.filter((badge) => badge.earned).map((badge) => badge.id));
  const hooks: PathwayHook[] = [];
  const strongSubjects = readiness.strongSubjects;
  const weakSubjects = readiness.weakSubjects;
  const makeIntegration = (intendedUse: ExternalPathwayIntegration["intendedUse"]): ExternalPathwayIntegration => ({
    providerKey: "future-integration",
    status: "not_configured",
    intendedUse,
  });

  const stemScore = subjectScore(readiness, (subject) => /math|science/i.test(subject));
  hooks.push({
    id: "stem-foundation",
    pathwayKey: "stem-foundation",
    label: "STEM foundation",
    category: "STEM",
    readinessLevel: readinessLevel(Math.max(stemScore, earnedBadgeIds.has("fractions-mastery") ? 75 : 0)),
    supportingBadges: badges
      .filter((badge) => badge.earned && ["fractions-mastery", "science-lab-completion"].includes(badge.id))
      .map((badge) => badge.id),
    supportingSubjects: strongSubjects.filter((subject) => /math|science/i.test(subject)),
    gaps: weakSubjectGaps(readiness, (subject) => /math|science/i.test(subject)),
    recommendedNextActions: [
      earnedBadgeIds.has("science-lab-completion") ? "Continue applied science practice" : "Complete a science lab",
      earnedBadgeIds.has("fractions-mastery") ? "Advance to ratio and proportional reasoning" : "Review fractions practice",
    ],
    readinessTags: ["math-readiness", "science-readiness"],
    skillSignals: ["quantitative reasoning", "problem solving", "applied science"],
    partnerIntegrationStatus: "placeholder",
    externalIntegrations: [makeIntegration("training"), makeIntegration("university")],
  });

  const literacyScore = subjectScore(readiness, (subject) => /english|language|literacy|reading/i.test(subject));
  hooks.push({
    id: "literacy-communication",
    pathwayKey: "literacy-communication",
    label: "Literacy and communication",
    category: "literacy",
    readinessLevel: readinessLevel(Math.max(literacyScore, earnedBadgeIds.has("reading-comprehension") ? 75 : 0)),
    supportingBadges: badges.filter((badge) => badge.earned && badge.id === "reading-comprehension").map((badge) => badge.id),
    supportingSubjects: strongSubjects.filter((subject) => /english|language|literacy|reading/i.test(subject)),
    gaps: weakSubjectGaps(readiness, (subject) => /english|language|literacy|reading/i.test(subject)),
    recommendedNextActions: [
      earnedBadgeIds.has("reading-comprehension")
        ? "Practice written explanations from reading passages"
        : "Complete reading comprehension practice",
    ],
    readinessTags: ["reading-readiness", "communication-readiness"],
    skillSignals: ["reading comprehension", "written communication"],
    partnerIntegrationStatus: "placeholder",
    externalIntegrations: [makeIntegration("university"), makeIntegration("training")],
  });

  const technicalScore = subjectScore(readiness, (subject) => /computer|ict|technology|coding/i.test(subject));
  hooks.push({
    id: "digital-skills",
    pathwayKey: "digital-skills",
    label: "Digital skills",
    category: "technical",
    readinessLevel: readinessLevel(Math.max(technicalScore, earnedBadgeIds.has("basic-coding") ? 75 : 0)),
    supportingBadges: badges.filter((badge) => badge.earned && badge.id === "basic-coding").map((badge) => badge.id),
    supportingSubjects: strongSubjects.filter((subject) => /computer|ict|technology|coding/i.test(subject)),
    gaps: earnedBadgeIds.has("basic-coding") ? [] : ["Build evidence in coding or technology practice"],
    recommendedNextActions: [
      earnedBadgeIds.has("basic-coding") ? "Continue coding practice" : "Complete introductory coding practice",
    ],
    readinessTags: ["technology-readiness"],
    skillSignals: ["basic coding", "computational thinking"],
    partnerIntegrationStatus: "placeholder",
    externalIntegrations: [makeIntegration("training"), makeIntegration("jobs")],
  });

  hooks.push({
    id: "academic-progression",
    pathwayKey: "academic-progression",
    label: "Academic progression",
    category: "academic",
    readinessLevel: readinessLevel(readiness.readinessScore ?? 0),
    supportingBadges: badges.filter((badge) => badge.earned && badge.id === "exam-readiness-milestone").map((badge) => badge.id),
    supportingSubjects: strongSubjects,
    gaps: weakSubjects.map((subject) => `${subject}: improve exam readiness`).slice(0, 4),
    recommendedNextActions:
      readiness.recommendedPractice.length > 0
        ? readiness.recommendedPractice
        : ["Continue steady lesson and exam preparation"],
    readinessTags: ["exam-readiness", "academic-readiness"],
    skillSignals: ["subject mastery", "assessment readiness"],
    partnerIntegrationStatus: "placeholder",
    externalIntegrations: [makeIntegration("university")],
  });

  hooks.push({
    id: "leadership-civic",
    pathwayKey: "leadership-civic",
    label: "Leadership and civic readiness",
    category: "leadership_civic",
    readinessLevel: readinessLevel(subjectScore(readiness, (subject) => /civic|social|history|government/i.test(subject))),
    supportingBadges: [],
    supportingSubjects: strongSubjects.filter((subject) => /civic|social|history|government/i.test(subject)),
    gaps: weakSubjectGaps(readiness, (subject) => /civic|social|history|government/i.test(subject)),
    recommendedNextActions: ["Build evidence in civic learning, collaboration, and communication"],
    readinessTags: ["civic-readiness", "leadership-readiness"],
    skillSignals: ["civic understanding", "communication", "collaboration"],
    partnerIntegrationStatus: "placeholder",
    externalIntegrations: [makeIntegration("partner")],
  });

  hooks.push({
    id: "vocational-foundation",
    pathwayKey: "vocational-foundation",
    label: "Vocational foundation",
    category: "vocational_foundation",
    readinessLevel: readinessLevel(
      Math.max(
        readiness.readinessScore ?? 0,
        earnedBadgeIds.has("consistent-lesson-completion") ? 65 : 0,
        earnedBadgeIds.has("science-lab-completion") ? 70 : 0
      )
    ),
    supportingBadges: badges
      .filter((badge) => badge.earned && ["consistent-lesson-completion", "science-lab-completion"].includes(badge.id))
      .map((badge) => badge.id),
    supportingSubjects: strongSubjects,
    gaps: readiness.readinessScore != null && readiness.readinessScore < 65 ? ["Raise overall readiness above 65%"] : [],
    recommendedNextActions: ["Maintain completion consistency and build applied project evidence"],
    readinessTags: ["foundation-readiness", "applied-skills-readiness"],
    skillSignals: ["lesson persistence", "applied practice"],
    partnerIntegrationStatus: "placeholder",
    externalIntegrations: [makeIntegration("training"), makeIntegration("jobs")],
  });

  return hooks.filter(
    (hook) =>
      hook.readinessLevel !== "emerging" ||
      hook.supportingBadges.length > 0 ||
      hook.supportingSubjects.length > 0 ||
      hook.gaps.length > 0
  );
}
