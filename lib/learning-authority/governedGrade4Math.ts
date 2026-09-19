import { createHash } from "crypto";

export type EvidenceContext = "DIAGNOSTIC" | "PRACTICE" | "TEACHER_OBSERVATION";
export type EvidenceDecision = "ACCEPTED" | "PROVISIONAL" | "REJECTED";
export type DiagnosticKind = "INITIAL" | "CONTINUOUS";
export type ToolKey = "calculator" | "fraction_strips" | "number_line";
export type OntologyReleaseStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED";
export type OntologyReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Concept = Readonly<{
  id: string;
  revision: number;
  label: string;
}>;

export type ConceptPrerequisiteEdge = Readonly<{
  fromConceptId: string;
  toConceptId: string;
  rationale: string;
}>;

export type EvidencePolicy = Readonly<{
  id: string;
  version: string;
  context: EvidenceContext;
  requiresServerScoring: boolean;
  requiresHumanActor: boolean;
}>;

export type ToolPolicy = Readonly<{
  id: string;
  version: string;
  context: EvidenceContext | "INSTRUCTION" | "CONTROLLED_ASSESSMENT";
  allowed: readonly ToolKey[];
  prohibited: readonly ToolKey[];
  accommodationOverrideRoles: readonly ("TEACHER" | "ADMIN")[];
}>;

export type CurriculumConstructBinding = Readonly<{
  id: string;
  itemId: string;
  itemVersion: string;
  conceptId: string;
  skillId: string;
  learningTargetCode: string;
  standardCode: string;
  evidencePolicyId: string;
  toolPolicyId: string;
}>;

export type CurriculumOntologyRelease = Readonly<{
  id: string;
  version: string;
  status: OntologyReleaseStatus;
  reviewStatus: OntologyReviewStatus;
  authority: "LIBERIA_MOE";
  provenanceRef: string;
  grade: 4;
  subject: "MATH";
  items: readonly GovernedGrade4MathItem[];
  concepts: readonly Concept[];
  prerequisites: readonly ConceptPrerequisiteEdge[];
  bindings: readonly CurriculumConstructBinding[];
  evidencePolicies: readonly EvidencePolicy[];
  toolPolicies: readonly ToolPolicy[];
}>;

export type GovernedGrade4MathItem = Readonly<{
  id: string;
  version: string;
  context: "DIAGNOSTIC" | "PRACTICE";
  prompt: string;
  options: readonly string[];
  correctIndex: number;
}>;

export const GOVERNED_GRADE4_MATH_ITEMS: readonly GovernedGrade4MathItem[] = deepFreeze([
  {
    id: "g4-frac-diagnostic-equal-parts",
    version: "1.0.0",
    context: "DIAGNOSTIC",
    prompt: "Which fraction represents three equal parts out of four?",
    options: ["1/4", "2/4", "3/4", "4/3"],
    correctIndex: 2,
  },
  {
    id: "g4-frac-practice-equivalence",
    version: "1.0.0",
    context: "PRACTICE",
    prompt: "Which fraction is equivalent to 1/2?",
    options: ["1/3", "2/4", "3/4", "2/3"],
    correctIndex: 1,
  },
  {
    id: "g4-frac-diagnostic-compare",
    version: "1.0.0",
    context: "DIAGNOSTIC",
    prompt: "Which fraction is greater?",
    options: ["1/4", "3/4", "They are equal", "Not enough information"],
    correctIndex: 1,
  },
]);

const concepts = [
  { id: "g4-fractions-equal-parts", revision: 1, label: "Recognize fractions as equal parts" },
  { id: "g4-fractions-equivalence", revision: 1, label: "Represent equivalent fractions" },
  { id: "g4-fractions-compare", revision: 1, label: "Compare fractions with related denominators" },
] as const;

const evidencePolicies = [
  { id: "g4-math-diagnostic-evidence", version: "1.0.0", context: "DIAGNOSTIC", requiresServerScoring: true, requiresHumanActor: false },
  { id: "g4-math-practice-evidence", version: "1.0.0", context: "PRACTICE", requiresServerScoring: true, requiresHumanActor: false },
  { id: "g4-math-teacher-observation", version: "1.0.0", context: "TEACHER_OBSERVATION", requiresServerScoring: false, requiresHumanActor: true },
] as const satisfies readonly EvidencePolicy[];

const toolPolicies = [
  { id: "g4-math-instruction-tools", version: "1.0.0", context: "INSTRUCTION", allowed: ["fraction_strips", "number_line"], prohibited: [], accommodationOverrideRoles: ["TEACHER", "ADMIN"] },
  { id: "g4-math-practice-tools", version: "1.0.0", context: "PRACTICE", allowed: ["fraction_strips", "number_line"], prohibited: ["calculator"], accommodationOverrideRoles: ["TEACHER", "ADMIN"] },
  { id: "g4-math-diagnostic-tools", version: "1.0.0", context: "DIAGNOSTIC", allowed: [], prohibited: ["calculator"], accommodationOverrideRoles: ["TEACHER", "ADMIN"] },
  { id: "g4-math-controlled-tools", version: "1.0.0", context: "CONTROLLED_ASSESSMENT", allowed: [], prohibited: ["calculator"], accommodationOverrideRoles: ["TEACHER", "ADMIN"] },
] as const satisfies readonly ToolPolicy[];

const bindings = [
  {
    id: "g4-frac-bind-equal-parts-v1",
    itemId: "g4-frac-diagnostic-equal-parts",
    itemVersion: "1.0.0",
    conceptId: "g4-fractions-equal-parts",
    skillId: "placement-skill-MATH-G4_6",
    learningTargetCode: "LR-MATH-G4_6-02",
    standardCode: "LR-MATH-G4_6-02",
    evidencePolicyId: "g4-math-diagnostic-evidence",
    toolPolicyId: "g4-math-diagnostic-tools",
  },
  {
    id: "g4-frac-bind-equivalence-v1",
    itemId: "g4-frac-practice-equivalence",
    itemVersion: "1.0.0",
    conceptId: "g4-fractions-equivalence",
    skillId: "placement-skill-MATH-G4_6",
    learningTargetCode: "LR-MATH-G4_6-02",
    standardCode: "LR-MATH-G4_6-02",
    evidencePolicyId: "g4-math-practice-evidence",
    toolPolicyId: "g4-math-practice-tools",
  },
  {
    id: "g4-frac-bind-compare-v1",
    itemId: "g4-frac-diagnostic-compare",
    itemVersion: "1.0.0",
    conceptId: "g4-fractions-compare",
    skillId: "placement-skill-MATH-G4_6",
    learningTargetCode: "LR-MATH-G4_6-02",
    standardCode: "LR-MATH-G4_6-02",
    evidencePolicyId: "g4-math-diagnostic-evidence",
    toolPolicyId: "g4-math-diagnostic-tools",
  },
] as const satisfies readonly CurriculumConstructBinding[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const GRADE4_MATH_ONTOLOGY_RELEASE: CurriculumOntologyRelease = deepFreeze({
  id: "lr-moe-g4-math-fractions-2026.1",
  version: "2026.1",
  status: "PUBLISHED",
  reviewStatus: "APPROVED",
  authority: "LIBERIA_MOE",
  provenanceRef: "Standard:LR-MATH-G4_6-02",
  grade: 4,
  subject: "MATH",
  items: GOVERNED_GRADE4_MATH_ITEMS,
  concepts,
  prerequisites: [
    { fromConceptId: "g4-fractions-equal-parts", toConceptId: "g4-fractions-equivalence", rationale: "Equal parts precede equivalence." },
    { fromConceptId: "g4-fractions-equivalence", toConceptId: "g4-fractions-compare", rationale: "Equivalence supports valid comparison." },
  ],
  bindings,
  evidencePolicies,
  toolPolicies,
});

export function deterministicReleaseIdentity(release: CurriculumOntologyRelease): string {
  const pinned = {
    authority: release.authority,
    bindings: release.bindings,
    concepts: release.concepts,
    evidencePolicies: release.evidencePolicies,
    grade: release.grade,
    items: release.items,
    prerequisites: release.prerequisites,
    provenanceRef: release.provenanceRef,
    reviewStatus: release.reviewStatus,
    status: release.status,
    subject: release.subject,
    toolPolicies: release.toolPolicies,
    version: release.version,
  };
  return createHash("sha256").update(JSON.stringify(pinned)).digest("hex");
}

export function validateOntologyRelease(release: CurriculumOntologyRelease): void {
  if (release.status !== "PUBLISHED" || release.reviewStatus !== "APPROVED") {
    throw new Error("ontology_release_not_executable");
  }
  if (release.authority !== "LIBERIA_MOE" || !release.provenanceRef) {
    throw new Error("ontology_release_missing_authority");
  }
  const ids = new Set(release.concepts.map((concept) => concept.id));
  const evidencePolicyIds = new Set(release.evidencePolicies.map((policy) => policy.id));
  const toolPolicyIds = new Set(release.toolPolicies.map((policy) => policy.id));
  const itemsById = new Map(release.items.map((item) => [item.id, item]));
  const bindingIds = new Set<string>();
  for (const binding of release.bindings) {
    if (bindingIds.has(binding.id)) throw new Error("ontology_binding_duplicate");
    bindingIds.add(binding.id);
    if (!ids.has(binding.conceptId)) throw new Error("ontology_binding_unknown_concept");
    const item = itemsById.get(binding.itemId);
    if (!item || item.version !== binding.itemVersion) throw new Error("ontology_binding_unknown_item");
    if (!evidencePolicyIds.has(binding.evidencePolicyId) || !toolPolicyIds.has(binding.toolPolicyId)) {
      throw new Error("ontology_binding_unknown_policy");
    }
    const evidencePolicy = release.evidencePolicies.find((policy) => policy.id === binding.evidencePolicyId);
    if (evidencePolicy?.context !== item.context) throw new Error("ontology_binding_context_mismatch");
  }
  const outgoing = new Map<string, string[]>();
  for (const edge of release.prerequisites) {
    if (!ids.has(edge.fromConceptId) || !ids.has(edge.toConceptId)) {
      throw new Error("ontology_edge_unknown_concept");
    }
    outgoing.set(edge.fromConceptId, [...(outgoing.get(edge.fromConceptId) ?? []), edge.toConceptId]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error("ontology_prerequisite_cycle");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of outgoing.get(id) ?? []) visit(next);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
}

export type RawLearningObservation = Readonly<{
  idempotencyKey: string;
  schoolId: string;
  authenticatedUserId: string;
  studentId: string;
  studentUserId: string;
  itemId: string;
  itemVersion: string;
  context: EvidenceContext;
  toolsUsed: readonly ToolKey[];
  hintsUsed: number;
  aiAssisted: boolean;
  source: "ONLINE" | "OFFLINE" | "TEACHER";
  clientClaimedMastery?: unknown;
}>;

export type EvidenceAdmissionContext = Readonly<{
  expectedSchoolId: string;
  expectedStudentId: string;
  expectedStudentUserId: string;
  serverScored: boolean;
  humanActorRole?: "TEACHER" | "ADMIN";
  accommodationOverride?: { approvedByRole: "TEACHER" | "ADMIN"; tool: ToolKey };
}>;

export type EvidenceAdmissionResult = Readonly<{
  decision: EvidenceDecision;
  reason: string;
  bindingId?: string;
  policyVersion?: string;
  toolPolicyVersion?: string;
  legacyMasteryProjectionAllowed: false;
}>;

export function admitEvidence(
  observation: RawLearningObservation,
  context: EvidenceAdmissionContext,
  release: CurriculumOntologyRelease = GRADE4_MATH_ONTOLOGY_RELEASE
): EvidenceAdmissionResult {
  try {
    validateOntologyRelease(release);
  } catch (error) {
    return { decision: "REJECTED", reason: error instanceof Error ? error.message : "ontology_invalid", legacyMasteryProjectionAllowed: false };
  }
  if (
    observation.schoolId !== context.expectedSchoolId ||
    observation.studentId !== context.expectedStudentId ||
    observation.studentUserId !== context.expectedStudentUserId ||
    observation.authenticatedUserId !== context.expectedStudentUserId
  ) {
    return { decision: "REJECTED", reason: "tenant_or_student_identity_mismatch", legacyMasteryProjectionAllowed: false };
  }
  if (observation.clientClaimedMastery !== undefined) {
    return { decision: "REJECTED", reason: "client_cannot_assert_mastery", legacyMasteryProjectionAllowed: false };
  }
  const binding = release.bindings.find((candidate) => candidate.itemId === observation.itemId);
  if (!binding) return { decision: "REJECTED", reason: "construct_binding_missing", legacyMasteryProjectionAllowed: false };
  if (binding.itemVersion !== observation.itemVersion) {
    return { decision: "REJECTED", reason: "item_version_invalid", legacyMasteryProjectionAllowed: false };
  }
  const policy = release.evidencePolicies.find((candidate) => candidate.id === binding.evidencePolicyId);
  const toolPolicy = release.toolPolicies.find((candidate) => candidate.id === binding.toolPolicyId);
  if (!policy || !toolPolicy || policy.context !== observation.context) {
    return { decision: "REJECTED", reason: "governed_policy_mismatch", legacyMasteryProjectionAllowed: false };
  }
  if (policy.requiresServerScoring && !context.serverScored) {
    return { decision: "REJECTED", reason: "server_scoring_required", legacyMasteryProjectionAllowed: false };
  }
  if (policy.requiresHumanActor && !context.humanActorRole) {
    return { decision: "REJECTED", reason: "human_authority_required", legacyMasteryProjectionAllowed: false };
  }
  for (const tool of observation.toolsUsed) {
    if (!toolPolicy.prohibited.includes(tool)) continue;
    const override = context.accommodationOverride;
    if (!override || override.tool !== tool || !toolPolicy.accommodationOverrideRoles.includes(override.approvedByRole)) {
      return { decision: "REJECTED", reason: "prohibited_tool_used", legacyMasteryProjectionAllowed: false };
    }
  }
  if (observation.aiAssisted || observation.hintsUsed > 0) {
    return { decision: "PROVISIONAL", reason: "assistance_requires_review", bindingId: binding.id, policyVersion: policy.version, toolPolicyVersion: toolPolicy.version, legacyMasteryProjectionAllowed: false };
  }
  return { decision: "ACCEPTED", reason: "governed_evidence_admitted", bindingId: binding.id, policyVersion: policy.version, toolPolicyVersion: toolPolicy.version, legacyMasteryProjectionAllowed: false };
}

export class EvidenceAdmissionLedger {
  private readonly admitted = new Map<string, EvidenceAdmissionResult>();

  admit(observation: RawLearningObservation, context: EvidenceAdmissionContext): EvidenceAdmissionResult {
    const prior = this.admitted.get(observation.idempotencyKey);
    if (prior) return { ...prior, reason: "duplicate_observation_idempotent" };
    const result = admitEvidence(observation, context);
    if (result.decision !== "REJECTED") this.admitted.set(observation.idempotencyKey, result);
    return result;
  }

  get size(): number {
    return this.admitted.size;
  }
}

export function createDiagnosticResult(input: {
  kind: DiagnosticKind;
  idempotencyKey: string;
  schoolId: string;
  studentId: string;
  studentUserId: string;
  releaseId?: string;
  conceptObservations: readonly { conceptId: string; observedPerformance: 0 | 1; confidence: number }[];
  recommendedPrerequisiteConceptIds: readonly string[];
}, release: CurriculumOntologyRelease = GRADE4_MATH_ONTOLOGY_RELEASE) {
  validateOntologyRelease(release);
  if (!input.idempotencyKey || !input.schoolId || !input.studentId || !input.studentUserId) {
    throw new Error("diagnostic_session_identity_required");
  }
  if (input.releaseId && input.releaseId !== release.id) {
    throw new Error("diagnostic_session_release_mismatch");
  }
  const conceptIds = new Set(release.concepts.map((concept) => concept.id));
  for (const observation of input.conceptObservations) {
    if (!conceptIds.has(observation.conceptId)) throw new Error("diagnostic_concept_not_released");
    if (observation.observedPerformance !== 0 && observation.observedPerformance !== 1) {
      throw new Error("diagnostic_performance_invalid");
    }
    if (!Number.isFinite(observation.confidence) || observation.confidence < 0 || observation.confidence > 1) {
      throw new Error("diagnostic_confidence_invalid");
    }
  }
  for (const conceptId of input.recommendedPrerequisiteConceptIds) {
    if (!conceptIds.has(conceptId)) throw new Error("diagnostic_prerequisite_not_released");
  }
  return Object.freeze({
    sessionAuthority: "INSTRUCTIONAL_DIAGNOSTIC" as const,
    idempotencyKey: input.idempotencyKey,
    schoolId: input.schoolId,
    studentId: input.studentId,
    studentUserId: input.studentUserId,
    ontologyReleaseId: release.id,
    ontologyReleaseIdentity: deterministicReleaseIdentity(release),
    kind: input.kind,
    conceptObservations: input.conceptObservations,
    uncertainty: input.conceptObservations.map((entry) => 1 - entry.confidence),
    recommendedPrerequisiteConceptIds: input.recommendedPrerequisiteConceptIds,
    mayChangeAdministrativeGrade: false as const,
  });
}
