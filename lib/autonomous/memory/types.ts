import type { JsonObject } from "@/lib/autonomous/types";

export type OperationalMemoryType =
  | "STUDENT_PATTERN"
  | "TEACHER_PATTERN"
  | "CLASSROOM_PATTERN"
  | "CURRICULUM_PATTERN"
  | "SCHOOL_PATTERN"
  | "DISTRICT_PATTERN"
  | "NATIONAL_PATTERN";

export type OperationalMemoryInput = {
  memoryType: OperationalMemoryType;
  scope: "student" | "teacher" | "classroom" | "school" | "district" | "national";
  tenantId?: string | null;
  schoolId?: string | null;
  districtId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  summary: string;
  evidenceRefs: JsonObject;
  lineage: JsonObject;
  confidence?: number | null;
  retentionDays?: number;
  sensitivity?: "tenant" | "aggregate" | "restricted";
  actorId?: string | null;
};

