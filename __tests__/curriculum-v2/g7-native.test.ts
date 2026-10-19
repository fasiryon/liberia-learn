// Grade 7 Native Curriculum V1: candidate validity, honest authority gaps, provenance, learner/reviewer
// separation, exit-ticket keys, release-binding preparation, evidence handoff and the committed package.
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildG7NativePackageFiles, candidateReleaseManifest, draftReleaseShape, G7_PACKAGE_DIR, releaseBindingPlan } from "@/lib/curriculum/v2/g7NativePackage";
import { evaluateG7Candidate, G7_ASSET_DIR, G7_ASSET_URL_BASE, G7_NATIVE_LESSONS, g7LearnerProjection, loadG7Candidate } from "@/lib/curriculum/v2/g7Native";
import { G7_LEGACY_COMPARISON, legacyBodyHeadings, loadLegacyExtract, verifyLegacyExtract } from "@/lib/curriculum/v2/g7NativeLegacy";
import { G7_EXIT_ITEMS, G7_REVISION_LEDGER, type ExitItemVerification } from "@/lib/curriculum/v2/g7NativeReview";
import { g7NativePreviewEntry } from "@/lib/curriculum/v2/g7NativePreview";
import { validateOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import { validateReleaseManifest } from "@/lib/learning-authority/releaseManifests";
import { wordForm } from "@/lib/learner-experience/demo/placeValue";
import { buildEvidenceEnvelope } from "@/lib/learner-experience/evidenceHandoff";
import { initialProgress, recordResponse, revealStep, type ExperienceProgress } from "@/lib/learner-experience/progress";
import { loadPrototypeExperience } from "@/lib/learner-experience/prototypeRoute";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";
import type { LessonExperience } from "@/lib/learner-experience/types";

type StructuredItem = { id: string; kind: string; grade: number; subject: string; text: string; provenance: { sourceMember: string; pages: number[] } };
const structured = JSON.parse(readFileSync("curriculum/structured/moe-structured-v1.json", "utf8")) as { items: StructuredItem[] };
const byId = new Map(structured.items.map((item) => [item.id, item]));
const MATH = G7_NATIVE_LESSONS.find((lesson) => lesson.subject === "MATH")!;
const LITERACY = G7_NATIVE_LESSONS.find((lesson) => lesson.subject === "LITERACY")!;
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn(async () => null) }));
const IMPORTS_REVIEWER_MODULE = /from\s+["'][^"']*\/g7Native(Review|Preview|Legacy)["']/;
const sourceFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? sourceFiles(path.join(dir, entry.name)) : /\.(t|j)sx?$/.test(entry.name) ? [path.join(dir, entry.name)] : []);
const masteryScenes = (experience: LessonExperience) => experience.scenes.filter((scene) => scene.type === "MASTERY_CHECK");

describe("Grade 7 native candidates pass the existing Curriculum V2 gates", () => {
  it.each(G7_NATIVE_LESSONS.map((lesson) => [lesson.key, lesson] as const))("%s: strict parse, zero validator errors, REVIEW_BLOCKED by authority gaps only", (_key, lesson) => {
    const outcome = evaluateG7Candidate(lesson);
    expect(outcome.errors).toEqual([]);
    expect(outcome.status).toBe("REVIEW_BLOCKED");
    const blocking = new Set(outcome.gaps.filter((gap) => gap.severity === "BLOCKING").map((gap) => gap.code));
    // No instructional or deliverability blocker: every BLOCKING gap is an authority, provenance or governed-item gap.
    expect([...blocking].every((code) => ["MOE_OBJECTIVE_UNBOUND", "MOE_SOURCE_STRUCTURING_DEFECT", "MOE_GRADE_SCOPE_REVIEW", "TEMPLATE_CELL_MISSING", "ONTOLOGY_RELEASE_MISSING", "LEGACY_COMPARISON_SIGNOFF", "SCOPE_EXTENSION_UNAPPROVED", "ASSESSMENT_ITEMS_PENDING"].includes(code))).toBe(true);
    expect(blocking.has("SCENE_NOT_DELIVERABLE")).toBe(false);
    for (const code of ["MOE_OBJECTIVE_UNBOUND", "TEMPLATE_CELL_MISSING", "ONTOLOGY_RELEASE_MISSING", "LEGACY_COMPARISON_SIGNOFF", "ASSESSMENT_ITEMS_PENDING"]) expect(blocking.has(code)).toBe(true);
  });

  it("covers the mission's teaching sequence in each lesson", () => {
    for (const lesson of G7_NATIVE_LESSONS) {
      const purposes = new Set(loadG7Candidate(lesson).scenes.map((scene) => scene.purpose));
      for (const purpose of ["HOOK_PHENOMENON", "STATE_OBJECTIVE", "ACTIVATE_PRIOR_KNOWLEDGE", "EXPLAIN_CONCEPT", "MODEL_WORKED_EXAMPLE", "GUIDED_PRACTICE", "INDEPENDENT_PRACTICE", "ADDRESS_MISCONCEPTION", "REVIEW", "ASSESS_MASTERY", "REFLECT"]) {
        expect(purposes.has(purpose as never), `${lesson.key} lacks ${purpose}`).toBe(true);
      }
    }
  });

  it("only the literacy lesson carries the grade-scope and structuring blockers", () => {
    const codes = (lesson: typeof MATH) => evaluateG7Candidate(lesson).gaps.map((gap) => gap.code);
    expect(codes(LITERACY)).toEqual(expect.arrayContaining(["MOE_SOURCE_STRUCTURING_DEFECT", "MOE_GRADE_SCOPE_REVIEW"]));
    expect(codes(MATH)).not.toContain("MOE_GRADE_SCOPE_REVIEW");
  });
});

describe("authority gaps are real and every MOE relationship is exact", () => {
  it("the structured source has no Grade 7 objective these lessons could bind to", () => {
    const g7 = structured.items.filter((item) => item.kind === "OBJECTIVE" && item.grade === 7);
    expect(g7.filter((item) => item.subject === "MATH" && /place value|place-value|million|thousandth/i.test(item.text))).toEqual([]);
    expect(g7.filter((item) => item.subject === "LITERACY" && /essay|argument|paragraph|composition|thesis|persuasi/i.test(item.text))).toEqual([]);
  });

  it("every structured reference resolves with the same grade, source member, pages and verbatim text", () => {
    for (const lesson of G7_NATIVE_LESSONS) for (const objective of lesson.objectives) for (const reference of objective.moeReferences) {
      if (!reference.moeItemId) continue;
      const item = byId.get(reference.moeItemId);
      expect(item, reference.moeItemId).toBeDefined();
      expect(item!.kind).toBe("OBJECTIVE");
      expect([item!.grade, item!.provenance.sourceMember, item!.provenance.pages, item!.text.trim()]).toEqual([reference.grade, reference.sourceMember, [...reference.pages], reference.text]);
      if (reference.relation === "PREREQUISITE_FOR") expect(item!.grade).toBe(7);
      if (reference.relation === "BUILDS_ON") expect(item!.grade).toBeLessThan(7);
      if (reference.relation === "LATER_GRADE_SCOPE") expect(item!.grade).toBeGreaterThan(7);
    }
  });

  it("unstructured references quote the Grade 7 OCR page exactly, and the structured source filed that text as ACTIVITY", () => {
    const ocr = JSON.parse(readFileSync("curriculum/sources/ocr/GRADE-7-9--English-7-9.json", "utf8")) as { pages: { page: number; text: string }[] };
    const flat = (text: string) => text.replace(/\s+/g, " ").trim();
    for (const reference of LITERACY.objectives.flatMap((objective) => objective.moeReferences).filter((ref) => ref.relation === "SOURCE_TEXT_UNSTRUCTURED")) {
      const page = ocr.pages.find((candidate) => candidate.page === reference.pages[0])!;
      expect(page.text).toMatch(/GRADE:\s*7/);
      expect(flat(page.text)).toContain(flat(reference.text));
    }
    expect(byId.get("moe-english-g7-s1-p1-constructing-sentences-antroduction-to-literatur-act1")).toMatchObject({ kind: "ACTIVITY", provenance: { pages: [4] } });
  });

  it("a misfiled reference names the structured item that holds the same text, and its OCR page is period II", () => {
    const ocr = JSON.parse(readFileSync("curriculum/sources/ocr/GRADE-7-9--English-7-9.json", "utf8")) as { pages: { page: number; text: string }[] };
    const misfiled = LITERACY.objectives.flatMap((objective) => objective.moeReferences).filter((ref) => ref.misfiledAs);
    expect(misfiled.length).toBeGreaterThan(0);
    for (const reference of misfiled) {
      const item = byId.get(reference.misfiledAs!.itemId)!;
      expect(item).toMatchObject({ kind: reference.misfiledAs!.kind, grade: 7, provenance: { pages: [...reference.pages] } });
      expect(reference.text).toContain(item.text.trim());
      expect(reference.sourceColumn).toBe("OBJECTIVES");
    }
    // OCR reads the Roman period numerals as digits: p.2 "1", p.4 "11", p.6 "111".
    expect(["2", "4", "6"].map((page) => ocr.pages.find((candidate) => candidate.page === Number(page))!.text.match(/PERIOD:\s*(\S+)/)![1])).toEqual(["1", "11", "111"]);
  });

  it("no Grade 7 template cell or release exists, and nothing here registers one", () => {
    expect(readdirSync("lib/learning-authority/cells").filter((file) => /grade7|g7/i.test(file))).toEqual([]);
    const scope = JSON.parse(readFileSync("curriculum/releases/k12-scope.json", "utf8")) as { registeredReleases: { releaseId: string; grade: number }[] };
    expect(scope.registeredReleases.filter((release) => release.grade === 7)).toEqual([]);
  });
});

describe("legacy provenance matches the read-only snapshot", () => {
  const snapshot = JSON.parse(readFileSync("artifacts/curriculum-cleanup-v1/snapshot.json", "utf8")) as { capturedAt: string; contents: Record<string, unknown>[]; references: { table: string; value: string; rows: number; policy: string }[] };
  it.each(G7_NATIVE_LESSONS.map((lesson) => [lesson.key, lesson] as const))("%s", (_key, lesson) => {
    const row = snapshot.contents.find((content) => content.contentId === lesson.legacy.contentId)!;
    expect(row).toMatchObject({ id: lesson.legacy.contentPk, title: lesson.legacy.title, grade: 7, subject: lesson.subject, status: lesson.legacy.status, payloadApprovalStatus: lesson.legacy.payloadApprovalStatus, unitId: lesson.legacy.unitId, sectionCount: lesson.legacy.sectionCount, currentRevisionId: lesson.legacy.currentRevisionId });
    expect(snapshot.capturedAt).toBe(lesson.legacy.snapshot.capturedAt);
    const refs = snapshot.references.filter((ref) => ref.value === lesson.legacy.contentId).map(({ table, rows, policy }) => ({ table, rows, policy }));
    expect(refs.sort((a, b) => a.table.localeCompare(b.table))).toEqual([...lesson.legacy.learnerReferences].sort((a, b) => a.table.localeCompare(b.table)));
  });

  it("the revision ledger accounts for every scene, and the recorded legacy comparison awaits sign-off", () => {
    for (const lesson of G7_NATIVE_LESSONS) {
      const ledger = G7_REVISION_LEDGER[lesson.key];
      expect(ledger.entries.map((entry) => entry.sceneId)).toEqual(loadG7Candidate(lesson).scenes.map((scene) => scene.id));
      expect(ledger.legacyComparison).toBe("RECORDED_AWAITING_REVIEWER_SIGNOFF");
      expect(ledger.titleRevision.from).toBe(lesson.legacy.title);
      expect(ledger.titleRevision.to).toBe(loadG7Candidate(lesson).title);
    }
  });
});

describe("legacy revisions were read read-only and compared section by section", () => {
  it.each(G7_NATIVE_LESSONS.map((lesson) => [lesson.key, lesson] as const))("%s: the committed extract is the exact current revision, and its hash recomputes", (_key, lesson) => {
    const extract = loadLegacyExtract(lesson);
    const evidence = verifyLegacyExtract(lesson, extract);
    expect(evidence).toMatchObject({ revisionId: lesson.legacy.currentRevisionId, matchesRequestedRevision: true, contentHashMatches: true, storedContentHash: lesson.legacy.bodyExtract.contentHash });
    expect(extract.extraction.transactionReadOnly).toBe("on");
    expect(extract.extraction.capturedAt).toBe(lesson.legacy.bodyExtract.capturedAt);
    expect(extract.verification).toMatchObject({ revisionFound: true, revisionBelongsToRow: true, isCurrentRevision: true, contentHashMatches: true, liveRowEqualsRevision: true });
    expect(extract.content).toMatchObject({ id: lesson.legacy.contentPk, contentId: lesson.legacy.contentId, title: lesson.legacy.title, unitId: lesson.legacy.unitId });
    expect(extract.provenance.currentRevisionId).toBe(lesson.legacy.currentRevisionId);
  });

  it("the extracts hold lesson content only: no user, author, editor or school identifiers", () => {
    for (const lesson of G7_NATIVE_LESSONS) {
      const extract = loadLegacyExtract(lesson);
      for (const field of ["editedById", "schoolId", "authorUserId"]) {
        expect(Object.keys(extract.content)).not.toContain(field);
        for (const revision of extract.revisions) expect(Object.keys(revision)).not.toContain(field);
      }
      expect(JSON.stringify(extract)).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    }
  });

  it.each(G7_NATIVE_LESSONS.map((lesson) => [lesson.key, lesson] as const))("%s: the matrix covers every legacy section and every candidate scene", (_key, lesson) => {
    const comparison = G7_LEGACY_COMPARISON[lesson.key];
    const rows = comparison.sections.map((row) => row.legacySection);
    for (const heading of legacyBodyHeadings(loadLegacyExtract(lesson))) expect(rows, heading).toContain(heading);
    const sceneIds = loadG7Candidate(lesson).scenes.map((scene) => scene.id);
    const referenced = [...comparison.sections.flatMap((row) => row.candidateScenes), ...comparison.newScenes.map((scene) => scene.sceneId), ...comparison.recommendations.flatMap((item) => item.scenes)];
    for (const id of referenced) expect(sceneIds, id).toContain(id);
    for (const id of sceneIds) expect(referenced, `${id} is not compared`).toContain(id);
    const ids = [...comparison.legacyConcerns, ...comparison.candidateConcerns, ...comparison.recommendations].map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const objective of comparison.objectives.flatMap((row) => row.candidate)) expect(lesson.objectives.map((candidate) => candidate.id)).toContain(objective);
    expect(comparison.alignment.every((decision) => decision.options.length >= 2 && decision.evidence.length > 0)).toBe(true);
  });

  it("applied recommendations are really in the package, and nothing else is applied", () => {
    const applied = G7_NATIVE_LESSONS.flatMap((lesson) => G7_LEGACY_COMPARISON[lesson.key].recommendations.filter((item) => item.applied).map((item) => item.id));
    expect(applied.sort()).toEqual(["R-L1", "R-L2", "R-L3", "R-L4", "R-L5", "R-L6", "R-L7", "R-M1", "R-M2", "R-M3"]);
    expect(JSON.stringify(G7_REVISION_LEDGER)).not.toMatch(/West African/);
    expect(LITERACY.objectives.flatMap((objective) => objective.moeReferences).some((ref) => ref.misfiledAs)).toBe(true);
    const mathScenes = loadG7Candidate(MATH).scenes.map((scene) => scene.id);
    const litScenes = loadG7Candidate(LITERACY).scenes.map((scene) => scene.id);
    for (const id of ["counter-chart", "home-practice"]) expect(mathScenes).toContain(id);
    for (const id of ["plan-argument", "write-conclusion", "peer-review"]) expect(litScenes).toContain(id);
    // Curriculum Excellence V1 applied R-M3 (optional extension) and R-L6 (constructed writing evidence) as candidates; the reviewer still decides both.
    for (const id of ["reason-it-out", "challenge"]) expect(mathScenes).toContain(id);
    for (const id of ["readiness-writing", "write-independently", "challenge"]) expect(litScenes).toContain(id);
    expect(G7_LEGACY_COMPARISON[MATH.key].recommendations.find((item) => item.id === "R-M3")).toMatchObject({ kind: "REVIEWER_DECISION", applied: true });
    expect(G7_LEGACY_COMPARISON[LITERACY.key].recommendations.find((item) => item.id === "R-L6")).toMatchObject({ kind: "REVIEWER_DECISION", applied: true });
  });

  it("R-L1: no model evidence is written as the learner's own experience, and illustrative examples are labelled as made up", () => {
    const literacy = loadG7Candidate(LITERACY);
    const text = JSON.stringify(literacy);
    expect(text).not.toMatch(/Last term our|our school's greens|After our class/i);
    expect(literacy.scenes.find((scene) => scene.id === "evidence")!.content.body).toMatch(/Musu's school\*\* are made-up practice examples/);
    const item3 = G7_EXIT_ITEMS[LITERACY.key].find((entry) => entry.item.id === "g7-essay-exit-3")!.item;
    expect(item3.version).toBe("candidate-0.2.0");
    expect(item3.options[item3.correctIndex]).toMatch(/^Musu's class/);
    expect(item3.prompt).toMatch(/made-up practice school/);
    expect(G7_EXIT_ITEMS[LITERACY.key].filter((entry) => entry.item.id !== "g7-essay-exit-3").every((entry) => entry.item.version === "candidate-0.1.0")).toBe(true);
  });

  it("the millions range is recorded as a proposed extension, blocking until the curriculum owner approves it", () => {
    const [extension] = MATH.scopeExtensions;
    expect(extension).toMatchObject({ status: "PROPOSED_LIBERIALEARN_EXTENSION", approval: "PENDING_CURRICULUM_OWNER" });
    const usesMillions = loadG7Candidate(MATH).scenes.filter((scene) => /million|\d,\d{3},\d{3}/i.test(JSON.stringify(scene))).map((scene) => scene.id);
    expect([...extension.sceneIds]).toEqual(usesMillions);
    const items = G7_EXIT_ITEMS[MATH.key].filter((entry) => /million|\d,\d{3},\d{3}/i.test(JSON.stringify(entry.item))).map((entry) => entry.item.id);
    expect([...extension.exitItemIds]).toEqual(items);
    expect(evaluateG7Candidate(MATH).gaps).toContainEqual(expect.objectContaining({ code: "SCOPE_EXTENSION_UNAPPROVED", severity: "BLOCKING" }));
    expect(LITERACY.scopeExtensions).toEqual([]);
    expect(readFileSync(path.join(G7_PACKAGE_DIR, MATH.key, "reviewer-checklist.md"), "utf8")).toContain(`Scope extension \`${extension.id}\``);
  });

  it("the paragraph-centred alternative is prepared for every scene and exit item but not applied", () => {
    const decision = G7_LEGACY_COMPARISON[LITERACY.key].alignment.find((entry) => entry.id === "A-L1")!;
    const alt = decision.preparedAlternative!;
    expect(alt.status).toBe("PREPARED_NOT_APPLIED");
    expect(alt.sceneImpact.map((impact) => impact.sceneId)).toEqual(loadG7Candidate(LITERACY).scenes.map((scene) => scene.id));
    expect(alt.itemImpact.map((impact) => impact.itemId)).toEqual(G7_EXIT_ITEMS[LITERACY.key].map((entry) => entry.item.id));
    // The candidate keeps its current objectives and grade scope until the authority decides.
    expect(LITERACY.objectives.map((objective) => objective.id)).toEqual(["ll-g7-lit-essay-structure", "ll-g7-lit-argument-build", "ll-g7-lit-evidence-support"]);
    expect(evaluateG7Candidate(LITERACY).gaps.map((gap) => gap.code)).toEqual(expect.arrayContaining(["MOE_GRADE_SCOPE_REVIEW", "MOE_SOURCE_STRUCTURING_DEFECT"]));
    const learnerText = readFileSync(path.join(G7_PACKAGE_DIR, LITERACY.key, "learner-projection.json"), "utf8");
    for (const objective of alt.objectives) if (objective.id.startsWith("alt-")) expect(learnerText).not.toContain(objective.id);
  });

  it("the comparison keeps its original baseline: the production evidence is unchanged since commit 4fdd897c", () => {
    for (const lesson of G7_NATIVE_LESSONS) {
      const record = JSON.parse(readFileSync(path.join(G7_PACKAGE_DIR, lesson.key, "legacy-comparison.json"), "utf8")) as { candidate: { sha256: string; firstComparedAgainst: { commit: string; candidateSha256: string } } };
      expect(record.candidate.firstComparedAgainst.commit).toBe("4fdd897cd6263d9f651dbc141e36869c0b9503f9");
      expect(record.candidate.sha256).not.toBe(record.candidate.firstComparedAgainst.candidateSha256);
      expect(lesson.legacy.bodyExtract.capturedAt).toBe("2026-10-15T19:09:16.876Z");
    }
  });

  it("the math alignment evidence holds: no MOE math text in the repository mentions millions", () => {
    const sources = ["GRADE-1-6", "GRADE-7-9"].flatMap((archive) => (JSON.parse(readFileSync(`curriculum/sources/intermediate/${archive}.json`, "utf8")) as { manifests: { source: { sourceMember: string }; extraction: { pages: { rawText: string }[] } }[] }).manifests);
    const math = sources.filter((manifest) => /Math/.test(manifest.source.sourceMember));
    expect(math.map((manifest) => manifest.source.sourceMember).sort()).toEqual(["GRADE 7-9/Math 7-9.pdf", "GRADE-1-6/Math 1-6.pdf"]);
    for (const manifest of math) {
      expect(manifest.extraction.pages.every((page) => page.rawText.trim().length > 20), `${manifest.source.sourceMember} has textless pages`).toBe(true);
      expect(manifest.extraction.pages.map((page) => page.rawText).join("\n")).not.toMatch(/million/i);
    }
    expect(structured.items.filter((item) => item.subject === "MATH" && item.kind === "OBJECTIVE" && /million/i.test(item.text))).toEqual([]);
  });

  it("the legacy comparison stays reviewer-only and never reaches the learner projection", () => {
    for (const lesson of G7_NATIVE_LESSONS) {
      const record = JSON.parse(readFileSync(path.join(G7_PACKAGE_DIR, lesson.key, "legacy-comparison.json"), "utf8")) as { audience: string };
      expect(record.audience).toBe("REVIEWER_ONLY");
      const projection = readFileSync(path.join(G7_PACKAGE_DIR, lesson.key, "learner-projection.json"), "utf8");
      const extract = loadLegacyExtract(lesson);
      for (const set of extract.revision.contentSnapshot.assessment?.problemSets ?? []) expect(projection).not.toContain(String(set.answerKey).slice(0, 60));
      for (const row of G7_LEGACY_COMPARISON[lesson.key].legacyConcerns) expect(projection).not.toContain(row.finding);
    }
  });
});

describe("learner projection: Lesson Player V2 contract, no answer keys, candidate visuals", () => {
  it.each(G7_NATIVE_LESSONS.map((lesson) => [lesson.key, lesson] as const))("%s", (_key, lesson) => {
    const projection = g7LearnerProjection(lesson);
    expect(() => validateLessonExperience(projection)).not.toThrow();
    expect(projection.authority).toMatchObject({ status: "CURRICULUM_V2_DRAFT", releaseId: null, releaseIdentity: null });
    for (const scene of masteryScenes(projection)) {
      expect(scene.interaction.kind === "ASSESSMENT_HANDOFF" && scene.interaction.assessment).toMatchObject({ player: "ASSESSMENT_PLAYER_V2", scoring: "SERVER_AUTHORITY", items: [] });
    }
    const text = JSON.stringify(projection);
    for (const { item } of G7_EXIT_ITEMS[lesson.key]) {
      expect(text).not.toContain(item.prompt);
      expect(text).not.toContain(item.workedExample!);
    }
    for (const scene of loadG7Candidate(lesson).scenes) {
      if (scene.expectedObservation) expect(text).not.toContain(scene.expectedObservation);
      for (const media of scene.media ?? []) {
        const file = lesson.assets[media.id];
        expect(file, `${scene.id}/${media.id} has a candidate diagram`).toBeDefined();
        expect(existsSync(path.join(G7_ASSET_DIR, file))).toBe(true);
        const svg = readFileSync(path.join(G7_ASSET_DIR, file), "utf8");
        expect(svg).toMatch(/<title id="t">[^<]+<\/title>/);
        expect(svg).toMatch(/<desc id="d">[^<]{40,}<\/desc>/);
        expect(svg).not.toMatch(/<script|href="http|xlink:href/i);
        expect(projection.scenes.find((candidate) => candidate.id === scene.id)!.media).toContainEqual({ kind: "DIAGRAM", ref: `${G7_ASSET_URL_BASE}/${file}`, alt: media.altText });
      }
    }
  });

  it("learner-facing code never imports the reviewer-only module", () => {
    for (const file of ["lib/curriculum/v2/g7Native.ts", "lib/curriculum/v2/compat.ts", "components/learner-experience/LessonPlayerV2.tsx", "components/learner-experience/SceneViews.tsx"]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(IMPORTS_REVIEWER_MODULE);
    }
    const clientFiles = ["app", "components"].flatMap(sourceFiles);
    expect(clientFiles.filter((file) => IMPORTS_REVIEWER_MODULE.test(readFileSync(file, "utf8")))).toEqual([]);
  });
});

describe("dev-only preview through the existing prototype route", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it.each(G7_NATIVE_LESSONS.map((lesson) => [lesson.lessonId, lesson] as const))("%s loads in Lesson Player V2 with keyless candidate exit items", (lessonId, lesson) => {
    const loaded = loadPrototypeExperience(lessonId)!;
    expect(loaded.experience.id).toBe(lessonId);
    expect(loaded.links).toEqual([]);
    const [mastery] = masteryScenes(loaded.experience);
    if (mastery.interaction.kind !== "ASSESSMENT_HANDOFF") throw new Error("expected handoff");
    expect(mastery.interaction.assessment.items.map((item) => item.itemId)).toEqual(G7_EXIT_ITEMS[lesson.key].map((entry) => entry.item.id));
    const masteryText = JSON.stringify(mastery);
    expect(masteryText).not.toMatch(/correctIndex|workedExample|"hint"/);
    for (const { item } of G7_EXIT_ITEMS[lesson.key]) expect(masteryText).not.toContain(item.workedExample!);
  });

  it("candidate diagrams are public without sign-in in development only", async () => {
    const asset = "/curriculum-candidates/g7-native-v1/math-place-value-chart.svg";
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const production = await (await import("@/middleware")).middleware(new NextRequest(`https://example.test${asset}`));
    expect(production.status).toBe(404);
    expect(production.headers.get("cache-control")).toContain("no-store");
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const development = await (await import("@/middleware")).middleware(new NextRequest(`http://localhost:3000${asset}`));
    expect(development.headers.get("location")).toBeNull();
  });

  it("unknown ids still 404 and the hydropower fixture is unchanged", () => {
    expect(g7NativePreviewEntry("cv2-cand-g7-unknown")).toBeNull();
    expect(loadPrototypeExperience("cv2-cand-g7-unknown")).toBeNull();
    expect(loadPrototypeExperience("proto-g8-hydroelectric-power")?.experience.id).toBe("proto-g8-hydroelectric-power");
  });
});

/** Decimal strings as integer thousandths (inputs here have at most three decimal places). */
const thousandths = (value: string) => { const [whole, fraction = ""] = value.replace(/,/g, "").split("."); return BigInt(whole) * 1000n + BigInt((fraction + "000").slice(0, 3)); };
const format = (n: bigint) => { const whole = (n / 1000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); const fraction = (n % 1000n).toString().padStart(3, "0").replace(/0+$/, ""); return fraction ? `${whole}.${fraction}` : whole; };
function digitValue(number: string, digit: string): string {
  const [whole, fraction = ""] = number.split(".");
  const at = whole.indexOf(digit);
  if (at >= 0 && whole.indexOf(digit, at + 1) < 0 && !fraction.includes(digit)) return format(BigInt(digit) * 10n ** BigInt(whole.length - 1 - at) * 1000n);
  const index = fraction.indexOf(digit);
  if (index < 0 || whole.includes(digit) || fraction.indexOf(digit, index + 1) >= 0) throw new Error(`digit ${digit} must occur once in ${number}`);
  return format(BigInt(digit) * 10n ** BigInt(2 - index));
}
function expandedForm(number: string): string {
  const [whole, fraction = ""] = number.split(".");
  const parts = [...whole].map((d, i) => BigInt(d) * 10n ** BigInt(whole.length - 1 - i) * 1000n).concat([...fraction].map((d, i) => BigInt(d) * 10n ** BigInt(2 - i)));
  return parts.filter((part) => part > 0n).map(format).join(" + ");
}
function expectedOption(verification: ExitItemVerification): string {
  switch (verification.kind) {
    case "DIGIT_VALUE": return digitValue(verification.number, verification.digit);
    case "WORD_FORM": return format(BigInt(verification.number) * 1000n);
    case "EXPANDED_FORM": return expandedForm(verification.number);
    case "ORDER_ASCENDING": return [...verification.values].sort((a, b) => (thousandths(a) < thousandths(b) ? -1 : 1)).join(", ");
    case "GREATEST": return format([...verification.values].map(thousandths).sort((a, b) => (a < b ? 1 : -1))[0]);
  }
}

describe("candidate exit tickets (reviewer only)", () => {
  it.each(G7_NATIVE_LESSONS.map((lesson) => [lesson.key, lesson] as const))("%s: governed item shape, mapped objectives and misconceptions", (_key, lesson) => {
    const candidate = loadG7Candidate(lesson);
    const entries = G7_EXIT_ITEMS[lesson.key];
    const requestIds = new Set(candidate.assessmentRequests.map((request) => request.id));
    const misconceptionIds = new Set(candidate.misconceptions.map((m) => m.id));
    expect(new Set(entries.map((entry) => entry.item.id)).size).toBe(entries.length);
    for (const entry of entries) {
      const { item } = entry;
      expect(Object.keys(item).sort()).toEqual(["context", "correctIndex", "hint", "id", "options", "prompt", "version", "workedExample"]);
      expect(Number.isInteger(item.correctIndex) && item.correctIndex >= 0 && item.correctIndex < item.options.length).toBe(true);
      expect(new Set(item.options).size).toBe(item.options.length);
      expect(requestIds.has(entry.assessmentRequestId)).toBe(true);
      expect(lesson.objectives.some((objective) => objective.id === entry.objectiveId)).toBe(true);
      for (const [index, misconception] of Object.entries(entry.distractorMisconceptions)) {
        expect(Number(index)).not.toBe(item.correctIndex);
        expect(misconceptionIds.has(misconception)).toBe(true);
      }
    }
    for (const objective of lesson.objectives) expect(entries.some((entry) => entry.objectiveId === objective.id), `${objective.id} has an exit item`).toBe(true);
  });

  it("every math key equals the independently computed answer", () => {
    for (const entry of G7_EXIT_ITEMS[MATH.key]) {
      expect(entry.verification, entry.item.id).not.toBeNull();
      expect(entry.item.options[entry.item.correctIndex], entry.item.id).toBe(expectedOption(entry.verification!));
      const others = entry.item.options.filter((_, index) => index !== entry.item.correctIndex);
      expect(others).not.toContain(expectedOption(entry.verification!));
      if (entry.verification!.kind === "WORD_FORM") expect(entry.item.prompt).toContain(wordForm(entry.verification!.number));
    }
  });

  it("the math formative keys and worked numbers in the candidate are also correct", () => {
    expect(digitValue("1742009", "7")).toBe("700,000");
    expect(digitValue("15.273", "7")).toBe("0.07");
    expect(digitValue("9.384", "4")).toBe("0.004");
    expect(digitValue("5384", "3")).toBe("300");
    expect(expandedForm("2350480")).toBe("2,000,000 + 300,000 + 50,000 + 400 + 80");
    expect(expandedForm("3060500")).toBe("3,000,000 + 60,000 + 500");
    expect(expandedForm("6.408")).toBe("6 + 0.4 + 0.008");
    expect(wordForm(2_350_480)).toBe("two million, three hundred fifty thousand, four hundred eighty");
    expect(wordForm(5_040_009)).toBe("five million, forty thousand, nine");
    expect(wordForm(2_040_700)).toBe("two million, forty thousand, seven hundred");
    expect(format(3_406_029_508n)).toBe("3,406,029.508");
    expect(thousandths("2.75") > thousandths("2.705")).toBe(true);
    const text = readFileSync(`curriculum/v2/g7/candidates/${MATH.file}`, "utf8");
    for (const literal of ["700,000", "0.07", "0.004", "2,000,000 + 300,000 + 50,000 + 400 + 80", "6 + 0.4 + 0.008", "3,406,029.508", "0.405, 0.45, 0.5"]) expect(text).toContain(literal);
  });
});

describe("release-binding preparation stays non-executable", () => {
  it.each(G7_NATIVE_LESSONS.map((lesson) => [lesson.key, lesson] as const))("%s: candidate manifest validates as content-gap-only", (_key, lesson) => {
    const manifest = candidateReleaseManifest(lesson);
    const report = validateReleaseManifest(manifest);
    expect(report.ok).toBe(true);
    expect(report.warnings).toContain("release_not_attached_content_gap_only");
    expect(manifest.release).toBeUndefined();
    expect(manifest.provenance).toMatchObject({ authority: "UNKNOWN", moeApprovalStatus: "NOT_CLAIMED" });
    expect(() => validateOntologyRelease(draftReleaseShape(lesson))).toThrow("ontology_release_not_executable");
  });

  it("the plan records what authority must supply and never claims approval", () => {
    const plan = releaseBindingPlan();
    expect(plan).toMatchObject({ publication: "DISABLED", registeredInK12Scope: false, executableRelease: false });
    const scope = readFileSync("curriculum/releases/k12-scope.json", "utf8");
    for (const lesson of plan.lessons) {
      expect(scope).not.toContain(lesson.manifest.releaseId);
      expect(lesson.requiredFromQualifiedReviewer.length).toBeGreaterThan(2);
      expect(lesson.requiredFromCurriculumAuthority.length).toBeGreaterThan(2);
      for (const binding of lesson.proposedBindings.constructBindings) expect([binding.skillId, binding.standardCode, binding.learningTargetCode]).toEqual(["REQUIRED_FROM_AUTHORITY", "REQUIRED_FROM_AUTHORITY", "REQUIRED_FROM_AUTHORITY"]);
    }
    expect(JSON.stringify(plan)).not.toMatch(/"(APPROVED|PUBLISHED|RELEASED)"/);
  });
});

describe("evidence handoff: canonical envelope, no competing scorer", () => {
  const WRITTEN = "A written answer long enough to satisfy every minimum length in these candidate lessons, including the PEEL paragraph prompt that asks for two hundred and fifty characters of writing from the learner.";
  const answerEverything = (experience: LessonExperience): ExperienceProgress => {
    let progress = initialProgress(experience, "2026-10-15T00:00:00.000Z");
    for (const scene of experience.scenes) {
      const interaction = scene.interaction;
      if (interaction.kind === "MULTIPLE_CHOICE") for (const item of interaction.items) progress = recordResponse(progress, scene.id, item.id, 0);
      if (interaction.kind === "ASSESSMENT_HANDOFF") for (const item of interaction.assessment.items) progress = recordResponse(progress, scene.id, item.itemId, 1);
      if (interaction.kind === "FREE_RESPONSE") for (const prompt of interaction.prompts) progress = recordResponse(progress, scene.id, prompt.id, WRITTEN);
      if (interaction.kind === "DIAGRAM_REVEAL") for (const step of interaction.steps) progress = revealStep(progress, scene.id, step.id);
    }
    return progress;
  };

  it.each(G7_NATIVE_LESSONS.map((lesson) => [lesson.lessonId, lesson] as const))("%s: observations only, all raw, mastery responses unscored", (lessonId, lesson) => {
    const { experience } = loadPrototypeExperience(lessonId)!;
    const envelope = buildEvidenceEnvelope(experience, answerEverything(experience), [], {});
    expect(envelope).toMatchObject({ authorityStatus: "CURRICULUM_V2_DRAFT", masteryMutation: false, nextActionAuthority: "LEARNING_ORCHESTRATOR" });
    expect(envelope.observations.every((observation) => observation.disposition === "RAW_OBSERVATION")).toBe(true);
    const mastery = envelope.observations.find((observation) => observation.kind === "MASTERY_RESPONSE")!;
    expect(mastery.activity.activityId).toBe(`${lessonId}--${G7_EXIT_ITEMS[lesson.key][0].assessmentRequestId}`);
    expect(mastery.payload).toMatchObject({ player: "ASSESSMENT_PLAYER_V2" });
    expect(JSON.stringify(mastery.payload)).not.toMatch(/correct|score|matched/i);
    // Every objective reaches the evidence envelope through at least one observation.
    const evidenced = new Set(envelope.observations.flatMap((observation) => observation.objectiveIds));
    for (const objective of experience.objectives) expect(evidenced.has(objective.id)).toBe(true);
  });
});

describe("committed review package", () => {
  it("matches a fresh build", () => {
    for (const [name, text] of buildG7NativePackageFiles()) {
      const file = path.join(G7_PACKAGE_DIR, name);
      expect(existsSync(file), `${name} missing: run npx tsx scripts/build-curriculum-v2-g7-native.ts`).toBe(true);
      expect(readFileSync(file, "utf8"), `${name} is stale: run npx tsx scripts/build-curriculum-v2-g7-native.ts`).toBe(text);
    }
  });

  it("each reviewer checklist is candidate-only, keeps publication disabled and lists every curriculum-mapping decision", () => {
    for (const lesson of G7_NATIVE_LESSONS) {
      const checklist = readFileSync(path.join(G7_PACKAGE_DIR, lesson.key, "reviewer-checklist.md"), "utf8");
      expect(checklist).toContain("| Status | CANDIDATE ONLY |");
      expect(checklist).toContain("| Publication | DISABLED |");
      expect(checklist).toContain("## Curriculum-mapping decisions");
      for (const objective of lesson.objectives) {
        expect(checklist).toContain(`**\`${objective.id}\`**`);
        for (const reference of objective.moeReferences) expect(checklist).toContain(`- [ ] ${reference.relation}: ${reference.moeItemId ? `\`${reference.moeItemId}\`` : "OCR text only"}`);
      }
      expect(checklist).toContain(lesson.legacy.currentRevisionId);
      if (lesson.subject === "LITERACY") expect(checklist).toMatch(/Grade scope:.*Grade 9/);
    }
  });

  it("keeps keys only in the reviewer-only files", () => {
    for (const lesson of G7_NATIVE_LESSONS) {
      const projection = readFileSync(path.join(G7_PACKAGE_DIR, lesson.key, "learner-projection.json"), "utf8");
      const review = readFileSync(path.join(G7_PACKAGE_DIR, lesson.key, "assessment-review.json"), "utf8");
      expect(review).toContain('"audience": "REVIEWER_ONLY"');
      for (const { item } of G7_EXIT_ITEMS[lesson.key]) { expect(review).toContain(item.workedExample!); expect(projection).not.toContain(item.workedExample!); }
    }
  });
});
