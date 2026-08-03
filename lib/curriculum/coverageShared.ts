// Client-safe constants and types for the coverage dashboard.
// Import from here in client components — never from the API route directly.

export const GRADES: string[] = ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10", "G11", "G12"];
export const SUBJECTS: string[] = ["MATH", "SCIENCE", "LITERACY", "ENGLISH", "SOCIAL_STUDIES", "CIVICS", "CS", "ENGINEERING"];
export const NATIONAL_GATE = 15;
// The two status strings that mean "approved and visible to students" across
// both approval pipelines (published = human/legacy convention, APPROVED =
// promotion-pass-2b convention). Kept here so any query that needs "is this
// grade x subject cell already covered" uses the same definition as the
// coverage matrix below, instead of a second, driftable copy.
export const APPROVED_STATUSES: string[] = ["published", "APPROVED"];

export type CoverageCell = {
  approved: number;
  pending: number;
  needsReview: number;
  withAudio: number;
  meetsGate: boolean;
};

export type CoverageResult = {
  matrix: Record<string, Record<string, CoverageCell>>;
  summary: {
    totalCells: number;
    passingCells: number;
    coveragePercent: number;
    nationalGate: number;
    generatedAt: string;
  };
  deserts: Array<{ grade: string; subject: string }>;
};
