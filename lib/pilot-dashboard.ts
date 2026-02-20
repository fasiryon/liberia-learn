import { prisma } from "@/lib/db";
import { computePilotScoresForSchools } from "@/lib/pilot-score";

export type PilotDashboardRow = {
  id: string;
  schoolName: string;
  county: string;
  onboardingStatus: string;
  readinessScore: number;
  pilotStatus: string;
  pilotCohort: string;
  contactEmailVerified: boolean;
  contactPhoneVerified: boolean;
};

export const pilotDashboardHeaders = [
  "School",
  "County",
  "Onboarding",
  "Readiness Score",
  "Pilot Status",
  "Pilot Cohort",
  "Contact Email Verified",
  "Contact Phone Verified",
];

function formatOnboardingStatus(step: number | null): string {
  const value = step ?? 0;
  if (value >= 5) return "Complete";
  return `Step ${value}/5`;
}

export function buildPilotDashboardCsvRows(rows: PilotDashboardRow[]): string[][] {
  return rows.map((row) => [
    row.schoolName,
    row.county,
    row.onboardingStatus,
    String(row.readinessScore),
    row.pilotStatus,
    row.pilotCohort,
    row.contactEmailVerified ? "Yes" : "No",
    row.contactPhoneVerified ? "Yes" : "No",
  ]);
}

export async function getPilotDashboardRows(): Promise<PilotDashboardRow[]> {
  const schools = await prisma.school.findMany({
    where: {
      pilotStatus: { not: null },
    },
    select: {
      id: true,
      name: true,
      county: true,
      onboardingStep: true,
      pilotStatus: true,
      pilotCohort: true,
      contactEmailVerified: true,
      contactPhoneVerified: true,
      primaryHex: true,
      logoUrl: true,
    },
    orderBy: { name: "asc" },
  });

  const pilotSchools = schools.filter((s) => (s.pilotStatus ?? "").trim().length > 0);
  if (pilotSchools.length === 0) return [];

  const scores = await computePilotScoresForSchools(pilotSchools);

  return pilotSchools.map((school) => ({
    id: school.id,
    schoolName: school.name,
    county: school.county ?? "",
    onboardingStatus: formatOnboardingStatus(school.onboardingStep ?? 0),
    readinessScore: scores[school.id]?.total ?? 0,
    pilotStatus: school.pilotStatus ?? "",
    pilotCohort: school.pilotCohort ?? "",
    contactEmailVerified: school.contactEmailVerified,
    contactPhoneVerified: school.contactPhoneVerified,
  }));
}
