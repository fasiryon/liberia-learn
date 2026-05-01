import type { StudentSkillBadge } from "@/lib/badges/studentBadges";
import type { StudentExamReadiness } from "@/lib/outcomes/examReadiness";

export type PathwayHook = {
  id: string;
  label: string;
  readinessTags: string[];
  skillSignals: string[];
  partnerIntegrationStatus: "placeholder";
};

export function buildPathwayHooks(
  readiness: StudentExamReadiness,
  badges: StudentSkillBadge[]
): PathwayHook[] {
  const earnedBadgeIds = new Set(badges.filter((badge) => badge.earned).map((badge) => badge.id));
  const hooks: PathwayHook[] = [];

  if (readiness.strongSubjects.some((subject) => /math|science/i.test(subject)) || earnedBadgeIds.has("fractions-mastery")) {
    hooks.push({
      id: "stem-foundation",
      label: "STEM foundation",
      readinessTags: ["math-readiness", "science-readiness"],
      skillSignals: ["quantitative reasoning", "problem solving"],
      partnerIntegrationStatus: "placeholder",
    });
  }

  if (earnedBadgeIds.has("reading-comprehension")) {
    hooks.push({
      id: "literacy-communication",
      label: "Literacy and communication",
      readinessTags: ["reading-readiness"],
      skillSignals: ["reading comprehension", "written communication"],
      partnerIntegrationStatus: "placeholder",
    });
  }

  if (earnedBadgeIds.has("basic-coding")) {
    hooks.push({
      id: "digital-skills",
      label: "Digital skills",
      readinessTags: ["technology-readiness"],
      skillSignals: ["basic coding", "computational thinking"],
      partnerIntegrationStatus: "placeholder",
    });
  }

  return hooks;
}

