// @vitest-environment jsdom
/**
 * ContentBundle Wave 2A: Teacher Preview surface. Renders the merged Grade 4 fractions fixture
 * through the fixture resolver seam. The only derived bundle (one added lab binding) is built in
 * this file for the non-runnable lab cases and is not curriculum.
 */
import { act } from "react";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: { id: "teacher-1", role: "TEACHER", schoolId: "school-1" } as { id: string; role: string; schoolId: string | null } | null }));
vi.mock("@/lib/auth", () => ({ requireRole: async (...roles: string[]) => {
  if (!auth.user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!roles.includes(auth.user.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  return auth.user;
} }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { redirectTo: to }); } }));

import { buildGrade4FractionsFixture, G4_FRACTIONS_FIXTURE_IDS as ids, G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING } from "@/lib/content-bundle/v1/fixtures/grade4FractionsFixture";
import type { ContentBundleV1 } from "@/lib/content-bundle/v1/types";
import { createFixturePreviewResolver, DEFAULT_PREVIEW_FIXTURES } from "@/lib/content-bundle/preview/fixtureResolver";
import { getContentBundlePreviewResolver } from "@/lib/content-bundle/preview/server";
import type { ContentBundlePreviewResolution, ResolvedContentBundlePreview } from "@/lib/content-bundle/preview/resolver";
import { buildPreviewModels } from "@/lib/content-bundle/preview/viewModel";
import { ContentBundlePreview, type PreviewMode } from "@/components/teacher/content-bundle-preview/ContentBundlePreview";
import ContentBundlePreviewPage from "@/app/teacher/content-bundles/[bundleId]/preview/page";

const teacher = { userId: "teacher-1", role: "TEACHER", schoolId: "school-1" };
const RUNTIME_TOOLS = { "fraction-visualizer": "Fraction Visualizer", "basic-calculator": "Basic Calculator", "scientific-calculator": "Scientific Calculator", "number-line": "Number Line" };

const LAB_ITEM = "fixture.member.lab.test";
/** Test-only derivation: the merged fixture plus one governed lab binding. Not curriculum. */
function fixtureWithLab(): ContentBundleV1 {
  const base = buildGrade4FractionsFixture();
  return {
    ...base,
    sequence: { units: base.sequence.units.map((unit) => ({ ...unit, entries: [...unit.entries, { itemId: LAB_ITEM, order: 7, requirement: "OPTIONAL" as const, prerequisiteItemIds: [ids.lesson], unlocksItemIds: [] }] })) },
    labs: [{ identity: { itemId: LAB_ITEM, itemVersion: "1", itemKind: "LAB" }, link: { linkId: "fixture.link.test", linkRevision: "3" }, lab: { labId: "fixture.lab.test", labVersion: "1.0.0" }, objectiveIds: [ids.objectives.partsOfSet], role: "CORE", placement: { lessonItemId: ids.lesson, sceneId: "scene-3" }, authorityBasis: "GOVERNED_LINK" }],
  };
}

async function resolve(bundleId: string = ids.bundleId, fixtures = DEFAULT_PREVIEW_FIXTURES, viewer = teacher, bundleVersion: string | null = null): Promise<ContentBundlePreviewResolution> {
  return createFixturePreviewResolver({ fixtures, runtimeTools: RUNTIME_TOOLS }).resolveForTeacherPreview({ bundleId, bundleVersion, viewer });
}
async function resolved(fixtures = DEFAULT_PREVIEW_FIXTURES): Promise<ResolvedContentBundlePreview> {
  const r = await resolve(ids.bundleId, fixtures);
  if (r.status !== "RESOLVED") throw new Error(`expected RESOLVED, got ${r.status}`);
  return r;
}
const withLab = { [ids.bundleId]: { build: fixtureWithLab, mapping: G4_FRACTIONS_FIXTURE_TOOLKIT_MAPPING, label: "test-only lab variant" } };

let root: Root | null = null;
let host: HTMLDivElement;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { if (root) act(() => root!.unmount()); root = null; host?.remove(); auth.user = { id: "teacher-1", role: "TEACHER", schoolId: "school-1" }; });

async function mount(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(node); });
}
async function renderPreview(opts: { mode?: PreviewMode; item?: string | null; fixtures?: typeof DEFAULT_PREVIEW_FIXTURES } = {}) {
  await mount(<ContentBundlePreview models={buildPreviewModels(await resolved(opts.fixtures))} initialMode={opts.mode} initialItemId={opts.item ?? null} />);
}
const $ = <T extends Element = HTMLElement>(sel: string) => host.querySelector<T>(sel);
const text = (sel = "main") => $(sel)?.textContent ?? "";
const navButton = (title: string, label = "Bundle sequence") =>
  [...host.querySelectorAll<HTMLButtonElement>(`nav[aria-label='${label}'] button`)].find((b) => b.textContent?.includes(title))!;
async function click(el: HTMLElement) { await act(async () => { el.click(); }); }
async function key(el: HTMLElement, k: string) { await act(async () => { el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); }); }
const modeButton = (label: string) => [...host.querySelectorAll<HTMLButtonElement>("[role=group][aria-label='Preview mode'] button")].find((b) => b.textContent === label)!;

/** Strings that exist only in teacher/system material of the fixture. */
const TEACHER_ONLY = [
  "Model the first sharing before pairs continue.", // teacher instruction
  "Facilitation note", // TEACHER resource
  "Unit answer key", // ANSWER_KEY resource
  "fixture.resource.g4-math.fractions-unit-answer-key",
  "fixture.asset.fractions-answer-key",
  "enforcement", // internalConfiguration key
  "calculator", // bundle-wide PROHIBITED tool
  "Not allowed",
  "PROHIBITED",
  "Teacher guide", // TEACHER rendering
  "fixture.provenance.synthetic", // governance
  "fixture.assessment-item.", // assessment item list
  "fixture.assessment-definition.", // not displayed to students
  "Scoring guide",
];

describe("fixture resolver seam", () => {
  it("resolves the merged Grade 4 fractions fixture, sealed and projected, and labels it non-authoritative", async () => {
    const r = await resolved();
    expect(r.bundle.identity.bundleId).toBe(ids.bundleId);
    expect(r.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.bundle.identity.contentHash).toBe(r.contentHash);
    expect(r.learnerProjection.source).toEqual({ bundleId: ids.bundleId, bundleVersion: "1.0.0-fixture", contentHash: r.contentHash });
    expect(r.source).toMatchObject({ kind: "FIXTURE", authoritative: false });
    expect(r.release.state).toBe("NOT_EVALUATED");
    expect(r.toolkit.mapping).toMatchObject({ reviewed: false });
  });

  it("fails closed for unknown bundles, other versions, non-teacher viewers and production", async () => {
    expect((await resolve("fixture.bundle.unknown")).status).toBe("UNAVAILABLE");
    expect((await resolve(ids.bundleId, DEFAULT_PREVIEW_FIXTURES, teacher, "9.9.9")).status).toBe("UNAVAILABLE");
    expect((await resolve(ids.bundleId, DEFAULT_PREVIEW_FIXTURES, { ...teacher, role: "STUDENT" })).status).toBe("UNAVAILABLE");
    const prod = await getContentBundlePreviewResolver({ NODE_ENV: "production" }).resolveForTeacherPreview({ bundleId: ids.bundleId, bundleVersion: null, viewer: teacher });
    expect(prod.status).toBe("UNAVAILABLE");
    expect(prod.diagnostics.map(d => d.code)).toContain("FIXTURE_NOT_AUTHORITY");
    expect((await getContentBundlePreviewResolver({ NODE_ENV: "development" }).resolveForTeacherPreview({ bundleId: ids.bundleId, bundleVersion: null, viewer: teacher, fixturePreview: true })).status).toBe("RESOLVED");
  });

  it("reports an invalid fixture as INCOMPATIBLE instead of rendering it", async () => {
    const broken = { [ids.bundleId]: { build: () => ({ ...buildGrade4FractionsFixture(), lessons: [] }), mapping: null, label: "broken" } };
    const r = await resolve(ids.bundleId, broken);
    expect(r.status).toBe("INCOMPATIBLE");
  });
});

describe("Teacher overview", () => {
  it("renders header, objectives, renderings, resources, learner support, offline summary and governance", async () => {
    await renderPreview();
    expect($("h1")?.textContent).toBe("FIXTURE: Grade 4 Mathematics, Fractions (parts of a set)");
    const header = text("header");
    for (const s of ["Grade4", "SubjectMathematics", "Version1.0.0-fixture", "Release not evaluated", "Test fixture"]) expect(header).toContain(s);
    expect($("#cbp-item-heading")?.textContent).toBe("Bundle overview");
    const main = text();
    expect(main).toContain(ids.objectives.partsOfSet);
    expect(main).toContain(ids.objectives.equalParts);
    expect(text("[data-testid=renderings]")).toBe("Textbook Not availableWorkbook Available, v1.0.0-fixture (Learner)Teacher guide Available, v1.0.0-fixture (Teacher)Assessment book Not available");
    for (const s of ["Bottle-cap counters", "Facilitation note", "Teacher only", "Unit answer key", "Read aloud", "Large print", "Revisit"]) expect(main).toContain(s);
    expect(main).toContain("Bundle declares packagingDeclared, package not closed");
    expect(main).toMatch(/Teacher-only assets1 \(29\.4 KB\), never in the student package/);
    const aside = text("aside");
    for (const s of ["Governance and release", "No release authority was consulted", "Not authoritative", "FIXTURE-ONLY:g4-math-fractions@synthetic-0", "server details withheld", "Reviews", "None recorded", "(unreviewed)"]) expect(aside).toContain(s);
  });

  it("renders canonical toolkit mode/scope, unresolved mappings, and no server-only settings", async () => {
    await renderPreview();
    const cards = [...host.querySelectorAll("[data-testid=tool-bindings] > li")].map((li) => li.textContent);
    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatch(/fraction_strips.*Optional.*Whole bundle.*Mapping unresolved.*Use strips to check equal parts\..*maxDenominator: 12/);
    expect(cards[1]).toMatch(/fraction_strips.*Not allowed.*Only: Unit assessment: fractions/);
    expect(cards[1]).not.toContain("enforcement");
    expect(cards[2]).toMatch(/calculator.*Not allowed.*Whole bundle.*Mapping unresolved/);
  });

  it("renders offline pins: bundle version, content hash, release identity, member versions and asset hashes", async () => {
    const r = await resolved();
    await renderPreview();
    const pins = text("[data-testid=offline-pins]");
    expect(pins).toContain(`${ids.bundleId}@1.0.0-fixture`);
    expect(pins).toContain(r.contentHash);
    expect(pins).toContain("FIXTURE-ONLY:g4-math-fractions@synthetic-0");
    expect(pins).toContain("learner-projection.v1");
    expect(pins).toContain("Members pinned (7)");
    for (const m of [ids.lesson, ids.unitAssessment, ids.homework]) expect(pins).toContain(`${m}@1.0.0-fixture`);
    expect(pins).toContain("Assets pinned (2)");
    expect(pins).toContain("fixture.asset.bottle-cap-counters@1.0.0-fixture sha256:");
    expect(pins).not.toContain("fixture.asset.fractions-answer-key"); // staff asset is not in the learner package
  });
});

describe("sequence navigation", () => {
  it("lists the unit in authored order with kinds and optional markers", async () => {
    await renderPreview();
    const items = [...host.querySelectorAll("nav[aria-label='Bundle sequence'] li button")].map((b) => b.textContent);
    expect(items).toEqual([
      "1Fractions of a set: equal groups of bottle capsLesson",
      "2Guided practice: share bottle caps into equal groupsPractice",
      "3Independent practice: name the fraction of the setPractice",
      "4Check: fraction of a setAssessment",
      "5Classwork: parts of a set worksheetClasswork",
      "6Homework: fractions of a set at homeHomework · Optional",
      "7Unit assessment: fractionsAssessment",
    ]);
    expect($("nav[aria-label='Bundle sequence'] h2")?.textContent).toBe("Fractions");
  });

  it("selecting an item shows it, marks it current, and prerequisite links navigate", async () => {
    await renderPreview();
    await click(navButton("Homework"));
    expect($("#cbp-item-heading")?.textContent).toBe("Homework: fractions of a set at home");
    expect(navButton("Homework").getAttribute("aria-current")).toBe("true");
    expect(navButton("Bundle overview").getAttribute("aria-current")).toBeNull();
    const seq = text("[aria-labelledby=cbp-sequence]");
    expect(seq).toContain("Step 6");
    expect(seq).toContain("Optional");
    const prereq = [...host.querySelectorAll<HTMLButtonElement>("[aria-labelledby=cbp-sequence] .cbp-link")].find((b) => b.textContent === "Classwork: parts of a set worksheet")!;
    await click(prereq);
    expect($("#cbp-item-heading")?.textContent).toBe("Classwork: parts of a set worksheet");
    expect(text("[role=status][aria-live=polite]")).toBe("Showing Classwork: parts of a set worksheet");
  });

  it("supports keyboard: native buttons in tab order plus Arrow, Home and End movement", async () => {
    await renderPreview();
    const buttons = [...host.querySelectorAll<HTMLButtonElement>("nav[aria-label='Bundle sequence'] button")];
    expect(buttons.every((b) => b.tagName === "BUTTON" && b.type === "button" && b.tabIndex === 0)).toBe(true);
    buttons[0].focus();
    await key(buttons[0], "ArrowDown");
    expect(document.activeElement).toBe(buttons[1]);
    await key(buttons[1], "End");
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    await key(buttons[buttons.length - 1], "ArrowDown");
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    await key(buttons[buttons.length - 1], "ArrowUp");
    expect(document.activeElement).toBe(buttons[buttons.length - 2]);
    await key(buttons[buttons.length - 2], "Home");
    expect(document.activeElement).toBe(buttons[0]);
    // Mode toggle is a pair of native pressed-state buttons.
    expect(modeButton("Teacher overview").getAttribute("aria-pressed")).toBe("true");
    expect(modeButton("Student view").getAttribute("aria-pressed")).toBe("false");
    expect($("a.cbp-skip")?.getAttribute("href")).toBe("#cbp-item-panel");
    expect($("#cbp-item-panel")).not.toBeNull();
  });
});

describe("item previews", () => {
  it.each([
    ["Guided practice", "Practice", "10 minutes", "Pair", "Guided", "Put 12 bottle caps into 4 equal groups.", "Model the first sharing before pairs continue."],
    ["Classwork", "Classwork", "20 minutes", "Individual", "Not specified", "Complete questions 1 to 6 on the worksheet.", null],
    ["Homework", "Homework", "15 minutes", "Individual", "Not specified", "Find 8 small objects at home.", null],
  ])("renders the %s activity by type with duration, collaboration and both instruction sets", async (title, type, minutes, collab, scaffold, learnerStep, teacherStep) => {
    await renderPreview();
    await click(navButton(title));
    const activity = text("[aria-labelledby=cbp-activity]");
    expect(activity).toContain(`Type${type}`);
    expect(activity).toContain(`Expected duration${minutes}`);
    expect(activity).toContain(`Collaboration${collab}`);
    expect(activity).toContain(`Scaffolding${scaffold}`);
    expect(text("[aria-labelledby=cbp-learner-instructions]")).toContain(learnerStep);
    const teacherSection = text("[aria-labelledby=cbp-teacher-instructions]");
    expect(teacherSection.startsWith("Teacher instructions (teacher only)")).toBe(true);
    if (teacherStep) expect(teacherSection).toContain(teacherStep);
    else expect(teacherSection).toContain("No teacher instructions for this activity.");
  });

  it("renders assessment purpose, definition identity, item count, order policy and secured references", async () => {
    await renderPreview();
    await click(navButton("Unit assessment"));
    const a = text("[aria-labelledby=cbp-assessment]");
    expect(a).toContain("PurposeUnit assessment");
    expect(a).toContain("Definitionfixture.assessment-definition.g4-fractions.unit@1.0.0-fixture");
    expect(a).toContain("Questions3");
    expect(a).toContain("Question orderFixed order");
    expect(a).toContain("Answer keyUnit answer key (Teacher only)");
    const tools = text("[data-testid=item-tools]");
    expect(tools).toMatch(/calculator.*Not allowed/);
    expect(tools).toMatch(/fraction_strips.*Not allowed.*From: Optional \(whole bundle\); Prohibited \(this item\)/);
    await click(navButton("Check: fraction"));
    expect(text("[aria-labelledby=cbp-assessment]")).toContain("Questions2");
    expect(text("[data-testid=item-tools]")).toMatch(/fraction_strips.*Optional/);
  });

  it("renders the item identity, version, objective bindings and requirement in the side panel", async () => {
    await renderPreview({ item: ids.independentPractice });
    const aside = text("aside");
    expect(aside).toContain(`Item id${ids.independentPractice}`);
    expect(aside).toContain("Version1.0.0-fixture");
    expect(aside).toContain("RequirementRequired");
    expect(aside).toContain(ids.objectives.partsOfSet);
    expect(aside).not.toContain(ids.objectives.equalParts);
  });

  it("states truthfully that the fixture has no lab", async () => {
    await renderPreview();
    expect(text()).toContain("0 labs");
    expect(host.querySelector("[data-testid=lab-readiness]")).toBeNull();
  });

  it("shows a lab as not runnable, with its governed link identity, when certification was not evaluated", async () => {
    await renderPreview({ fixtures: withLab, item: LAB_ITEM });
    const readiness = text("[data-testid=lab-readiness]");
    expect(readiness).toContain("Not runnable");
    expect(readiness).toContain("does not consult the certified lab registry");
    const lab = text("[aria-labelledby=cbp-lab]");
    expect(lab).toContain("Governed linkfixture.link.test revision 3");
    expect(lab).toContain("Labfixture.lab.test@1.0.0");
    expect(lab).toContain("CertificationNot evaluated");
    expect(lab).toContain("Placed inFractions of a set: equal groups of bottle caps, scene scene-3");
    await click(modeButton("Student view"));
    expect(text("[data-testid=student-lab-state]")).toBe("Students will see this lab as not available yet.");
  });

  it.each([
    ["NOT_CERTIFIED", "Not runnable", "Not certified"],
    ["LINK_REVISION_MISSING", "Not runnable", "Link revision missing"],
    ["CERTIFIED_RUNNABLE", "Not runnable", "Not evaluated"],
  ] as const)("renders resolver lab readiness %s faithfully", async (state, headline, certification) => {
    const base = await resolved(withLab);
    const models = buildPreviewModels({ ...base, labReadiness: { [LAB_ITEM]: { state, reason: `resolver says ${state}` } } });
    await mount(<ContentBundlePreview models={models} initialItemId={LAB_ITEM} />);
    expect(text("[data-testid=lab-readiness]")).toBe(`${headline}${state === "CERTIFIED_RUNNABLE" ? "Fixture certification is not production authority." : `resolver says ${state}`}`);
    expect(text("[aria-labelledby=cbp-lab]")).toContain(`Certification${certification}`);
    expect(models.student.members.find((m) => m.itemId === LAB_ITEM)?.detail).toEqual({ category: "LAB", available: false });
  });
});

describe("Student View", () => {
  it("is built only from the LearnerContentBundle projection", async () => {
    const r = await resolved();
    const { student } = buildPreviewModels(r);
    const json = JSON.stringify(student);
    for (const s of TEACHER_ONLY) expect(json).not.toContain(s);
    expect(student.members.map((m) => m.itemId).sort()).toEqual(r.learnerProjection.offline.members.map((m) => m.itemId).sort());
    expect(student.tools.map((t) => `${t.toolId}:${t.mode}`)).toEqual(r.learnerProjection.tools.filter((t) => t.scope.kind === "BUNDLE").map((t) => `${t.toolId}:${t.mode}`));
    expect(student.resources.map((x) => x.resourceId)).toEqual(r.learnerProjection.resources.map((x) => x.resourceId));
  });

  it("switching modes shows the learner-safe frame and banner, and returns to teacher overview", async () => {
    await renderPreview();
    await click(modeButton("Student view"));
    expect(modeButton("Student view").getAttribute("aria-pressed")).toBe("true");
    expect(text("[role=note].cbp-banner")).toContain("This is what the student receives from this bundle.");
    expect($("[data-testid=student-preview]")).not.toBeNull();
    expect($("nav[aria-label='Student sequence']")).not.toBeNull();
    expect(text("[data-testid=student-tools]")).toBe("fraction_strips OptionalUse strips to check equal parts.");
    await click(modeButton("Teacher overview"));
    expect($("[data-testid=student-preview]")).toBeNull();
    expect($("[data-testid=tool-bindings]")).not.toBeNull();
  });

  it("never renders teacher-only content on any student page, and keeps the withheld summary outside the student frame", async () => {
    await renderPreview({ mode: "student" });
    const studentNav = () => [...host.querySelectorAll<HTMLButtonElement>("nav[aria-label='Student sequence'] button")];
    expect(studentNav()).toHaveLength(8);
    for (let i = 0; i < studentNav().length; i++) {
      await click(studentNav()[i]);
      const frame = text("[data-testid=student-preview]");
      expect(frame.length).toBeGreaterThan(0);
      for (const s of TEACHER_ONLY) expect(frame, `student page ${i} leaked "${s}"`).not.toContain(s);
    }
    const withheld = $("[data-testid=withheld-summary]")!;
    expect($("[data-testid=student-preview]")!.contains(withheld)).toBe(false);
    expect(withheld.textContent).toContain("server-supplied learner projection");
    expect(withheld.textContent).not.toContain("Tool prohibitions");
  });

  it("preserves assessment secrecy: instructions only, no definition, item list, count or key", async () => {
    await renderPreview({ mode: "student", item: ids.unitAssessment });
    const frame = text("[data-testid=student-preview]");
    expect(frame).toContain("Unit test");
    expect(frame).toContain("Work on your own. Tools are not allowed.");
    expect(frame).toContain("Questions are delivered when the student starts.");
    for (const s of ["fixture.assessment-item", "fixture.assessment-definition", "answer key", "Answer key", "Questions3", "Fixed order"]) expect(frame).not.toContain(s);
  });

  it("shows learner instructions and criteria for an activity but not teacher steps or scoring guides", async () => {
    await renderPreview({ mode: "student", item: ids.classwork });
    const frame = text("[data-testid=student-preview]");
    expect(frame).toContain("Complete questions 1 to 6 on the worksheet.");
    expect(frame).toContain("Draws the equal groups");
    expect(frame).toContain("Parts of a set worksheet");
    await click(navButton("Guided practice", "Student sequence"));
    const guided = text("[data-testid=student-preview]");
    expect(guided).toContain("Put 12 bottle caps into 4 equal groups.");
    expect(guided).not.toContain("Model the first sharing");
  });
});

describe("route", () => {
  it("exists at the read-only preview path", () => {
    expect(existsSync(path.resolve("app/teacher/content-bundles/[bundleId]/preview/page.tsx"))).toBe(true);
  });

  it("renders the fixture for a teacher, honoring view and item parameters", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const element = await ContentBundlePreviewPage({ params: { bundleId: encodeURIComponent(ids.bundleId) }, searchParams: { view: "student", item: ids.homework, fixture: "1" } });
    await mount(element);
    expect(modeButton("Student view").getAttribute("aria-pressed")).toBe("true");
    expect($("#cbp-item-heading")?.textContent).toBe("Homework: fractions of a set at home");
    vi.unstubAllEnvs();
  });

  it("renders truthful unavailable states and redirects anonymous viewers", async () => {
    await mount(await ContentBundlePreviewPage({ params: { bundleId: "fixture.bundle.unknown" }, searchParams: {} }));
    expect(text("h1")).toBe("Content unavailable for preview");
    act(() => root!.unmount()); root = null; host.remove();

    vi.stubEnv("NODE_ENV", "production");
    await mount(await ContentBundlePreviewPage({ params: { bundleId: ids.bundleId }, searchParams: {} }));
    expect(text("h1")).toBe("Content unavailable for preview");
    expect(text("[data-category=NOT_AVAILABLE]")).toContain("Synthetic fixtures are not available through production authority");
    vi.unstubAllEnvs();

    auth.user = null;
    await expect(ContentBundlePreviewPage({ params: { bundleId: ids.bundleId }, searchParams: {} })).rejects.toMatchObject({ redirectTo: "/login" });
  });

  it("has no write path: the page and components import no API client, fetch or mutation", () => {
    const files = ["app/teacher/content-bundles/[bundleId]/preview/page.tsx", "components/teacher/content-bundle-preview/ContentBundlePreview.tsx", "components/teacher/content-bundle-preview/TeacherPanels.tsx", "components/teacher/content-bundle-preview/StudentPanels.tsx", "components/teacher/content-bundle-preview/parts.tsx"];
    for (const file of files) {
      const source = readFileSync(path.resolve(file), "utf8");
      expect(source, file).not.toMatch(/fetch\(|prisma|method:\s*["']POST|publish\w*\(/);
    }
  });
});

describe("responsive layout contract", () => {
  it("defines phone single-column, tablet two-column and desktop three-column grids without horizontal overflow traps", () => {
    const css = readFileSync(path.resolve("app/globals.css"), "utf8");
    const block = css.slice(css.indexOf("/* Content bundle Teacher Preview"));
    expect(block).toMatch(/\.cbp-grid \{[^}]*grid-template-columns: minmax\(0,1fr\)/);
    expect(block).toMatch(/@media \(min-width:768px\) \{[\s\S]*?\.cbp-grid \{ grid-template-columns: 240px minmax\(0,1fr\); \}/);
    expect(block).toMatch(/@media \(min-width:1024px\) \{[\s\S]*?\.cbp-grid \{ grid-template-columns: 260px minmax\(0,1fr\) 300px; \}/);
    expect(block).toMatch(/overflow-wrap: anywhere/);
    expect(block).toMatch(/min-height: 48px/);
    expect(block).toMatch(/:focus-visible \{ outline: 3px solid/);
  });
});
