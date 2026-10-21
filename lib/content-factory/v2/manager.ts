import { assessReviewerIndependence, type AgentIdentity } from "@/lib/curriculum/excellence/instructionalReviewer";
import { blueprintRef, digest, FACTORY_ROLES, parseBlueprint, type FactoryRole } from "./blueprint";
import { artifactHash, checkPackage, validateArtifact } from "./quality";
import type { FactoryArtifact, FactoryEvent, FactoryExecutors, FactoryResult, QualityReport } from "./types";

export const ROLE_DEPENDENCIES: Record<FactoryRole, readonly FactoryRole[]> = {
  CURRICULUM_ARCHITECT: [], LEARNING_SCIENCE_DESIGNER: ["CURRICULUM_ARCHITECT"], LESSON_AUTHOR: ["LEARNING_SCIENCE_DESIGNER"],
  ASSESSMENT_DESIGNER: ["LEARNING_SCIENCE_DESIGNER", "LESSON_AUTHOR"],
  PROJECT_PRACTICAL_DESIGNER: ["LESSON_AUTHOR", "ASSESSMENT_DESIGNER"],
  MEDIA_ACCESSIBILITY: ["LESSON_AUTHOR", "ASSESSMENT_DESIGNER", "PROJECT_PRACTICAL_DESIGNER"],
  INDEPENDENT_QUALITY_REVIEWER: ["CURRICULUM_ARCHITECT", "LEARNING_SCIENCE_DESIGNER", "LESSON_AUTHOR", "ASSESSMENT_DESIGNER", "PROJECT_PRACTICAL_DESIGNER", "MEDIA_ACCESSIBILITY"],
  GOVERNANCE_RELEASE: ["INDEPENDENT_QUALITY_REVIEWER"],
};

function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freezeDeep); Object.freeze(value); }
  return value;
}

/** Local, single-executor production workflow. Approval and official writers are absent. */
export async function runFactory(input: {
  blueprint: unknown; executors: FactoryExecutors; actors?: Partial<Record<FactoryRole, AgentIdentity>>;
  maxAttempts?: number; appendAudit: (event: FactoryEvent) => Promise<void>;
  persistArtifact?: (artifact: FactoryArtifact) => Promise<void>;
  authoringOnly?: boolean;
}): Promise<FactoryResult> {
  const blueprint = freezeDeep(parseBlueprint(input.blueprint));
  const maxAttempts = input.maxAttempts ?? 2;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw new Error("factory_attempt_budget_invalid");
  // Validate resource order against the fixed role graph before any executor runs.
  for (const resource of blueprint.resources) {
    if (resource.role === "INDEPENDENT_QUALITY_REVIEWER" || resource.role === "GOVERNANCE_RELEASE") throw new Error("review_roles_cannot_author_resources");
    for (const dependency of resource.dependsOn) {
      const owner = blueprint.resources.find(r => r.id === dependency)?.role;
      if (!owner || FACTORY_ROLES.indexOf(owner) > FACTORY_ROLES.indexOf(resource.role)) throw new Error("resource_role_dependency_invalid");
    }
  }
  const actors = Object.fromEntries(FACTORY_ROLES.map(role => [role, input.actors?.[role] ?? { kind: "AI" as const, agentId: `factory-demo:${role}`, modelFamily: "deterministic-local-demo", sessionId: role }]));
  const events: FactoryEvent[] = [];
  const artifacts: FactoryArtifact[] = [];
  const completed = new Set<FactoryRole>();
  let quality: QualityReport | null = null;
  let reviewerIndependence: FactoryResult["reviewerIndependence"] = null;
  const record = async (event: Omit<FactoryEvent, "sequence" | "previousHash" | "eventHash">) => {
    const payload = { ...event, sequence: events.length + 1, previousHash: events.at(-1)?.eventHash ?? null };
    const sealed = freezeDeep({ ...payload, eventHash: digest("factory-event/2.0.0", payload) });
    await input.appendAudit(sealed);
    events.push(sealed);
  };
  const result = (status: FactoryResult["status"]): FactoryResult => ({ status, blueprint, artifacts, events, quality: quality ?? checkPackage(blueprint, artifacts), reviewerIndependence });
  for (const role of FACTORY_ROLES) {
    if (ROLE_DEPENDENCIES[role].some(d => !completed.has(d))) throw new Error("factory_role_dependency_missing");
    if (role === "INDEPENDENT_QUALITY_REVIEWER") {
      quality = checkPackage(blueprint, artifacts);
      const inputHash = digest("factory-review-input/2.0.0", { blueprint: blueprintRef(blueprint), artifacts: artifacts.map(a => a.contentHash), quality });
      if (quality.failures.length) {
        await record({ role, attempt: 0, status: "REVISION_REQUIRED", inputHash, outputHashes: [], error: quality.failures.join(";") });
        return result("REVISION_REQUIRED");
      }
      if (input.authoringOnly) {
        await record({ role, attempt: 0, status: "REVIEW_PENDING", inputHash, outputHashes: artifacts.map(a => a.contentHash), error: null });
        return result("AWAITING_HUMAN_REVIEW");
      }
      const independence = assessReviewerIndependence(actors[role], artifacts.map(a => a.author));
      reviewerIndependence = independence;
      if (independence.selfAuthored) {
        await record({ role, attempt: 0, status: "FAILED", inputHash, outputHashes: [], error: "self_review_forbidden" });
        return result("FAILED");
      }
    }
    let succeeded = false;
    const previousFailures: string[] = [];
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const dependencies = freezeDeep(structuredClone(artifacts));
      const inputHash = digest("factory-task-input/2.0.0", { role, blueprint: blueprintRef(blueprint), dependencies: dependencies.map(a => a.contentHash), previousFailures, quality });
      await record({ role, attempt, status: "STARTED", inputHash, outputHashes: [], error: null });
      let candidates: FactoryArtifact[];
      try {
        const drafts = await input.executors[role]({ blueprint, dependencies, attempt, previousFailures: [...previousFailures], quality: quality ? freezeDeep(structuredClone(quality)) : null });
        const expected = blueprint.resources.filter(r => r.role === role);
        if (!Array.isArray(drafts) || drafts.length !== expected.length || new Set(drafts.map(d => d.id)).size !== drafts.length) throw new Error("role_output_set_mismatch");
        candidates = [];
        for (const draft of drafts) {
          if (Object.keys(draft).some(k => !["id", "version", "payload"].includes(k))) throw new Error("generator_envelope_field_forbidden");
          const plan = expected.find(r => r.id === draft.id);
          if (!plan) throw new Error("unplanned_resource");
          const available = [...artifacts, ...candidates];
          const dependencyPins = plan.dependsOn.map(id => {
            const artifact = available.find(a => a.id === id);
            if (!artifact) throw new Error(`resource_dependency_missing:${id}`);
            return { id, version: artifact.version, contentHash: artifact.contentHash };
          });
          const payload = { ...structuredClone(draft), role, author: actors[role], blueprint: blueprintRef(blueprint), dependencies: dependencyPins };
          const artifact = freezeDeep({ ...payload, contentHash: artifactHash(payload) });
          const failures = validateArtifact(blueprint, artifact);
          if (failures.length) throw new Error(failures.join(";"));
          candidates.push(artifact);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "executor_failed";
        previousFailures.push(message);
        await record({ role, attempt, status: attempt < maxAttempts ? "RETRY_REQUIRED" : "FAILED", inputHash, outputHashes: [], error: message });
        if (attempt === maxAttempts) return result("FAILED");
        continue;
      }
      // Audit persistence failure is terminal, never a reason to rerun a paid executor.
      if (input.persistArtifact) for (const artifact of candidates) await input.persistArtifact(artifact);
      await record({ role, attempt, status: "SUCCEEDED", inputHash, outputHashes: candidates.map(c => c.contentHash), error: null });
      artifacts.push(...candidates); completed.add(role); succeeded = true; break;
    }
    if (!succeeded) return result("FAILED");
  }
  return result("AWAITING_HUMAN_REVIEW");
}
