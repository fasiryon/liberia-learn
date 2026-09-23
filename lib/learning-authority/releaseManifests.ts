import { createHash } from "node:crypto";
import type { CanonicalSubjectCode } from "@/lib/curriculum/subjectTaxonomy";
import {
  deterministicReleaseIdentity,
  validateOntologyRelease,
  type CurriculumOntologyRelease,
} from "./governedGrade4Math";

export type ReleaseCoverage = Readonly<{
  lessons: number;
  assessments: number;
  evidencePolicies: number;
  toolPolicies: number;
  misconceptions: number;
}>;

export type ReleaseManifest = Readonly<{
  manifestVersion: "1.0.0";
  releaseId: string;
  grade: number;
  subject: CanonicalSubjectCode | string;
  provenance: Readonly<{
    sourceRef: string;
    authority: "LIBERIA_MOE" | "LIBERIALEARN_FOUNDER_REVIEW" | "PLATFORM_REVIEW" | "UNKNOWN";
    moeApprovalStatus: "APPROVED" | "NOT_CLAIMED" | "PENDING" | "REJECTED";
  }>;
  release?: CurriculumOntologyRelease;
  coverage?: ReleaseCoverage;
}>;

export type CoverageGap = Readonly<{
  releaseId: string;
  grade: number;
  subject: string;
  conceptId?: string;
  gaps: readonly ("LESSON" | "ASSESSMENT" | "EVIDENCE_POLICY" | "TOOL_POLICY" | "MISCONCEPTION")[];
}>;

export type ManifestValidationReport = Readonly<{
  ok: boolean;
  identity: string;
  errors: readonly string[];
  warnings: readonly string[];
  gaps: readonly CoverageGap[];
}>;

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Stable identity for the authoring input, independent of file order. */
export function deterministicManifestIdentity(manifest: ReleaseManifest): string {
  return digest({
    manifestVersion: manifest.manifestVersion,
    releaseId: manifest.releaseId,
    grade: manifest.grade,
    subject: manifest.subject,
    provenance: manifest.provenance,
    releaseIdentity: manifest.release ? deterministicReleaseIdentity(manifest.release) : null,
    coverage: manifest.coverage ?? null,
  });
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) result.push(value);
    seen.add(value);
  }
  return result;
}

function coverageGaps(manifest: ReleaseManifest): CoverageGap[] {
  const release = manifest.release;
  if (!release) return [{ releaseId: manifest.releaseId, grade: manifest.grade, subject: manifest.subject, gaps: ["LESSON", "ASSESSMENT", "EVIDENCE_POLICY", "TOOL_POLICY"] }];
  const lessonConcepts = new Set(release.contentBindings.filter((b) => b.contentType === "LESSON").map((b) => b.conceptId));
  const assessmentConcepts = new Set(release.bindings.map((b) => b.conceptId));
  return release.concepts.flatMap((concept) => {
    const gaps = [
      ...(lessonConcepts.has(concept.id) ? [] : ["LESSON" as const]),
      ...(assessmentConcepts.has(concept.id) ? [] : ["ASSESSMENT" as const]),
      ...(release.evidencePolicies.length ? [] : ["EVIDENCE_POLICY" as const]),
      ...(release.toolPolicies.length ? [] : ["TOOL_POLICY" as const]),
    ];
    return gaps.length ? [{ releaseId: manifest.releaseId, grade: manifest.grade, subject: manifest.subject, conceptId: concept.id, gaps }] : [];
  });
}

/** Batch-safe validation: all errors are returned, and any error is non-executable. */
export function validateReleaseManifest(manifest: ReleaseManifest): ManifestValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (manifest.manifestVersion !== "1.0.0") errors.push("manifest_version_unsupported");
  if (!Number.isInteger(manifest.grade) || manifest.grade < 1 || manifest.grade > 12) errors.push("grade_invalid");
  if (!manifest.subject.trim()) errors.push("subject_required");
  if (!manifest.releaseId.trim()) errors.push("release_id_required");
  if (manifest.release && manifest.provenance.authority === "LIBERIA_MOE" && manifest.provenance.moeApprovalStatus !== "APPROVED") {
    errors.push("moe_authority_requires_approval");
  }
  if (!manifest.release) {
    warnings.push("release_not_attached_content_gap_only");
  } else {
    if (manifest.release.id !== manifest.releaseId) errors.push("release_id_mismatch");
    if (manifest.release.grade !== manifest.grade || manifest.release.subject !== manifest.subject) errors.push("release_scope_mismatch");
    if (manifest.release.authority === "LIBERIA_MOE" && manifest.provenance.moeApprovalStatus !== "APPROVED") {
      errors.push("release_moe_authority_requires_manifest_approval");
    }
    try { validateOntologyRelease(manifest.release); } catch (error) { errors.push(error instanceof Error ? error.message : "release_invalid"); }
    for (const [name, ids] of [
      ["concept", manifest.release.concepts.map((x) => x.id)],
      ["item", manifest.release.items.map((x) => x.id)],
      ["evidence_policy", manifest.release.evidencePolicies.map((x) => x.id)],
      ["tool_policy", manifest.release.toolPolicies.map((x) => x.id)],
    ] as const) for (const id of duplicates(ids)) errors.push(`${name}_duplicate:${id}`);
    for (const binding of manifest.release.bindings) {
      if (manifest.release.grade !== manifest.grade) errors.push(`cross_grade_binding:${binding.id}`);
    }
  }
  const gaps = coverageGaps(manifest);
  if (gaps.length) warnings.push("coverage_gaps_present");
  return Object.freeze({ ok: errors.length === 0, identity: deterministicManifestIdentity(manifest), errors, warnings, gaps });
}

export function validateReleaseBatch(manifests: readonly ReleaseManifest[]) {
  const reports = manifests.map(validateReleaseManifest);
  const ids = duplicates(manifests.map((manifest) => manifest.releaseId));
  const errors = [...reports.flatMap((report) => report.errors), ...ids.map((id) => `release_duplicate:${id}`)];
  return Object.freeze({ ok: errors.length === 0, errors, reports });
}
