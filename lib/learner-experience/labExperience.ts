/**
 * Unified Lab Experience contract. Learners see one concept, "Lab". Which
 * runtime runs it (legacy AI simulation, teacher practical, or the
 * interactive V2 runtime with its HIGH → STANDARD → LOW → FALLBACK_2D chain)
 * is an internal resolution, never a separate product surface.
 */
import { labRegistry } from "@/lib/labs/registry";
import type { LabDefinition, LabId } from "@/lib/labs/types";
import { interactiveLabDefinitions } from "@/lib/interactive-labs/v2/registry";
import type { CapabilityProfile, InteractiveLabDefinition, LabState } from "@/lib/interactive-labs/v2/types";
import type { GovernedEvidenceType } from "@/lib/learning-evidence/evidenceContract";

export const LAB_EXPERIENCE_CONTRACT_VERSION = "lab-experience/1.0.0" as const;

export type LabRuntimeKind = "LEGACY_SIMULATION" | "PRACTICAL_GUIDED" | "INTERACTIVE_V2";

/** RELEASED is the only state a real student may open. */
export type LabReleaseStatus = "RELEASED" | "DRAFT_UNRELEASED";

export type LabOfflineProfile = Readonly<{
  /** Ordered degradation. Every step keeps the same learning objective. */
  degradation: readonly (CapabilityProfile | "STATIC_TEACHER_GUIDED")[];
  offlineCapable: boolean;
  maxPackageBytes: number | null;
}>;

export type LabExperience = Readonly<{
  contractVersion: typeof LAB_EXPERIENCE_CONTRACT_VERSION;
  labId: string;
  version: string;
  title: string;
  summary: string;
  subject: string;
  gradeBands: readonly string[];
  standards: readonly string[];
  skills: readonly string[];
  concepts: readonly string[];
  objectiveIds: readonly string[];
  prerequisites: readonly string[];
  estimatedMinutes: number | null;
  runtime: Readonly<{ kind: LabRuntimeKind; capabilities: readonly string[] }>;
  offline: LabOfflineProfile;
  evidenceTypes: readonly GovernedEvidenceType[];
  release: Readonly<{ status: LabReleaseStatus; reviewState: string; approvalState: string; curriculumActive: boolean }>;
}>;

const INTERACTIVE_DEGRADATION: LabOfflineProfile["degradation"] = ["HIGH", "STANDARD", "LOW", "FALLBACK_2D", "STATIC_TEACHER_GUIDED"];

function gradeBandOf(grade: number): string {
  return `Grade ${grade}`;
}

export function fromInteractiveLab(definition: InteractiveLabDefinition<LabState>): LabExperience {
  const approved = definition.reviewState === "APPROVED" && definition.approvalState === "APPROVED";
  const capabilities = definition.fidelity ? ["3d", "fallback-2d", "guided-path", "direct-manipulation-checks"] : ["3d", "fallback-2d"];
  return Object.freeze<LabExperience>({
    contractVersion: LAB_EXPERIENCE_CONTRACT_VERSION,
    labId: definition.id,
    version: definition.version,
    title: definition.title ?? definition.id,
    summary: definition.summary ?? "",
    subject: definition.subject,
    gradeBands: [gradeBandOf(definition.grade)],
    standards: [],
    skills: [],
    concepts: [...definition.conceptIds],
    objectiveIds: [...definition.objectiveIds],
    prerequisites: [],
    estimatedMinutes: null,
    runtime: { kind: "INTERACTIVE_V2", capabilities },
    offline: {
      degradation: INTERACTIVE_DEGRADATION,
      offlineCapable: definition.accessibility.offline,
      maxPackageBytes: definition.fidelity?.offline?.maxPackageBytes ?? null,
    },
    evidenceTypes: ["LAB"],
    // A lab is released only when its definition is approved; the release binding must also be real.
    release: {
      status: approved && definition.releaseBinding.releaseId !== "fixture-unreleased" ? "RELEASED" : "DRAFT_UNRELEASED",
      reviewState: definition.reviewState,
      approvalState: definition.approvalState,
      curriculumActive: approved,
    },
  });
}

export function fromLegacyLab(definition: LabDefinition<unknown>): LabExperience {
  return Object.freeze<LabExperience>({
    contractVersion: LAB_EXPERIENCE_CONTRACT_VERSION,
    labId: definition.id,
    version: "legacy",
    title: definition.title,
    summary: definition.description ?? "",
    subject: definition.subject,
    gradeBands: [definition.gradeBand],
    standards: [...definition.curriculumStandards],
    skills: [],
    concepts: [],
    // Legacy labs carry no objective binding; they can be listed but never linked as governed lesson labs.
    objectiveIds: [],
    prerequisites: [],
    estimatedMinutes: null,
    runtime: { kind: "LEGACY_SIMULATION", capabilities: ["2d-canvas", "ai-tutor-prompts"] },
    offline: { degradation: ["STATIC_TEACHER_GUIDED"], offlineCapable: false, maxPackageBytes: null },
    // Legacy client scores are provisional observations (see lab-score containment).
    evidenceTypes: ["SIMULATION"],
    // The legacy library is already student-visible; it remains so during migration.
    release: { status: "RELEASED", reviewState: "LEGACY", approvalState: "LEGACY", curriculumActive: false },
  });
}

export type PracticalLabRecord = Readonly<{ labId: string; title: string; subject: string; estimatedMinutes: number; labType: string }>;

export function fromPracticalLab(record: PracticalLabRecord): LabExperience {
  return Object.freeze<LabExperience>({
    contractVersion: LAB_EXPERIENCE_CONTRACT_VERSION,
    labId: record.labId,
    version: "practical",
    title: record.title,
    summary: "",
    subject: record.subject.replace(/_/g, " "),
    gradeBands: [],
    standards: [],
    skills: [],
    concepts: [],
    objectiveIds: [],
    prerequisites: [],
    estimatedMinutes: record.estimatedMinutes,
    runtime: { kind: "PRACTICAL_GUIDED", capabilities: [record.labType] },
    offline: { degradation: ["STATIC_TEACHER_GUIDED"], offlineCapable: true, maxPackageBytes: null },
    evidenceTypes: ["PRACTICAL"],
    release: { status: "RELEASED", reviewState: "ASSIGNED", approvalState: "ASSIGNED", curriculumActive: false },
  });
}

/** Every lab the platform knows, through one presentation contract. */
export function listLabExperiences(): LabExperience[] {
  const legacy = Object.values(labRegistry).map((definition) => fromLegacyLab(definition as LabDefinition<unknown>));
  const interactive = Object.values(interactiveLabDefinitions).map((definition) => fromInteractiveLab(definition as InteractiveLabDefinition<LabState>));
  return [...legacy, ...interactive];
}

export function findLabExperience(labId: string): LabExperience | null {
  return listLabExperiences().find((lab) => lab.labId === labId) ?? null;
}

/** Real students only ever see released labs. Internal preview is a separate, explicit gate. */
export function isStudentAccessible(lab: LabExperience): boolean {
  return lab.release.status === "RELEASED";
}

/**
 * The canonical learner URL for a lab. Interactive and legacy labs share the
 * /student/labs namespace; /student/interactive-labs/* redirects here.
 */
export function labExperienceHref(lab: Pick<LabExperience, "labId">): string {
  return `/student/labs/${encodeURIComponent(lab.labId)}`;
}

export function isLegacyLabId(labId: string): labId is LabId {
  return Object.prototype.hasOwnProperty.call(labRegistry, labId);
}

export function gradeInBand(grade: number | null, band: string): boolean {
  if (grade == null) return true;
  const range = band.match(/(\d+)[^\d]+(\d+)/);
  if (range) return grade >= Number(range[1]) && grade <= Number(range[2]);
  const single = band.match(/(\d+)/);
  return single ? grade === Number(single[1]) : true;
}

export function isGradeAppropriate(lab: LabExperience, grade: number | null): boolean {
  if (lab.gradeBands.length === 0) return true;
  return lab.gradeBands.some((band) => gradeInBand(grade, band));
}
