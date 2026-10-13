import { describe, expect, it } from "vitest";
import {
  contentBundleHashPayload,
  governedContentRef,
  hashContentBundle,
  projectLearnerContentBundle,
  sealContentBundle,
  validateContentBundle,
  type ContentBundleV1,
  type ContentBundleValidationCode,
} from "@/lib/content-bundle/v1";
import { buildGrade4FractionsFixture, G4_FRACTIONS_FIXTURE_IDS as ids } from "@/lib/content-bundle/v1/fixtures/grade4FractionsFixture";
import { isCanonicalToolId } from "@/lib/curriculum/v2/tools";

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

describe("ContentBundle V1 — Grade 4 fractions fixture", () => {
  it("validates, including against the real toolkit registry", () => {
    const result = validateContentBundle(buildGrade4FractionsFixture(), { isKnownToolId: isCanonicalToolId });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("covers objective → lesson → guided/independent practice → classwork/homework → formative check → unit assessment", () => {
    const bundle = buildGrade4FractionsFixture();
    const kinds = bundle.sequence.units[0].entries.map((entry) => governedContentRef(bundle, entry.itemId)?.itemKind);
    expect(kinds).toEqual(["LESSON", "PRACTICE", "PRACTICE", "ASSESSMENT", "CLASSWORK", "HOMEWORK", "ASSESSMENT"]);
    expect(bundle.activities.filter((a) => a.identity.itemKind === "PRACTICE").map((a) => a.scaffolding)).toEqual(["GUIDED", "INDEPENDENT"]);
    expect(bundle.assessments.map((a) => a.role)).toEqual(["FORMATIVE_CHECK", "UNIT_ASSESSMENT"]);
    expect(bundle.labs).toEqual([]);
  });

  it("is unmistakably synthetic", () => {
    const bundle = buildGrade4FractionsFixture();
    expect(bundle.curriculumAuthority.releaseIdentity).toMatch(/^FIXTURE-ONLY:/);
    const allIds = [bundle.identity.bundleId, bundle.curriculumAuthority.releaseId, ...bundle.curriculumAuthority.objectiveIds, ...bundle.lessons.map((l) => l.identity.itemId), ...bundle.activities.map((a) => a.identity.itemId), ...bundle.assessments.map((a) => a.identity.itemId), ...bundle.resources.map((r) => r.resourceId)];
    for (const id of allIds) expect(id.startsWith("fixture.")).toBe(true);
  });
});

describe("GovernedContentRef", () => {
  it("pins bundle version and exact item version", () => {
    const bundle = buildGrade4FractionsFixture();
    expect(governedContentRef(bundle, ids.homework)).toEqual({
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

    const dangling = mutable();
    dangling.sequence.units[0].entries[1].prerequisiteItemIds = ["fixture.missing"];
    expectRejected(dangling, "sequence_reference_unknown", "entries[1].prerequisiteItemIds[0]");

    const cycle = mutable();
    cycle.sequence.units[0].entries[0].prerequisiteItemIds = [ids.independentPractice];
    expectRejected(cycle, "sequence_cycle", "sequence");

    const twice = mutable();
    twice.sequence.units[0].entries.push({ itemId: ids.lesson, order: 9, prerequisiteItemIds: [], unlocksItemIds: [] });
    expectRejected(twice, "duplicate_id", "entries[7].itemId");
  });

  it("rejects assessment references without governed definition or item identity", () => {
    const noDefinition = mutable();
    delete noDefinition.assessments[1].definition;
    expectRejected(noDefinition, "assessment_identity_missing", "assessments[1].definition");

    const noDefinitionVersion = mutable();
    noDefinitionVersion.assessments[1].definition.definitionVersion = "";
    expectRejected(noDefinitionVersion, "assessment_identity_missing", "definition.definitionVersion");

    const noItemVersion = mutable();
    delete noItemVersion.assessments[0].items[1].assessmentItemVersion;
    expectRejected(noItemVersion, "assessment_identity_missing", "items[1].assessmentItemVersion");

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
    bundle.assessments[0].items[0].correctAnswer = "2/4";
    expectRejected(bundle, "answer_key_inline", "items[0].correctAnswer");
    const extension = mutable();
    extension.extensions = { authoring: { answerKey: ["1/2 = 2/4"] } };
    expectRejected(extension, "answer_key_inline", "extensions.authoring.answerKey");
  });

  it("rejects toolkit required/prohibited collisions but allows an item to narrow a bundle-wide OPTIONAL tool", () => {
    expect(validateContentBundle(buildGrade4FractionsFixture()).ok).toBe(true);

    const sameScope = mutable();
    sameScope.toolkitBindings.push({ toolId: "basic-calculator", mode: "REQUIRED", scope: { kind: "ITEM", itemId: ids.unitAssessment }, configuration: {}, internalConfiguration: {}, context: null });
    expectRejected(sameScope, "toolkit_collision");

    const bundleWideProhibition = mutable();
    bundleWideProhibition.toolkitBindings.push({ toolId: "timer", mode: "PROHIBITED", scope: { kind: "BUNDLE" }, configuration: {}, internalConfiguration: {}, context: null });
    bundleWideProhibition.toolkitBindings.push({ toolId: "timer", mode: "OPTIONAL", scope: { kind: "ITEM", itemId: ids.homework }, configuration: {}, internalConfiguration: {}, context: null });
    expectRejected(bundleWideProhibition, "toolkit_collision");

    const requiredEverywhere = mutable();
    requiredEverywhere.toolkitBindings[0].mode = "REQUIRED";
    expectRejected(requiredEverywhere, "toolkit_collision", "toolkitBindings[1]");

    const duplicate = mutable();
    duplicate.toolkitBindings.push({ ...duplicate.toolkitBindings[0] });
    expectRejected(duplicate, "toolkit_binding_duplicate");

    const unknownTool = mutable();
    unknownTool.toolkitBindings[0].toolId = "fixture-not-a-tool";
    const result = validateContentBundle(unknownTool, { isKnownToolId: isCanonicalToolId });
    expect(!result.ok && result.errors.some((e) => e.code === "reference_unknown" && e.path.endsWith("toolId"))).toBe(true);
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

  it("rejects runtime timestamps and unknown fields (fail closed)", () => {
    const runtime = mutable();
    runtime.lessons[0].identity.fetchedAt = "2026-10-13T00:00:00Z";
    expectRejected(runtime, "runtime_field_forbidden", "lessons[0].identity.fetchedAt");
    const unknown = mutable();
    unknown.activities[0].difficultyOverride = "easy";
    expectRejected(unknown, "unknown_field", "activities[0].difficultyOverride");
  });
});

describe("Student-state boundary", () => {
  const studentStateCases: [string, (bundle: ReturnType<typeof mutable>) => void][] = [
    ["studentId on identity", (b) => (b.identity.studentId = "s-1")],
    ["attempts on an activity", (b) => (b.activities[0].attempts = [])],
    ["submission in activity extensions", (b) => (b.activities[1].extensions = { submission: { text: "1/2" } })],
    ["score on an assessment item ref", (b) => (b.assessments[0].items[0].score = 1)],
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

  it("does not confuse content grade level or lab placement with student state", () => {
    const bundle = mutable();
    bundle.labs.push({
      identity: { itemId: "fixture.lab-binding.test", itemVersion: "1", itemKind: "LAB" },
      linkId: "fixture.link.test",
      labId: "fixture.lab.test",
      labVersion: "1.0.0",
      objectiveIds: [ids.objectives.equivalent],
      role: "OPTIONAL",
      placement: { lessonItemId: ids.lesson, sceneId: null },
      authorityBasis: "GOVERNED_LINK",
    });
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
    expect(typed && activity).toBeTruthy();
  });
});

describe("Lab bindings", () => {
  const binding = () => ({
    identity: { itemId: "fixture.lab-binding.test", itemVersion: "1", itemKind: "LAB" },
    linkId: "fixture.link.test",
    labId: "fixture.lab.test",
    labVersion: "1.0.0",
    objectiveIds: [ids.objectives.equivalent],
    role: "CORE",
    placement: { lessonItemId: ids.lesson, sceneId: "scene-3" },
    authorityBasis: "GOVERNED_LINK",
  });

  it("accepts a governed link binding", () => {
    const bundle = mutable();
    bundle.labs.push(binding());
    expect(validateContentBundle(bundle).ok).toBe(true);
  });

  it.each(["linkId", "labVersion", "labId"])("requires %s", (field) => {
    const bundle = mutable();
    const lab = binding() as Record<string, unknown>;
    delete lab[field];
    bundle.labs.push(lab);
    expectRejected(bundle, "lab_binding_identity_missing", `labs[0].${field}`);
  });

  it.each(["SHOWCASE", "STANDARD_CODE_MATCH", "RAW_LAB_ID", undefined])("rejects authority basis %s", (basis) => {
    const bundle = mutable();
    bundle.labs.push({ ...binding(), authorityBasis: basis });
    expectRejected(bundle, "lab_binding_authority_insufficient", "labs[0].authorityBasis");
  });

  it("requires placement in a declared lesson", () => {
    const bundle = mutable();
    bundle.labs.push({ ...binding(), placement: { lessonItemId: ids.homework, sceneId: null } });
    expectRejected(bundle, "reference_unknown", "labs[0].placement.lessonItemId");
  });
});

describe("Deterministic content hash", () => {
  const baseHash = hashOf(buildGrade4FractionsFixture());

  it("is a stable sha256 hex digest", () => {
    expect(baseHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOf(buildGrade4FractionsFixture())).toBe(baseHash);
  });

  it("ignores object key order and the emission order of id-keyed collections and id sets", () => {
    const bundle = mutable();
    bundle.activities.reverse();
    bundle.resources.reverse();
    bundle.toolkitBindings.reverse();
    bundle.offline.assets.reverse();
    bundle.curriculumAuthority.objectiveIds.reverse();
    bundle.sequence.units[0].entries.reverse();
    bundle.identity = Object.fromEntries(Object.entries(bundle.identity).reverse());
    expect(hashOf(bundle)).toBe(baseHash);
  });

  const changes: [string, (bundle: ReturnType<typeof mutable>) => void][] = [
    ["an item version", (b) => (b.activities[3].identity.itemVersion = "1.0.1-fixture")],
    ["sequence ordering", (b) => { b.sequence.units[0].entries[4].order = 7; }],
    ["the swap of two sequence positions", (b) => { b.sequence.units[0].entries[4].order = 5; b.sequence.units[0].entries[5].order = 4; }],
    ["instruction step order", (b) => b.activities[0].instructions.learner.reverse()],
    ["the curriculum release identity", (b) => (b.curriculumAuthority.releaseIdentity = "FIXTURE-ONLY:g4-math-fractions@synthetic-1")],
    ["an objective binding", (b) => (b.activities[3].objectiveIds = [ids.objectives.equivalent])],
    ["a resource version", (b) => (b.resources[1].resourceVersion = "1.0.1-fixture")],
    ["an offline asset hash", (b) => (b.offline.assets[0].sha256 = "0".repeat(64))],
    ["an assessment definition version", (b) => (b.assessments[1].definition.definitionVersion = "2")],
  ];

  it.each(changes)("changes when %s changes", (_label, mutate) => {
    const bundle = mutable();
    mutate(bundle);
    expect(hashOf(bundle)).not.toBe(baseHash);
  });

  it("excludes derived renderings and governance records", () => {
    const bundle = mutable();
    bundle.renderings[0].artifactSha256 = "f".repeat(64);
    bundle.governance.reviewIds = ["fixture.review.approved"];
    bundle.governance.reviewerNotes.push("approved");
    bundle.governance.releaseRecordId = "fixture.release-record.1";
    expect(hashOf(bundle)).toBe(baseHash);
    const payload = contentBundleHashPayload(buildGrade4FractionsFixture()) as Record<string, unknown>;
    expect(payload.renderings).toBeUndefined();
    expect(payload.governance).toBeUndefined();
  });

  it("hashContentBundle matches the sealed hash and seal fails closed", () => {
    expect(hashContentBundle(buildGrade4FractionsFixture())).toBe(baseHash);
    const invalid = mutable();
    invalid.identity.version = "";
    const sealed = sealContentBundle(invalid);
    expect(sealed.ok).toBe(false);
  });
});

describe("Learner-safe projection", () => {
  const projected = () => {
    const result = projectLearnerContentBundle(buildGrade4FractionsFixture());
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    return result.learnerBundle;
  };

  it("binds the exact source version and content hash for offline packaging", () => {
    const learner = projected();
    const hash = hashOf(buildGrade4FractionsFixture());
    expect(learner.source).toEqual({ bundleId: ids.bundleId, bundleVersion: "1.0.0-fixture", contentHash: hash });
    expect(learner.offline).toMatchObject({ bundleId: ids.bundleId, bundleVersion: "1.0.0-fixture", contentHash: hash, packageable: true });
  });

  it("keeps assessment references but no keys, item lists or scoring guides", () => {
    const learner = projected();
    const serialized = JSON.stringify(learner);
    expect(learner.assessments.map((a) => a.role)).toEqual(["FORMATIVE_CHECK", "UNIT_ASSESSMENT"]);
    for (const assessment of learner.assessments) {
      expect(Object.keys(assessment).sort()).toEqual(["definition", "identity", "learnerInstructions", "objectiveIds", "role", "title"]);
    }
    expect(serialized).not.toContain(ids.resources.answerKey);
    expect(serialized).not.toContain("fixture.asset.fractions-answer-key");
    expect(serialized).not.toContain("assessment-item");
    expect(serialized).not.toMatch(/secured|scoringGuide|answerKey/i);
  });

  it("strips teacher-only resources, instructions, renderings and reviewer notes", () => {
    const learner = projected();
    const serialized = JSON.stringify(learner);
    expect(learner.resources.map((r) => r.resourceId).sort()).toEqual([ids.resources.fractionStrips, ids.resources.worksheet].sort());
    expect(learner.lessons[0].resourceIds).toEqual([ids.resources.fractionStrips]);
    expect(serialized).not.toContain(ids.resources.teacherNote);
    expect(serialized).not.toContain("Model the first comparison");
    expect(learner.renderings.map((r) => r.kind)).toEqual(["WORKBOOK"]);
    expect(serialized).not.toContain("teacher-guide");
    expect(serialized).not.toContain("FIXTURE: internal note");
    expect(serialized).not.toContain("releaseIdentity");
    expect(learner.offline.assets.map((a) => a.assetId).sort()).toEqual(["fixture.asset.fraction-strips", "fixture.asset.fractions-worksheet"]);
  });

  it("keeps learner instructions, rubric criteria, allowed tools and learner support", () => {
    const learner = projected();
    const guided = learner.activities.find((a) => a.identity.itemId === ids.guidedPractice)!;
    expect(guided.instructions.map((s) => s.stepId)).toEqual(["g1", "g2"]);
    const classwork = learner.activities.find((a) => a.identity.itemId === ids.classwork)!;
    expect(classwork.rubric).toEqual({ rubricId: "fixture.rubric.g4-math.fractions-worksheet", rubricVersion: "1.0.0-fixture", criteria: ["Shows the strips used", "Writes the equal fraction"] });
    expect(learner.tools).toEqual([{ toolId: "fraction-visualizer", mode: "OPTIONAL", scope: { kind: "BUNDLE" }, configuration: { maxDenominator: 12 }, context: "Use strips to check equality." }]);
    expect(JSON.stringify(learner.tools)).not.toContain("enforcement");
    expect(learner.objectives.objectiveIds).toEqual([ids.objectives.equivalent, ids.objectives.compare]);
    expect(learner.learnerSupport.accommodations).toHaveLength(2);
    expect(learner.lessons[0].identity).toEqual({ itemId: ids.lesson, itemVersion: "1.0.0-fixture", itemKind: "LESSON" });
  });

  it("carries governed lab bindings unchanged", () => {
    const bundle = mutable();
    bundle.labs.push({ identity: { itemId: "fixture.lab-binding.test", itemVersion: "1", itemKind: "LAB" }, linkId: "fixture.link.test", labId: "fixture.lab.test", labVersion: "1.0.0", objectiveIds: [ids.objectives.equivalent], role: "CORE", placement: { lessonItemId: ids.lesson, sceneId: null }, authorityBasis: "GOVERNED_LINK" });
    const result = projectLearnerContentBundle(bundle);
    expect(result.ok && result.learnerBundle.labs).toEqual(bundle.labs);
  });

  it("contains no student state", () => {
    const serialized = JSON.stringify(projected());
    expect(serialized).not.toMatch(/"(studentId|attempts?|submissions?|scores?|grades|mastery|progress|completion|attendance|recommendations?|nextLesson\w*)"\s*:/i);
  });

  it("refuses to project an invalid bundle", () => {
    const bundle = mutable();
    bundle.extensions = { studentId: "s-1" };
    const result = projectLearnerContentBundle(bundle);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0].code).toBe("student_state_forbidden");
  });
});
