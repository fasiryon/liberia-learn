import { describe, expect, it } from "vitest";
import {
  checkToolkitMapping,
  contentBundleHashPayload,
  governedContentRef,
  hashContentBundle,
  projectLearnerContentBundle,
  resolveRuntimeToolIds,
  sealContentBundle,
  validateContentBundle,
  type ContentBundleV1,
  type ContentBundleValidationCode,
} from "@/lib/content-bundle/v1";
import {
  buildGrade4FractionsFixture,
  G4_FRACTIONS_FIXTURE_IDS as ids,
  G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING as fixtureMapping,
} from "@/lib/content-bundle/v1/fixtures/grade4FractionsFixture";
import { isCanonicalToolId as isRuntimeToolId } from "@/lib/curriculum/v2/tools";
import { GRADE4_MATH_ONTOLOGY_RELEASE } from "@/lib/learning-authority/governedGrade4Math";

// Canonical governed tool namespace = the ids the governed Grade 4 tool policies use.
const GOVERNED_TOOL_IDS = new Set(GRADE4_MATH_ONTOLOGY_RELEASE.toolPolicies.flatMap((policy) => [...policy.allowed, ...policy.prohibited]));
const isGovernedToolId = (toolId: string) => GOVERNED_TOOL_IDS.has(toolId);

// Mutable deep copy for negative cases; the contract types are readonly by design.
const mutable = (): any => structuredClone(buildGrade4FractionsFixture());

function codes(input: unknown): ContentBundleValidationCode[] {
  const result = validateContentBundle(input);
  return result.ok ? [] : result.errors.map((error) => error.code);
}

function expectRejected(input: unknown, code: ContentBundleValidationCode, pathFragment?: string) {
  const result = validateContentBundle(input);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  const match = result.errors.find((error) => error.code === code && (!pathFragment || error.path.includes(pathFragment)));
  expect(match, `expected ${code}${pathFragment ? ` at ${pathFragment}` : ""}; got ${JSON.stringify(result.errors)}`).toBeDefined();
}

function hashOf(bundle: unknown): string {
  const sealed = sealContentBundle(bundle);
  if (!sealed.ok) throw new Error(JSON.stringify(sealed.errors));
  return sealed.sealed.contentHash;
}

const labBinding = (overrides: Record<string, unknown> = {}) => ({
  identity: { itemId: "fixture.member.lab.test", itemVersion: "1", itemKind: "LAB" },
  link: { linkId: "fixture.link.test", linkRevision: "3" },
  lab: { labId: "fixture.lab.test", labVersion: "1.0.0" },
  objectiveIds: [ids.objectives.partsOfSet],
  role: "CORE",
  placement: { lessonItemId: ids.lesson, sceneId: "scene-3" },
  authorityBasis: "GOVERNED_LINK",
  ...overrides,
});

describe("ContentBundle V1: Grade 4 fractions fixture", () => {
  it("validates against the governed tool namespace", () => {
    const result = validateContentBundle(buildGrade4FractionsFixture(), { isGovernedToolId });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("covers objective → lesson → practice → classwork/homework → formative check → unit assessment, with no lab", () => {
    const bundle = buildGrade4FractionsFixture();
    const kinds = bundle.sequence.units[0].entries.map((entry) => governedContentRef(bundle, entry.itemId)?.itemKind);
    expect(kinds).toEqual(["LESSON", "PRACTICE", "PRACTICE", "ASSESSMENT", "CLASSWORK", "HOMEWORK", "ASSESSMENT"]);
    expect(bundle.activities.filter((a) => a.identity.itemKind === "PRACTICE").map((a) => a.scaffolding)).toEqual(["GUIDED", "INDEPENDENT"]);
    expect(bundle.assessments.map((a) => a.role)).toEqual(["FORMATIVE_CHECK", "UNIT_ASSESSMENT"]);
    expect(bundle.labs).toEqual([]);
  });

  it("is unmistakably synthetic and does not reuse the real release, objective or lesson identity", () => {
    const bundle = buildGrade4FractionsFixture();
    expect(bundle.curriculumAuthority.releaseIdentity).toMatch(/^FIXTURE-ONLY:/);
    const serialized = JSON.stringify(bundle);
    for (const realId of [GRADE4_MATH_ONTOLOGY_RELEASE.id, "ll-g4-math-fractions-equal-parts-2026.1", "moe-math-g4-s1-p3-number-theory-and-fraction-obj4"]) {
      expect(serialized).not.toContain(realId);
    }
    const allIds = [bundle.identity.bundleId, bundle.curriculumAuthority.releaseId, ...bundle.curriculumAuthority.objectiveIds, ...bundle.curriculumAuthority.conceptRefs, ...bundle.lessons.map((l) => l.identity.itemId), ...bundle.activities.map((a) => a.identity.itemId), ...bundle.assessments.map((a) => a.identity.itemId), ...bundle.resources.map((r) => r.resourceId)];
    for (const id of allIds) expect(id.startsWith("fixture.")).toBe(true);
    expect(bundle.governance.reviewRefs).toEqual([]);
    expect(bundle.governance.releaseRefs).toEqual([]);
  });
});

describe("GovernedContentRef", () => {
  it("pins bundle version and exact item version", () => {
    expect(governedContentRef(buildGrade4FractionsFixture(), ids.homework)).toEqual({
      bundleId: ids.bundleId,
      bundleVersion: "1.0.0-fixture",
      itemId: ids.homework,
      itemVersion: "1.0.0-fixture",
      itemKind: "HOMEWORK",
    });
  });

  it("refuses to mint a reference for content the bundle does not contain", () => {
    expect(governedContentRef(buildGrade4FractionsFixture(), "fixture.unknown")).toBeNull();
  });
});

describe("ContentBundle V1 validator", () => {
  it("rejects non-objects and unsupported schema versions without throwing", () => {
    expect(codes(null)).toEqual(["malformed"]);
    expect(codes("bundle")).toEqual(["malformed"]);
    const bundle = mutable();
    bundle.schemaVersion = "content-bundle.v0";
    expect(codes(bundle)).toContain("schema_version_unsupported");
  });

  it("rejects duplicate item ids across sections", () => {
    const bundle = mutable();
    bundle.activities[1].identity.itemId = ids.guidedPractice;
    expectRejected(bundle, "duplicate_id", "activities[1].identity.itemId");
    const crossSection = mutable();
    crossSection.assessments[0].identity.itemId = ids.lesson;
    expectRejected(crossSection, "duplicate_id", "assessments[0].identity.itemId");
  });

  it("rejects missing bundle and item versions", () => {
    const bundle = mutable();
    bundle.identity.version = "";
    bundle.activities[2].identity.itemVersion = " ";
    delete bundle.lessons[0].identity.itemVersion;
    expectRejected(bundle, "version_missing", "identity.version");
    expectRejected(bundle, "version_missing", "activities[2].identity.itemVersion");
    expectRejected(bundle, "version_missing", "lessons[0].identity.itemVersion");
  });

  it("rejects malformed curriculum authority and empty objective bindings", () => {
    const bundle = mutable();
    bundle.curriculumAuthority.releaseIdentity = "";
    expectRejected(bundle, "authority_malformed", "curriculumAuthority.releaseIdentity");

    const noObjectives = mutable();
    noObjectives.curriculumAuthority.objectiveIds = [];
    expectRejected(noObjectives, "objectives_empty", "curriculumAuthority.objectiveIds");

    const missingPins = mutable();
    delete missingPins.curriculumAuthority.conceptRefs;
    expectRejected(missingPins, "malformed", "curriculumAuthority.conceptRefs");

    const emptyItem = mutable();
    emptyItem.activities[0].objectiveIds = [];
    expectRejected(emptyItem, "objectives_empty", "activities[0].objectiveIds");

    const unbound = mutable();
    unbound.lessons[0].objectiveIds = ["fixture.obj.not-in-release"];
    expectRejected(unbound, "objective_not_in_authority", "lessons[0].objectiveIds[0]");
  });

  it("rejects unknown and section-mismatched item kinds", () => {
    const bundle = mutable();
    bundle.activities[0].identity.itemKind = "WORKSHEET";
    expectRejected(bundle, "unknown_item_kind", "activities[0].identity.itemKind");
    const mismatch = mutable();
    mismatch.activities[0].identity.itemKind = "LESSON";
    expectRejected(mismatch, "item_kind_section_mismatch", "activities[0].identity.itemKind");
    const quizRole = mutable();
    quizRole.assessments[0].role = "QUIZ";
    expectRejected(quizRole, "item_kind_section_mismatch", "assessments[0].identity.itemKind");
  });

  it("rejects duplicate, invalid and dangling sequence entries and cycles", () => {
    const duplicateOrder = mutable();
    duplicateOrder.sequence.units[0].entries[2].order = 1;
    expectRejected(duplicateOrder, "sequence_order_duplicate", "entries[2].order");

    const negative = mutable();
    negative.sequence.units[0].entries[0].order = -1;
    expectRejected(negative, "sequence_order_invalid");

    const requirement = mutable();
    requirement.sequence.units[0].entries[0].requirement = "MAYBE";
    expectRejected(requirement, "malformed", "entries[0].requirement");

    const dangling = mutable();
    dangling.sequence.units[0].entries[1].prerequisiteItemIds = ["fixture.missing"];
    expectRejected(dangling, "sequence_reference_unknown", "entries[1].prerequisiteItemIds[0]");

    const cycle = mutable();
    cycle.sequence.units[0].entries[0].prerequisiteItemIds = [ids.independentPractice];
    expectRejected(cycle, "sequence_cycle", "sequence");

    const twice = mutable();
    twice.sequence.units[0].entries.push({ itemId: ids.lesson, order: 9, requirement: "REQUIRED", prerequisiteItemIds: [], unlocksItemIds: [] });
    expectRejected(twice, "duplicate_id", "entries[7].itemId");
  });

  it("rejects assessment references without governed definition, item or order-policy identity", () => {
    const noDefinition = mutable();
    delete noDefinition.assessments[1].definition;
    expectRejected(noDefinition, "assessment_identity_missing", "assessments[1].definition");

    const noDefinitionVersion = mutable();
    noDefinitionVersion.assessments[1].definition.definitionVersion = "";
    expectRejected(noDefinitionVersion, "assessment_identity_missing", "definition.definitionVersion");

    const noItemVersion = mutable();
    delete noItemVersion.assessments[0].items[1].assessmentItemVersion;
    expectRejected(noItemVersion, "assessment_identity_missing", "items[1].assessmentItemVersion");

    const noPolicyVersion = mutable();
    noPolicyVersion.assessments[1].itemOrder = { kind: "RANDOMIZED_BY_POLICY", policyId: "fixture.randomization.shuffle" };
    expectRejected(noPolicyVersion, "assessment_identity_missing", "itemOrder.policyVersion");

    const runtimeOrder = mutable();
    runtimeOrder.assessments[1].itemOrder = { kind: "RANDOMIZED_BY_POLICY", policyId: "p", policyVersion: "1", presentedOrder: [2, 0, 1] };
    expectRejected(runtimeOrder, "unknown_field", "itemOrder.presentedOrder");

    const badRole = mutable();
    badRole.assessments[0].role = "MIDTERM";
    expectRejected(badRole, "assessment_role_invalid", "assessments[0].role");
  });

  it("rejects an answer key exposed through a learner-facing resource", () => {
    const bundle = mutable();
    bundle.resources[3].audience = "LEARNER";
    expectRejected(bundle, "resource_audience_conflict", "resources[3].audience");
    const secured = mutable();
    secured.assessments[1].secured.answerKeyResourceId = ids.resources.worksheet;
    expectRejected(secured, "assessment_secret_exposed", "secured.answerKeyResourceId");
  });

  it("rejects inline answer material anywhere in the bundle", () => {
    const bundle = mutable();
    bundle.assessments[0].items[0].correctAnswer = "3/12";
    expectRejected(bundle, "answer_key_inline", "items[0].correctAnswer");
    const extension = mutable();
    extension.extensions = { authoring: { answerKey: ["1/4 of 12 = 3"] } };
    expectRejected(extension, "answer_key_inline", "extensions.authoring.answerKey");
  });

  it("rejects malformed offline asset identity", () => {
    const badHash = mutable();
    badHash.offline.assets[0].sha256 = "not-a-hash";
    expectRejected(badHash, "offline_asset_malformed", "assets[0].sha256");
    const upperHash = mutable();
    upperHash.offline.assets[0].sha256 = upperHash.offline.assets[0].sha256.toUpperCase();
    expectRejected(upperHash, "offline_asset_malformed", "assets[0].sha256");
    const noVersion = mutable();
    noVersion.offline.assets[1].assetVersion = "";
    expectRejected(noVersion, "offline_asset_malformed", "assets[1].assetVersion");
    const badSize = mutable();
    badSize.offline.assets[1].byteSize = 0;
    expectRejected(badSize, "offline_asset_malformed", "assets[1].byteSize");
    const dangling = mutable();
    dangling.resources[0].assetId = "fixture.asset.missing";
    expectRejected(dangling, "reference_unknown", "resources[0].assetId");
    const capability = mutable();
    capability.offline.allowedCapabilities.push("SUMMATIVE_SCORING");
    expectRejected(capability, "malformed", "offline.allowedCapabilities");
  });

  it("rejects renderings that claim source authority", () => {
    const claims = mutable();
    claims.renderings[0].sourceAuthority = true;
    expectRejected(claims, "rendering_claims_authority", "renderings[0]");
    const notDerived = mutable();
    notDerived.renderings[0].derivation = "SOURCE";
    expectRejected(notDerived, "rendering_claims_authority", "renderings[0]");
    const learnerGuide = mutable();
    learnerGuide.renderings[1].audience = "LEARNER";
    expectRejected(learnerGuide, "resource_audience_conflict", "renderings[1].audience");
  });

  it("rejects runtime timestamps, reviewer notes and other unknown fields (fail closed)", () => {
    const runtime = mutable();
    runtime.lessons[0].identity.fetchedAt = "2026-10-13T00:00:00Z";
    expectRejected(runtime, "runtime_field_forbidden", "lessons[0].identity.fetchedAt");
    const notes = mutable();
    notes.governance.reviewerNotes = ["looks good"];
    expectRejected(notes, "unknown_field", "governance.reviewerNotes");
    const approval = mutable();
    approval.governance.approved = true;
    expectRejected(approval, "unknown_field", "governance.approved");
    const unknown = mutable();
    unknown.activities[0].difficultyOverride = "easy";
    expectRejected(unknown, "unknown_field", "activities[0].difficultyOverride");
  });
});

describe("Student-state boundary", () => {
  const studentStateCases: [string, (bundle: ReturnType<typeof mutable>) => void][] = [
    ["studentId on identity", (b) => (b.identity.studentId = "s-1")],
    ["attempts on an activity", (b) => (b.activities[0].attempts = [])],
    ["submission in activity extensions", (b) => (b.activities[1].extensions = { submission: { text: "3" } })],
    ["score on an assessment item ref", (b) => (b.assessments[0].items[0].score = 1)],
    ["evidence on an assessment", (b) => (b.assessments[0].evidence = [])],
    ["grades in bundle extensions", (b) => (b.extensions = { grades: { "s-1": "A" } })],
    ["mastery_level in extensions (snake case)", (b) => (b.extensions = { mastery_level: 0.8 })],
    ["progress on a sequence entry", (b) => (b.sequence.units[0].entries[0].progress = 0.5)],
    ["completion on a lesson", (b) => (b.lessons[0].completion = "DONE")],
    ["attendance in extensions", (b) => (b.extensions = { attendance: [] })],
    ["placementDecision in extensions", (b) => (b.extensions = { placementDecision: "G3" })],
    ["recommendations in extensions", (b) => (b.extensions = { recommendations: [] })],
    ["nextLessonId on a sequence unit", (b) => (b.sequence.units[0].nextLessonId = ids.lesson)],
  ];

  it.each(studentStateCases)("rejects %s", (_label, mutate) => {
    const bundle = mutable();
    mutate(bundle);
    expect(codes(bundle)).toContain("student_state_forbidden");
  });

  it("does not confuse content grade level, evidence intent or lab placement with student state", () => {
    const bundle = mutable();
    bundle.labs.push(labBinding());
    expect(validateContentBundle(bundle).errors).toEqual([]);
  });

  it("keeps student state out of the typed contract", () => {
    const base = buildGrade4FractionsFixture();
    const typed: ContentBundleV1 = {
      ...base,
      identity: {
        ...base.identity,
        // @ts-expect-error studentId is not part of ContentBundleIdentity
        studentId: "s-1",
      },
    };
    const activity: ContentBundleV1["activities"][number] = {
      ...base.activities[0],
      // @ts-expect-error activities carry no submission/grade/attempt state
      submission: null,
    };
    const assessment: ContentBundleV1["assessments"][number] = {
      ...base.assessments[0],
      // @ts-expect-error assessment references carry no attempts, scores or evidence
      attempts: [],
    };
    expect(typed && activity && assessment).toBeTruthy();
  });
});

describe("Lab bindings: member, governed link and lab are separate identities", () => {
  it("accepts a governed link binding whose member id differs from the link id", () => {
    const bundle = mutable();
    bundle.labs.push(labBinding());
    const result = validateContentBundle(bundle);
    expect(result.ok).toBe(true);
    expect(bundle.labs[0].identity.itemId).not.toBe(bundle.labs[0].link.linkId);
  });

  it.each([
    ["link.linkId", { link: { linkRevision: "3" } }],
    ["link.linkRevision", { link: { linkId: "fixture.link.test" } }],
    ["lab.labId", { lab: { labVersion: "1.0.0" } }],
    ["lab.labVersion", { lab: { labId: "fixture.lab.test" } }],
    ["link", { link: undefined }],
    ["lab", { lab: "fixture.lab.test" }],
  ])("requires %s", (path, overrides) => {
    const bundle = mutable();
    bundle.labs.push(labBinding(overrides));
    expectRejected(bundle, "lab_binding_identity_missing", `labs[0].${path}`);
  });

  it.each(["SHOWCASE", "STANDARD_CODE_MATCH", "RAW_LAB_ID", undefined])("rejects authority basis %s", (basis) => {
    const bundle = mutable();
    bundle.labs.push(labBinding({ authorityBasis: basis }));
    expectRejected(bundle, "lab_binding_authority_insufficient", "labs[0].authorityBasis");
  });

  it("rejects the old flat shape (raw lab id without a governed link)", () => {
    const bundle = mutable();
    bundle.labs.push({ ...labBinding({ link: undefined, lab: undefined }), linkId: "x", labId: "y", labVersion: "1" });
    expectRejected(bundle, "unknown_field", "labs[0].labId");
    expectRejected(bundle, "lab_binding_identity_missing", "labs[0].link");
  });

  it("requires placement in a declared lesson", () => {
    const bundle = mutable();
    bundle.labs.push(labBinding({ placement: { lessonItemId: ids.homework, sceneId: null } }));
    expectRejected(bundle, "reference_unknown", "labs[0].placement.lessonItemId");
  });
});

describe("Toolkit: canonical governed tool identity", () => {
  it("rejects required/prohibited collisions but allows an item to narrow a bundle-wide OPTIONAL tool", () => {
    expect(validateContentBundle(buildGrade4FractionsFixture()).ok).toBe(true);

    const sameScope = mutable();
    sameScope.toolkitBindings.push({ toolId: ids.tools.fractionStrips, mode: "REQUIRED", scope: { kind: "ITEM", itemId: ids.unitAssessment }, configuration: {}, internalConfiguration: {}, context: null });
    expectRejected(sameScope, "toolkit_collision");

    const bundleWideProhibition = mutable();
    bundleWideProhibition.toolkitBindings.push({ toolId: ids.tools.calculator, mode: "OPTIONAL", scope: { kind: "ITEM", itemId: ids.homework }, configuration: {}, internalConfiguration: {}, context: null });
    expectRejected(bundleWideProhibition, "toolkit_collision");

    const requiredEverywhere = mutable();
    requiredEverywhere.toolkitBindings[0].mode = "REQUIRED";
    expectRejected(requiredEverywhere, "toolkit_collision", "toolkitBindings[1]");

    const duplicate = mutable();
    duplicate.toolkitBindings.push({ ...duplicate.toolkitBindings[0] });
    expectRejected(duplicate, "toolkit_binding_duplicate");
  });

  it("does not treat runtime registry ids as governed tool identity", () => {
    const runtimeId = mutable();
    runtimeId.toolkitBindings[0].toolId = "fraction-visualizer";
    const result = validateContentBundle(runtimeId, { isGovernedToolId });
    expect(!result.ok && result.errors.some((e) => e.code === "reference_unknown" && e.path.endsWith("toolkitBindings[0].toolId"))).toBe(true);
  });

  it("resolves every bound canonical tool to known runtime ids through the pinned (fixture) mapping", () => {
    const bundle = buildGrade4FractionsFixture();
    expect(checkToolkitMapping(bundle, fixtureMapping, isRuntimeToolId)).toEqual([]);
    expect(resolveRuntimeToolIds(fixtureMapping, "calculator")).toEqual(["basic-calculator", "scientific-calculator"]);
    expect(resolveRuntimeToolIds(fixtureMapping, "fraction-visualizer")).toEqual([]);
  });

  it("reports unpinned, mismatched, unmapped and unknown-runtime mappings without guessing", () => {
    const unpinned = { ...buildGrade4FractionsFixture(), toolkitMapping: null };
    expect(checkToolkitMapping(unpinned, fixtureMapping, isRuntimeToolId).map((i) => i.code)).toEqual(["toolkit_mapping_not_pinned"]);

    const mismatched = { ...fixtureMapping, mappingVersion: "0.0.1" };
    expect(checkToolkitMapping(buildGrade4FractionsFixture(), mismatched, isRuntimeToolId).map((i) => i.code)).toEqual(["toolkit_mapping_mismatch"]);

    const unmapped = { ...fixtureMapping, entries: { calculator: ["basic-calculator"] } };
    expect(checkToolkitMapping(buildGrade4FractionsFixture(), unmapped, isRuntimeToolId)).toEqual([expect.objectContaining({ code: "toolkit_tool_unmapped", toolId: "fraction_strips" })]);

    const unknownRuntime = { ...fixtureMapping, entries: { ...fixtureMapping.entries, fraction_strips: ["fraction_strips"] } };
    expect(checkToolkitMapping(buildGrade4FractionsFixture(), unknownRuntime, isRuntimeToolId)).toEqual([expect.objectContaining({ code: "toolkit_runtime_unknown", toolId: "fraction_strips" })]);
  });

  it("requires a well-formed mapping pin when present", () => {
    const bundle = mutable();
    bundle.toolkitMapping = { mappingId: "m" };
    expectRejected(bundle, "version_missing", "toolkitMapping.mappingVersion");
  });
});

describe("Deterministic content hash", () => {
  const baseHash = hashOf(buildGrade4FractionsFixture());

  it("is a stable sha256 hex digest", () => {
    expect(baseHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOf(buildGrade4FractionsFixture())).toBe(baseHash);
    expect(hashContentBundle(buildGrade4FractionsFixture())).toBe(baseHash);
  });

  it("ignores object key order and the emission order of id-keyed collections and id sets", () => {
    const bundle = mutable();
    bundle.activities.reverse();
    bundle.resources.reverse();
    bundle.toolkitBindings.reverse();
    bundle.offline.assets.reverse();
    bundle.curriculumAuthority.objectiveIds.reverse();
    bundle.curriculumAuthority.conceptRefs.reverse();
    bundle.sequence.units[0].entries.reverse();
    bundle.identity = Object.fromEntries(Object.entries(bundle.identity).reverse());
    expect(hashOf(bundle)).toBe(baseHash);
  });

  const changes: [string, (bundle: ReturnType<typeof mutable>) => void][] = [
    ["an item version", (b) => (b.activities[3].identity.itemVersion = "1.0.1-fixture")],
    ["sequence ordering", (b) => { b.sequence.units[0].entries[4].order = 7; }],
    ["the swap of two sequence positions", (b) => { b.sequence.units[0].entries[4].order = 5; b.sequence.units[0].entries[5].order = 4; }],
    ["a sequence requirement", (b) => (b.sequence.units[0].entries[5].requirement = "REQUIRED")],
    ["instruction step order", (b) => b.activities[0].instructions.learner.reverse()],
    ["the curriculum release identity", (b) => (b.curriculumAuthority.releaseIdentity = "FIXTURE-ONLY:g4-math-fractions@synthetic-1")],
    ["a concept/construct pin", (b) => (b.curriculumAuthority.constructBindingRefs = ["fixture.construct-binding.other"])],
    ["an objective binding", (b) => (b.activities[3].objectiveIds = [ids.objectives.equalParts])],
    ["a resource version", (b) => (b.resources[1].resourceVersion = "1.0.1-fixture")],
    ["an offline asset hash", (b) => (b.offline.assets[0].sha256 = "0".repeat(64))],
    ["an assessment definition version", (b) => (b.assessments[1].definition.definitionVersion = "2")],
    ["an assessment item version", (b) => (b.assessments[1].items[0].assessmentItemVersion = "2")],
    ["FIXED assessment item order", (b) => b.assessments[1].items.reverse()],
    ["the pinned toolkit mapping version", (b) => (b.toolkitMapping.mappingVersion = "0.0.1-fixture-unreviewed")],
    ["composition provenance", (b) => (b.governance.provenanceRefs = ["fixture.provenance.other"])],
    ["lab binding identity (governed link revision)", (b) => b.labs.push(labBinding())],
  ];

  it.each(changes)("changes when %s changes", (_label, mutate) => {
    const bundle = mutable();
    mutate(bundle);
    expect(hashOf(bundle)).not.toBe(baseHash);
  });

  it("changes when the governed link revision of a bound lab changes", () => {
    const a = mutable();
    a.labs.push(labBinding());
    const b = mutable();
    b.labs.push(labBinding({ link: { linkId: "fixture.link.test", linkRevision: "4" } }));
    expect(hashOf(a)).not.toBe(hashOf(b));
  });

  it("hashes the randomization policy, not the runtime question order, for randomized definitions", () => {
    const randomized = (policyVersion: string, reverse = false) => {
      const bundle = mutable();
      bundle.assessments[1].itemOrder = { kind: "RANDOMIZED_BY_POLICY", policyId: "fixture.randomization.shuffle", policyVersion };
      if (reverse) bundle.assessments[1].items.reverse();
      return hashOf(bundle);
    };
    expect(randomized("1")).toBe(randomized("1", true));
    expect(randomized("1")).not.toBe(randomized("2"));
    expect(randomized("1")).not.toBe(baseHash);
  });

  it("excludes the self hash, derived renderings and review/lifecycle/release attestations", () => {
    const bundle = mutable();
    bundle.renderings[0].artifactSha256 = "f".repeat(64);
    bundle.governance.reviewRefs = ["fixture.review.approved"];
    bundle.governance.lifecycleRefs = ["fixture.lifecycle.activated"];
    bundle.governance.releaseRefs = ["fixture.release-record.1"];
    expect(hashOf(bundle)).toBe(baseHash);
    const payload = contentBundleHashPayload(buildGrade4FractionsFixture()) as Record<string, unknown>;
    expect(payload.renderings).toBeUndefined();
    expect(payload.governance).toBeUndefined();
    expect((payload.identity as Record<string, unknown>).contentHash).toBeUndefined();
  });

  it("seals the hash into identity.contentHash, re-validates the sealed bundle, and rejects stale hashes", () => {
    const sealed = sealContentBundle(buildGrade4FractionsFixture());
    expect(sealed.ok).toBe(true);
    expect(sealed.sealed.bundle.identity.contentHash).toBe(baseHash);
    expect(validateContentBundle(sealed.sealed.bundle).ok).toBe(true);
    expect(hashOf(sealed.sealed.bundle)).toBe(baseHash);

    const stale = structuredClone(sealed.sealed.bundle) as any;
    stale.activities[0].identity.itemVersion = "1.0.1-fixture";
    expectRejected(stale, "content_hash_stale", "identity.contentHash");

    const malformed = mutable();
    malformed.identity.contentHash = "abc";
    expectRejected(malformed, "malformed", "identity.contentHash");
  });

  it("seal fails closed for invalid bundles", () => {
    const invalid = mutable();
    invalid.identity.version = "";
    const sealed = sealContentBundle(invalid);
    expect(sealed.ok).toBe(false);
    expect(sealed.sealed).toBeNull();
  });
});

describe("Learner-safe projection", () => {
  const projected = () => {
    const result = projectLearnerContentBundle(buildGrade4FractionsFixture());
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    return result.learnerBundle;
  };

  it("pins one bundle version, hash, release identity, exact member versions and asset hashes for offline", () => {
    const learner = projected();
    const bundle = buildGrade4FractionsFixture();
    const hash = hashOf(bundle);
    expect(learner.source).toEqual({ bundleId: ids.bundleId, bundleVersion: "1.0.0-fixture", contentHash: hash });
    expect(learner.offline).toMatchObject({ audience: "LEARNER", projectionVersion: "learner-projection.v1", bundleId: ids.bundleId, bundleVersion: "1.0.0-fixture", contentHash: hash, releaseIdentity: bundle.curriculumAuthority.releaseIdentity });
    expect(learner.offline.members).toHaveLength(7);
    expect(learner.offline.members.every((m) => m.itemVersion === "1.0.0-fixture")).toBe(true);
    expect(learner.offline.members.find((m) => m.itemId === ids.unitAssessment)).toEqual({ itemId: ids.unitAssessment, itemVersion: "1.0.0-fixture", itemKind: "ASSESSMENT" });
    for (const asset of learner.offline.assets) expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps assessment references but no keys, item lists or scoring guides", () => {
    const learner = projected();
    const serialized = JSON.stringify(learner);
    expect(learner.assessments.map((a) => a.role)).toEqual(["FORMATIVE_CHECK", "UNIT_ASSESSMENT"]);
    for (const assessment of learner.assessments) {
      expect(Object.keys(assessment).sort()).toEqual(["definition", "identity", "itemOrder", "learnerInstructions", "objectiveIds", "role", "title"]);
    }
    expect(serialized).not.toContain(ids.resources.answerKey);
    expect(serialized).not.toContain("fixture.asset.fractions-answer-key");
    expect(serialized).not.toContain("assessment-item");
    expect(serialized).not.toMatch(/secured|scoringGuide|answerKey/i);
  });

  it("strips teacher-only resources, instructions, renderings and all governance references", () => {
    const learner = projected();
    const serialized = JSON.stringify(learner);
    expect(learner.resources.map((r) => r.resourceId).sort()).toEqual([ids.resources.counters, ids.resources.worksheet].sort());
    expect(learner.lessons[0].resourceIds).toEqual([ids.resources.counters]);
    expect(serialized).not.toContain(ids.resources.teacherNote);
    expect(serialized).not.toContain("Model the first sharing");
    expect(learner.renderings.map((r) => r.kind)).toEqual(["WORKBOOK"]);
    expect(serialized).not.toContain("teacher-guide");
    expect(serialized).not.toContain("fixture.provenance");
    expect(serialized).not.toMatch(/governance|reviewRefs|lifecycleRefs|releaseRefs/);
    expect(learner.offline.assets.map((a) => a.assetId).sort()).toEqual(["fixture.asset.bottle-cap-counters", "fixture.asset.parts-of-a-set-worksheet"]);
  });

  it("keeps learner instructions, rubric criteria, canonical allowed tools and learner support", () => {
    const learner = projected();
    const guided = learner.activities.find((a) => a.identity.itemId === ids.guidedPractice)!;
    expect(guided.instructions.map((s) => s.stepId)).toEqual(["g1", "g2"]);
    const classwork = learner.activities.find((a) => a.identity.itemId === ids.classwork)!;
    expect(classwork.rubric).toEqual({ rubricId: "fixture.rubric.g4-math.parts-of-a-set-worksheet", rubricVersion: "1.0.0-fixture", criteria: ["Draws the equal groups", "Writes the fraction of the set"] });
    expect(learner.tools).toEqual([{ toolId: "fraction_strips", mode: "OPTIONAL", scope: { kind: "BUNDLE" }, configuration: { maxDenominator: 12 }, context: "Use strips to check equal parts." }]);
    expect(learner.toolkitMapping).toEqual({ mappingId: fixtureMapping.mappingId, mappingVersion: fixtureMapping.mappingVersion });
    expect(JSON.stringify(learner.tools)).not.toContain("enforcement");
    expect(learner.objectives.objectiveIds).toEqual([ids.objectives.partsOfSet, ids.objectives.equalParts]);
    expect(learner.learnerSupport.accommodations).toHaveLength(2);
    expect(learner.lessons[0].identity).toEqual({ itemId: ids.lesson, itemVersion: "1.0.0-fixture", itemKind: "LESSON" });
  });

  it("carries governed lab bindings unchanged", () => {
    const bundle = mutable();
    bundle.labs.push(labBinding());
    const result = projectLearnerContentBundle(bundle);
    expect(result.ok && result.learnerBundle.labs).toEqual(bundle.labs);
  });

  it("contains no student state", () => {
    const serialized = JSON.stringify(projected());
    expect(serialized).not.toMatch(/"(studentId|attempts?|submissions?|scores?|grades|mastery|progress|completion|attendance|evidence|recommendations?|nextLesson\w*)"\s*:/i);
  });

  it("refuses to project an invalid bundle", () => {
    const bundle = mutable();
    bundle.extensions = { studentId: "s-1" };
    const result = projectLearnerContentBundle(bundle);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0].code).toBe("student_state_forbidden");
  });
});
