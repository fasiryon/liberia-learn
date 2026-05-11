import type { OperationalMemoryInput, OperationalMemoryType } from "@/lib/autonomous/memory/types";

const PII_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\+?\d[\d\s().-]{7,}\d/,
  /\b\d{1,5}\s+[A-Za-z]+\s+(Street|St|Road|Rd|Avenue|Ave|Lane|Ln)\b/i,
];

export function containsLikelyPII(value: string) {
  return PII_PATTERNS.some((pattern) => pattern.test(value));
}

export function isAggregateMemoryType(memoryType: OperationalMemoryType) {
  return memoryType === "DISTRICT_PATTERN" || memoryType === "NATIONAL_PATTERN";
}

export function validateMemoryGovernance(input: OperationalMemoryInput) {
  if (isAggregateMemoryType(input.memoryType) || input.scope === "district" || input.scope === "national") {
    if (input.schoolId || input.targetType === "student" || input.targetType === "guardian" || input.targetType === "user") {
      return { allowed: false, reason: "aggregate_memory_cannot_reference_raw_tenant_or_person_scope" };
    }
    if (containsLikelyPII(input.summary)) return { allowed: false, reason: "aggregate_memory_contains_likely_pii" };
  }
  if (!input.evidenceRefs || Object.keys(input.evidenceRefs).length === 0) return { allowed: false, reason: "memory_requires_evidence_refs" };
  if (!input.lineage || Object.keys(input.lineage).length === 0) return { allowed: false, reason: "memory_requires_lineage" };
  return { allowed: true, reason: "memory_governance_passed" };
}

