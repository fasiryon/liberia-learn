// libs/subject-mapping.ts
// Maps Unified Curriculum Schema subjects -> Prisma Subject enum
// NOTE: Prisma Subject enum (currently) lacks ENGLISH, ICT, etc.
// Strategy: map those into the closest Prisma categories for now.

export type SchemaSubject =
  | "MATH"
  | "ENGLISH"
  | "SCIENCE"
  | "PHYSICS"
  | "CHEMISTRY"
  | "BIOLOGY"
  | "COMPUTER_SCIENCE"
  | "ICT"
  | "HISTORY"
  | "CIVICS"
  | "GEOGRAPHY"
  | "ECONOMICS"
  | "BUSINESS_STUDIES"
  | "ARTS"
  | "CREATIVITY"
  | "PE"
  | "LITERACY";

export type PrismaSubject =
  | "MATH"
  | "SCIENCE"
  | "COMPUTER_SCIENCE"
  | "ENGINEERING"
  | "LITERACY"
  | "CIVICS"
  | "ARTS"
  | "PE"
  | "CAREER";

export const schemaToPrismaSubject: Record<SchemaSubject, PrismaSubject> = {
  MATH: "MATH",

  // Language Arts split in schema; Prisma has only LITERACY
  ENGLISH: "LITERACY",
  LITERACY: "LITERACY",

  // Science split in schema; Prisma has SCIENCE
  SCIENCE: "SCIENCE",
  PHYSICS: "SCIENCE",
  CHEMISTRY: "SCIENCE",
  BIOLOGY: "SCIENCE",

  // Computing split in schema; Prisma has COMPUTER_SCIENCE
  COMPUTER_SCIENCE: "COMPUTER_SCIENCE",
  ICT: "COMPUTER_SCIENCE",

  // Social studies: Prisma has CIVICS; route related subjects there for now
  CIVICS: "CIVICS",
  HISTORY: "CIVICS",
  GEOGRAPHY: "CIVICS",

  // Econ/Business: Prisma has CAREER (closest current bucket)
  ECONOMICS: "CAREER",
  BUSINESS_STUDIES: "CAREER",

  // Arts: map both
  ARTS: "ARTS",
  CREATIVITY: "ARTS",

  // PE: direct
  PE: "PE",
};

// Optional: reverse mapping if you ever need it (best-effort)
export const prismaToSchemaSubjectDefaults: Record<PrismaSubject, SchemaSubject> =
  {
    MATH: "MATH",
    SCIENCE: "SCIENCE",
    COMPUTER_SCIENCE: "COMPUTER_SCIENCE",
    ENGINEERING: "ICT", // or "COMPUTER_SCIENCE" depending on your taxonomy
    LITERACY: "LITERACY",
    CIVICS: "CIVICS",
    ARTS: "ARTS",
    PE: "PE",
    CAREER: "BUSINESS_STUDIES",
  };
