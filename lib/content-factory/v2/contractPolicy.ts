import { createHash } from "crypto";
import type { AuthoringInput } from "./authoringInput";

/** Contract 1.0.0 bytes and the FT-A001 amendment, each pinned by raw SHA-256. */
export const FIRST_TEN_CONTRACT_PIN = {
  version: "liberialearn-first-ten-modernization-contract/1.0.0",
  sourceRef: "git:ac196397c:curriculum/modernization/v1/first-ten/spec.json",
  sha256: "648ec61a72e2ddff147444dadae75aff321866cfc660498a792b6a3b48e7a28b",
} as const;
export const FIRST_TEN_AMENDMENT_PINS = [{
  amendmentId: "FT-A001", amendmentVersion: "1.0.0",
  sourceRef: "git:bf8e57a2e:curriculum/modernization/v1/first-ten/amendments/FT-A001-retention-policy-status.json",
  sha256: "faae49b48338ead61c91d12729bfbd9569a8ae25de423957e201b700658d37aa",
}] as const;

export const V021_AMENDMENT_PINS = [...FIRST_TEN_AMENDMENT_PINS, {
  amendmentId: "FT-A002", amendmentVersion: "1.0.0",
  sourceRef: "repo-path:curriculum/factory-v2/authoring/first-three/amendments/FT-A002-v021-assessment-counts.json",
  sha256: "1db4c015330045b2e9a906a0ea961c34917aac21d8c2182141cfafac6fc116cf",
}] as const;

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
type ContractLesson = { contentId: string; misconceptions?: { id: string; misconceptionId: string }[] };
type Contract = { contractVersion: string; lessons: ContractLesson[]; retentionPolicy: Record<string, unknown> & { policyId: string; version: string; status: string } };
type Amendment = { amendmentId: string; amendmentVersion: string; effectiveDesignation: string; target: { sha256: string }; changes: { op: "replace"; path: string; from: unknown; to: unknown }[] };

/** Read the pinned contract and apply every pinned amendment. Any byte or value drift fails closed. */
export function loadAmendedFirstTenContract(contractBytes: Buffer, amendmentBytes: readonly Buffer[], generation: "V2" | "V0.2.1" = "V2") {
  const amendmentPins = generation === "V0.2.1" ? V021_AMENDMENT_PINS : FIRST_TEN_AMENDMENT_PINS;
  if (sha256(contractBytes) !== FIRST_TEN_CONTRACT_PIN.sha256) throw new Error("first_ten_contract_hash_mismatch");
  if (amendmentBytes.length !== amendmentPins.length) throw new Error("first_ten_amendment_set_mismatch");
  const contract = JSON.parse(contractBytes.toString("utf8")) as Contract;
  if (contract.contractVersion !== FIRST_TEN_CONTRACT_PIN.version) throw new Error("first_ten_contract_version_mismatch");
  const amendments = amendmentBytes.map((bytes, index) => {
    const pin = amendmentPins[index];
    if (sha256(bytes) !== pin.sha256) throw new Error(`first_ten_amendment_hash_mismatch:${pin.amendmentId}`);
    const amendment = JSON.parse(bytes.toString("utf8")) as Amendment;
    if (amendment.amendmentId !== pin.amendmentId || amendment.amendmentVersion !== pin.amendmentVersion || amendment.target.sha256 !== FIRST_TEN_CONTRACT_PIN.sha256) throw new Error(`first_ten_amendment_target_mismatch:${pin.amendmentId}`);
    for (const change of amendment.changes) {
      const keys = change.path.split("/").slice(1), last = keys.pop()!;
      const parent = keys.reduce<Record<string, unknown>>((node, key) => node[key] as Record<string, unknown>, contract as unknown as Record<string, unknown>);
      if (change.op !== "replace" || JSON.stringify(parent[last]) !== JSON.stringify(change.from)) throw new Error(`first_ten_amendment_from_mismatch:${pin.amendmentId}:${change.path}`);
      parent[last] = change.to;
    }
    return { ...pin, effectiveDesignation: amendment.effectiveDesignation };
  });
  return { contract, designation: amendments.at(-1)?.effectiveDesignation ?? contract.contractVersion, amendments };
}
export type AmendedFirstTenContract = ReturnType<typeof loadAmendedFirstTenContract>;

const PREREQUISITE = /^ft\d\d-p\d+$/, LOCAL = /^ft\d\d-m\d+$/, CATALOGUE = /^mc-[a-z]+-[a-z0-9-]+$/;

/** Founder decision D6 (C9). Explicit local-to-catalogue map, built only from the contract lesson. */
export function buildMisconceptionMap(lesson: ContractLesson, bindings: readonly { id: string }[]) {
  const map = new Map<string, string>();
  for (const m of lesson.misconceptions ?? []) {
    if (!LOCAL.test(m.id) || !CATALOGUE.test(m.misconceptionId)) throw new Error(`MISCONCEPTION_MAP_INVALID:${m.id}`);
    if (map.has(m.id)) throw new Error(`MISCONCEPTION_MAP_DUPLICATE_LOCAL:${m.id}`);
    map.set(m.id, m.misconceptionId);
  }
  if (new Set(map.values()).size !== map.size) throw new Error("MISCONCEPTION_MAP_NOT_INJECTIVE");
  for (const binding of bindings) if (!map.has(binding.id)) throw new Error(`MISCONCEPTION_ID_UNMAPPED:${binding.id}`);
  if (map.size !== bindings.length) throw new Error("MISCONCEPTION_MAP_BINDING_COUNT_MISMATCH");
  return map;
}

/** Translate one emitted id. Prerequisite gaps pass through tagged; catalogue ids are never translated twice. */
export function translateMisconceptionSignal(map: ReadonlyMap<string, string>, id: string) {
  if (PREREQUISITE.test(id)) return { kind: "PREREQUISITE_GAP" as const, id };
  if (id.startsWith("mc-")) throw new Error(`MISCONCEPTION_ALREADY_CATALOGUE:${id}`);
  const catalogueId = map.get(id);
  if (!catalogueId) throw new Error(`MISCONCEPTION_ID_UNMAPPED:${id}`);
  return { kind: "MISCONCEPTION" as const, localId: id, id: catalogueId };
}

/** Every misconception id the authored input emits: scenes, formative evidence, items and protected signals. */
export function emittedMisconceptionIds(input: AuthoringInput) {
  const ids = new Set<string>();
  const visit = (value: unknown, key?: string): void => {
    if (Array.isArray(value)) { for (const v of value) visit(v, key); return; }
    if (typeof value === "string") { if (key === "misconceptionId" || key === "misconceptionIds") ids.add(value); return; }
    if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) visit(v, k);
  };
  visit(input.resources);
  return [...ids].sort();
}

export function misconceptionCrosswalk(contract: AmendedFirstTenContract, input: AuthoringInput) {
  const lesson = contract.contract.lessons.find(l => l.contentId === input.source.contentId);
  if (!lesson) throw new Error(`first_ten_contract_lesson_missing:${input.source.contentId}`);
  const map = buildMisconceptionMap(lesson, input.misconceptionBindings);
  const emitted = emittedMisconceptionIds(input).map(id => translateMisconceptionSignal(map, id));
  return {
    schemaVersion: "factory-misconception-crosswalk/1.0.0", contract: contract.designation,
    rule: "Packages keep local ids. Consumers translate through this map before Assessment V2 or records; unknown or already-catalogue ids are refused.",
    map: Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b))),
    emitted,
  };
}

const RETENTION_VERSIONS = ["factory-retention/1.0.0", "factory-retention/1.1.0"] as const;
type RetentionEnvelope = { schemaVersion?: string; delayDays: number; items: unknown[]; additionalProbes?: { delayDays: number; required: boolean }[] };

/** Founder decision D8 (C11). One required 7-day check; 21-day probes only as optional factory-retention/1.1.0. */
export function validateRetentionEnvelope(envelope: RetentionEnvelope, objectiveCount: number) {
  const version = envelope.schemaVersion ?? RETENTION_VERSIONS[0];
  if (!(RETENTION_VERSIONS as readonly string[]).includes(version)) throw new Error(`RETENTION_SCHEMA_UNKNOWN:${version}`);
  if (envelope.delayDays !== 7) throw new Error("RETENTION_PRIMARY_DELAY_NOT_7");
  if (envelope.items.length !== objectiveCount) throw new Error("RETENTION_OBJECTIVE_COVERAGE");
  const seen = new Set<number>();
  if (envelope.additionalProbes !== undefined) {
    if (version !== "factory-retention/1.1.0") throw new Error("RETENTION_ADDITIONAL_PROBES_REQUIRE_1_1_0");
    for (const probe of envelope.additionalProbes) {
      if (probe.delayDays <= envelope.delayDays) throw new Error("RETENTION_ADDITIONAL_DELAY_NOT_LATER");
      if (seen.has(probe.delayDays)) throw new Error("RETENTION_ADDITIONAL_DELAY_DUPLICATE");
      if (probe.required !== false) throw new Error("RETENTION_ADDITIONAL_PROBE_MUST_BE_OPTIONAL");
      seen.add(probe.delayDays);
    }
  }
  return { version, delays: [envelope.delayDays, ...seen] };
}

/** Founder decision D9 via FT-A001. Anything other than the amended baseline status is refused. */
export function retentionPolicyStatus(contract: AmendedFirstTenContract) {
  const policy = contract.contract.retentionPolicy;
  if (policy.status !== "INTERNAL_ENGINEERING_BASELINE") throw new Error(`RETENTION_POLICY_STATUS_UNAMENDED:${policy.status}`);
  return { policyRef: `${policy.policyId}@${policy.version}`, status: policy.status, contract: contract.designation, officialUse: false } as const;
}
