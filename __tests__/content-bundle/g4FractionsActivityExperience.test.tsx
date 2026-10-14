// @vitest-environment jsdom
/**
 * Content Factory Wave 3B: Grade 4 fractions activity experiences (guided practice, independent
 * practice, classwork, homework) through the ContentBundle contract and Teacher Preview.
 * The bundle is a synthetic governed-candidate fixture; nothing here is curriculum authority.
 */
import { act } from "react";
import { readFileSync } from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { buildGrade4FractionsActivitiesFixture, G4_FRACTIONS_ACTIVITIES_FIXTURE_IDS as ids } from "@/lib/content-bundle/v1/fixtures/grade4FractionsActivitiesFixture";
import { buildGrade4FractionsFixture } from "@/lib/content-bundle/v1/fixtures/grade4FractionsFixture";
import { activityExperienceOf, parseActivityExperience, projectLearnerExperience, type ActivityExperienceV1 } from "@/lib/content-bundle/v1/activityExperience";
import { sealContentBundle } from "@/lib/content-bundle/v1/seal";
import { validateContentBundle } from "@/lib/content-bundle/v1/validator";
import { projectLearnerBundle } from "@/lib/content-bundle/v1/projection";
import type { ContentBundleV1, JsonValue } from "@/lib/content-bundle/v1/types";
import { createFixturePreviewResolver } from "@/lib/content-bundle/preview/fixtureResolver";
import type { ResolvedContentBundlePreview } from "@/lib/content-bundle/preview/resolver";
import { buildPreviewModels } from "@/lib/content-bundle/preview/viewModel";
import { evaluateTask } from "@/lib/content-bundle/preview/fractionFeedback";
import { ContentBundlePreview, type PreviewMode } from "@/components/teacher/content-bundle-preview/ContentBundlePreview";
import { LearnerActivityExperience } from "@/components/teacher/content-bundle-preview/activity/LearnerActivityExperience";
import { GRADE4_FRACTIONS_LESSON_2026_2 } from "@/lib/curriculum/authority/grade4FractionsLesson";

const teacher = { userId: "teacher-1", role: "TEACHER", schoolId: "school-1" };
const ACTIVITY_IDS = { guided: ids.guidedPractice, independent: ids.independentPractice, classwork: ids.classwork, homework: ids.homework } as const;
type Which = keyof typeof ACTIVITY_IDS;

/** Test-only deep-mutable view for building invalid variants. */
type Mutable<T> = T extends readonly (infer U)[] ? Mutable<U>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
const clone = (): Mutable<ContentBundleV1> => JSON.parse(JSON.stringify(buildGrade4FractionsActivitiesFixture()));
const activity = (bundle: Mutable<ContentBundleV1>, which: Which) => bundle.activities.find((a) => a.identity.itemId === ACTIVITY_IDS[which])!;
const experience = (bundle: Mutable<ContentBundleV1>, which: Which) => activity(bundle, which).experience as unknown as Mutable<ActivityExperienceV1> & Record<string, unknown>;

async function resolved(): Promise<ResolvedContentBundlePreview> {
  const r = await createFixturePreviewResolver().resolveForTeacherPreview({ bundleId: ids.bundleId, bundleVersion: null, viewer: teacher });
  if (r.status !== "RESOLVED") throw new Error(`expected RESOLVED, got ${r.status}`);
  return r;
}

/** Strings that exist only in teacher material of the activity experiences. */
const TEACHER_ONLY = [
  "Step through the worked example with the class", // guided phase
  "Do not give the steps", // independent teacher instruction
  "Listen to each pair explain question 4", // classwork teacher instruction
  "Read the self-check aloud before learners leave", // homework teacher instruction
  "What to look and listen for",
  "If you see:",
  "Common mistakes",
  "Classwork facilitation guide", // TEACHER resource
  "Facilitation note",
  "Unit answer key",
  "Unreviewed candidate",
  "moe-math-g4-s1-p3-number-theory-and-fraction-obj4",
  "ll-g4-math-fractions-equal-parts-2026.2",
  "Next-day review",
  "Marks 4 caps for 1/4 of 8",
];
const TEACHER_KEYS = ["summary", "phases", "grouping", "lookFors", "misconceptions", "differentiation", "evidenceNote", "alignment", "teacher"];
const ANSWER_KEYS = /"(correct\w*|answers?|answerKey\w*|acceptableAnswers|solutions?|scoringKey|markScheme|workedSolution|expectedResponses?)"\s*:/i;

let root: Root | null = null;
let host: HTMLDivElement;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { if (root) act(() => root!.unmount()); root = null; host?.remove(); });

async function renderPreview(mode: PreviewMode, which: Which) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const models = buildPreviewModels(await resolved());
  await act(async () => { root!.render(<ContentBundlePreview models={models} initialMode={mode} initialItemId={ACTIVITY_IDS[which]} />); });
}
const $ = <T extends Element = HTMLElement>(sel: string) => host.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string) => [...host.querySelectorAll<T>(sel)];
const text = (sel = "main") => $(sel)?.textContent ?? "";
async function click(el: Element) { await act(async () => { (el as HTMLElement).click(); }); }
const button = (scope: Element, label: string | RegExp) => [...scope.querySelectorAll<HTMLButtonElement>("button")].find((b) => (typeof label === "string" ? b.textContent === label : label.test(b.textContent ?? "")))!;

// ─── Contract and governance ────────────────────────────────────────────────────────────────────

describe("Grade 4 fractions activity fixture", () => {
  it("validates, seals and carries one experience per activity whose profile matches its kind", () => {
    const sealed = sealContentBundle(buildGrade4FractionsActivitiesFixture());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const profiles = sealed.sealed.bundle.activities.map((a) => [a.identity.itemKind, a.scaffolding, activityExperienceOf(a)?.profile]);
    expect(profiles).toEqual([
      ["PRACTICE", "GUIDED", "GUIDED_PRACTICE"],
      ["PRACTICE", "INDEPENDENT", "INDEPENDENT_PRACTICE"],
      ["CLASSWORK", null, "CLASSWORK"],
      ["HOMEWORK", null, "HOMEWORK"],
    ]);
  });

  it("leaves the merged fixture unchanged and versions every changed activity", () => {
    const merged = buildGrade4FractionsFixture();
    expect(merged.activities.every((a) => a.extensions === undefined)).toBe(true);
    const candidate = buildGrade4FractionsActivitiesFixture();
    expect(candidate.identity.bundleId).not.toBe(merged.identity.bundleId);
    for (const a of candidate.activities) expect(a.identity.itemVersion).toBe("1.1.0-fixture");
  });

  it("binds every activity to fixture objectives in the bundle authority and names real alignment refs as unreviewed candidates", async () => {
    const bundle = buildGrade4FractionsActivitiesFixture();
    for (const a of bundle.activities) {
      expect(a.objectiveIds.length).toBeGreaterThan(0);
      for (const id of a.objectiveIds) {
        expect(bundle.curriculumAuthority.objectiveIds).toContain(id);
        expect(id.startsWith("fixture.")).toBe(true);
      }
      const align = activityExperienceOf(a)!.teacher.alignment;
      expect(align.reviewState).toBe("UNREVIEWED_CANDIDATE");
      // Real repository records, not invented ones.
      expect(align.candidateObjectiveRefs).toEqual([...GRADE4_FRACTIONS_LESSON_2026_2.provenance.moeObjectiveIds]);
      expect(align.candidateLessonRefs).toEqual([`${GRADE4_FRACTIONS_LESSON_2026_2.contentId}@${GRADE4_FRACTIONS_LESSON_2026_2.version}`]);
    }
    expect(GRADE4_FRACTIONS_LESSON_2026_2.provenance.reviewState).toBe("PENDING_FOUNDER_REVIEW");
    // No fabricated approval anywhere.
    expect(bundle.governance).toEqual({ provenanceRefs: ["fixture.provenance.synthetic"], reviewRefs: [], lifecycleRefs: [], releaseRefs: [] });
    expect(bundle.curriculumAuthority.releaseIdentity.startsWith("FIXTURE-ONLY")).toBe(true);
    const r = await resolved();
    expect(r.source).toMatchObject({ kind: "FIXTURE", authoritative: false });
    expect(r.release.state).toBe("NOT_EVALUATED");
  });

  it("puts experiences inside the content hash, so editing one changes the sealed identity", () => {
    const a = sealContentBundle(clone());
    const edited = clone();
    experience(edited, "guided").learner.items[0].hints[0] = "Changed hint";
    const b = sealContentBundle(edited);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.sealed.contentHash).not.toBe(b.sealed.contentHash);
  });
});

describe("experience contract rejects unsafe or inconsistent content", () => {
  const rejects = (mutate: (b: Mutable<ContentBundleV1>) => void, code: string, pathPart?: string) => {
    const bundle = clone();
    mutate(bundle);
    const result = validateContentBundle(bundle);
    expect(result.ok).toBe(false);
    const match = result.errors.find((e) => e.code === code && (!pathPart || e.path.includes(pathPart)));
    expect(match, JSON.stringify(result.errors)).toBeTruthy();
  };

  it("rejects inline answer keys, student state and unknown fields in an experience", () => {
    rejects((b) => { (experience(b, "independent").learner.items[0] as unknown as Record<string, unknown>).correctAnswer = "3/8"; }, "answer_key_inline");
    rejects((b) => { (experience(b, "homework").learner as unknown as Record<string, unknown>).answers = ["4/9"]; }, "answer_key_inline");
    rejects((b) => { (experience(b, "guided") as Record<string, unknown>).mastery = 0.8; }, "student_state_forbidden");
    rejects((b) => { (experience(b, "guided").learner.items[0].task as unknown as Record<string, unknown>).target = 2; }, "activity_experience_invalid", "task.target");
  });

  it("only accepts construction tasks whose prompt states the fraction to make", () => {
    rejects((b) => { experience(b, "guided").learner.items[0].prompt = "Tap the caps to mark the right amount."; }, "activity_experience_invalid", "task.ask");
    rejects((b) => { (experience(b, "independent").learner.items[1].task as { ask: { denominator: number } }).ask.denominator = 3; }, "activity_experience_invalid");
  });

  it("enforces the guided / independent / classwork / homework profile rules", () => {
    rejects((b) => { experience(b, "guided").learner.workedExamples = []; }, "activity_experience_invalid", "workedExamples");
    rejects((b) => { experience(b, "guided").learner.items[0].hints = ["Only one"]; }, "activity_experience_invalid", "hints");
    rejects((b) => { experience(b, "independent").learner.workedExamples = experience(clone(), "guided").learner.workedExamples; }, "activity_experience_invalid", "workedExamples");
    rejects((b) => { experience(b, "independent").learner.items[0].hints = ["a", "b"]; }, "activity_experience_invalid", "hints");
    rejects((b) => { experience(b, "homework").learner.items[0].task = experience(clone(), "guided").learner.items[0].task; experience(b, "homework").learner.items[0].prompt = experience(clone(), "guided").learner.items[0].prompt; }, "activity_experience_invalid", "items");
    rejects((b) => { experience(b, "homework").learner.offline.worksOffline = false; }, "activity_experience_invalid", "worksOffline");
    rejects((b) => { experience(b, "classwork").teacher.phases = experience(b, "classwork").teacher.phases.slice(0, 1); }, "activity_experience_invalid", "phases");
    rejects((b) => { experience(b, "classwork").learner.roles = []; }, "activity_experience_invalid", "roles");
    // A guided body cannot sit on an independent-practice definition.
    rejects((b) => { activity(b, "independent").experience = activity(clone(), "guided").experience; }, "activity_experience_invalid", "profile");
  });

  it("has exactly one experience surface: extensions.experience is rejected", () => {
    rejects((b) => { const a = activity(b, "guided"); a.extensions = { experience: a.experience as unknown as Mutable<JsonValue> }; delete a.experience; }, "activity_experience_invalid", "extensions.experience");
  });

  it("fails closed: an activity without a valid experience projects none", () => {
    const bundle = clone();
    experience(bundle, "guided").schema = "activity-experience.v0" as never;
    expect(parseActivityExperience(activity(bundle, "guided").experience).ok).toBe(false);
    expect(projectLearnerExperience(activity(bundle, "guided"))).toBeNull();
  });
});

// ─── Projection boundary ────────────────────────────────────────────────────────────────────────

describe("student / teacher projection separation", () => {
  it("projects only learner fields: no teacher section, teacher text, answer keys or teacher resources", async () => {
    const r = await resolved();
    const learnerJson = JSON.stringify(r.learnerProjection);
    for (const s of TEACHER_ONLY) expect(learnerJson).not.toContain(s);
    for (const key of TEACHER_KEYS) expect(learnerJson).not.toContain(`"${key}":`);
    expect(learnerJson).not.toMatch(ANSWER_KEYS);
    expect(learnerJson).not.toContain(ids.resources.classworkGuide);
    expect(learnerJson).not.toContain(ids.resources.answerKey);
    expect(r.learnerProjection.activities.every((a) => a.experience)).toBe(true);
  });

  it("builds the student model from the projection only, and the teacher model with the full guide", async () => {
    const models = buildPreviewModels(await resolved());
    const studentJson = JSON.stringify(models.student);
    for (const s of TEACHER_ONLY) expect(studentJson).not.toContain(s);
    expect(studentJson).not.toMatch(ANSWER_KEYS);
    const teacherActivities = models.teacher.members.filter((m) => m.detail.category === "ACTIVITY");
    expect(teacherActivities.map((m) => (m.detail.category === "ACTIVITY" ? m.detail.experience?.teacher.lookFors.length : 0)).every((n) => (n ?? 0) > 0)).toBe(true);
    expect(models.teacher.withheldFromStudents).toContainEqual({ label: "Activity facilitation guides (flow, look-fors, misconceptions, alignment)", count: 4 });
  });

  it("has no hidden answers: every checked value is stated in the prompt or drawn on screen", () => {
    const sealed = sealContentBundle(buildGrade4FractionsActivitiesFixture());
    if (!sealed.ok) throw new Error("fixture must seal");
    for (const a of projectLearnerBundle(sealed.sealed.bundle, sealed.sealed.contentHash).activities) {
      for (const item of a.experience!.items) {
        const t = item.task;
        if (t.kind === "SHADE_STRIP" || t.kind === "MARK_SET") expect(item.prompt).toContain(`${t.ask.numerator}/${t.ask.denominator}`);
        else expect(Object.keys(t).sort()).toEqual(["kind", "visual"]);
      }
    }
  });
});

// ─── Feedback ───────────────────────────────────────────────────────────────────────────────────

describe("on-screen practice feedback", () => {
  const items = (which: Which) => experience(clone(), which).learner.items;
  it("marks a set by whole groups and explains near misses without giving the count", () => {
    const task = items("guided")[0].task; // 1/4 of 8 caps in 4 drawn groups
    expect(evaluateTask(task, { kind: "SELECTION", selected: [] })?.state).toBe("INCOMPLETE");
    expect(evaluateTask(task, { kind: "SELECTION", selected: [0, 1] })?.state).toBe("MATCH");
    const scattered = evaluateTask(task, { kind: "SELECTION", selected: [0, 2] })!;
    expect(scattered.state).toBe("NOT_YET");
    expect(scattered.message).toMatch(/whole groups/);
    const wrongCount = evaluateTask(task, { kind: "SELECTION", selected: [0, 1, 2, 3] })!;
    expect(wrongCount).toMatchObject({ state: "NOT_YET" });
    expect(wrongCount.message).toContain("share the 8 bottle caps into 4 equal groups");
  });

  it("names a pictured fraction and catches the swapped and whole-versus-part mistakes", () => {
    const task = items("independent")[0].task; // 3 of 8 mangoes
    expect(evaluateTask(task, { kind: "FRACTION", numerator: 3, denominator: 8 })?.state).toBe("MATCH");
    expect(evaluateTask(task, { kind: "FRACTION", numerator: 8, denominator: 3 })?.message).toMatch(/swapped/);
    expect(evaluateTask(task, { kind: "FRACTION", numerator: 3, denominator: 5 })?.message).toMatch(/bottom number is the whole/);
    expect(evaluateTask(task, { kind: "FRACTION", numerator: 2, denominator: 8 })?.message).toMatch(/bottom number is right/);
    expect(evaluateTask(task, { kind: "FRACTION", numerator: 0, denominator: 0 })?.state).toBe("INCOMPLETE");
  });

  it("judges equal parts from the drawn sizes and shades strips by the stated fraction", () => {
    const equal = items("independent")[3].task; // 3 unequal pieces
    expect(evaluateTask(equal, { kind: "EQUAL_CHOICE", equal: false })?.state).toBe("MATCH");
    expect(evaluateTask(equal, { kind: "EQUAL_CHOICE", equal: true })?.state).toBe("NOT_YET");
    const shade = items("guided")[3].task; // 3/4
    expect(evaluateTask(shade, { kind: "SELECTION", selected: [0, 2, 3] })?.state).toBe("MATCH");
    expect(evaluateTask(shade, { kind: "SELECTION", selected: [0] })?.state).toBe("NOT_YET");
  });
});

// ─── Rendering ──────────────────────────────────────────────────────────────────────────────────

describe("Teacher Preview renders each activity type", () => {
  it.each([
    ["guided", "Guided practice", "Individual", "12 minutes", "Practice only"],
    ["independent", "Independent practice", "Individual", "12 minutes", "Practice only"],
    ["classwork", "Classwork", "Pair", "25 minutes", "Formative"],
    ["homework", "Homework", "Individual", "15 minutes", "Practice only"],
  ] as const)("teacher mode: %s shows type, objective, duration, collaboration, instructions, materials and evidence intent", async (which, label, collab, duration, evidence) => {
    await renderPreview("teacher", which);
    const guide = $("[data-testid=teacher-activity-guide]")!;
    expect(guide).toBeTruthy();
    const t = guide.textContent!;
    expect(text("#cbp-item-panel .cbp-eyebrow")).toContain(label);
    expect(t).toContain(label);
    expect(text("[data-testid=activity-objectives]")).toContain("fixture.obj.g4-math.fractions");
    expect(t).toContain(duration);
    expect(t).toContain(collab);
    expect(t).toContain(evidence);
    expect(t).toContain("Student instructions");
    expect($$("[data-testid=teacher-instructions] li").length).toBeGreaterThan(0);
    expect($$("[data-testid=activity-materials] li").length).toBeGreaterThan(0);
    expect($$("[data-testid=activity-flow] li").length).toBeGreaterThan(0);
    expect(text("[data-testid=alignment-status]")).toContain("not approval");
  });

  it("shows classwork's teacher-led workflow: phases, pair grouping and required materials", async () => {
    await renderPreview("teacher", "classwork");
    expect($$("[data-testid=activity-flow] li").map((li) => li.textContent)).toEqual([expect.stringContaining("Launch"), expect.stringContaining("Pair work"), expect.stringContaining("Share")]);
    expect(text("[data-testid=teacher-activity-guide]")).toContain("Sharer and Checker");
    expect(text("[data-testid=activity-materials]")).toContain("12 bottle caps or stones per pair");
    expect(text("[data-testid=activity-materials]")).toContain("Required");
  });

  it.each(["guided", "independent", "classwork", "homework"] as const)("student mode: %s renders the learner experience with no teacher material", async (which) => {
    await renderPreview("student", which);
    const frame = $("[data-testid=student-preview]")!;
    expect(frame.querySelector("[data-testid=learner-experience]")).toBeTruthy();
    expect(frame.querySelector("[data-testid=teacher-activity-guide]")).toBeNull();
    for (const s of TEACHER_ONLY) expect(frame.textContent).not.toContain(s);
    expect(text("[data-testid=purpose-note]").length).toBeGreaterThan(20);
    expect($$("[data-testid=learner-steps] li").length).toBeGreaterThan(0);
  });
});

describe("guided versus independent practice", () => {
  it("guided models an example and scaffolds with a hint ladder", async () => {
    await renderPreview("student", "guided");
    const example = $("[data-testid=worked-example]")!;
    expect(example.textContent).toContain("Step 1 of 4");
    await click(button(example, "Next step"));
    expect(example.textContent).toContain("Step 2 of 4");
    expect(button(example, "Back").disabled).toBe(false);
    const item = $$("[data-testid=practice-item]")[0];
    const hint = button(item, /Show hint 1 of 3/);
    await click(hint);
    expect(item.querySelectorAll(".cbx-hints li").length).toBe(1);
    await click(button(item, /Show hint 2 of 3/));
    await click(button(item, /Show hint 3 of 3/));
    expect(button(item, "No more hints").disabled).toBe(true);
    expect(text("[data-testid=purpose-note]")).toMatch(/practice, not a test/i);
  });

  it("independent has no worked example, at most one hint and more items", async () => {
    await renderPreview("student", "independent");
    expect($("[data-testid=worked-example]")).toBeNull();
    const items = $$("[data-testid=practice-item]");
    expect(items.length).toBe(6);
    for (const item of items) expect([...item.querySelectorAll("button")].filter((b) => /hint/i.test(b.textContent ?? "")).length).toBeLessThanOrEqual(1);
    expect(text("[data-testid=purpose-note]")).toMatch(/not a test.*does not change your results/i);
  });
});

describe("keyboard and touch accessibility", () => {
  it("uses native, labelled toggle buttons; checking announces feedback in a live region", async () => {
    await renderPreview("student", "guided");
    const item = $$("[data-testid=practice-item]")[0];
    const caps = [...item.querySelectorAll<HTMLButtonElement>("[role=group] button")];
    expect(caps).toHaveLength(8);
    for (const b of caps) {
      expect(b.type).toBe("button");
      expect(b.getAttribute("aria-pressed")).toBe("false");
      expect(b.getAttribute("aria-label")).toMatch(/^bottle cap \d of 8, group \d$/);
    }
    await click(caps[0]); await click(caps[1]);
    expect(caps[0].getAttribute("aria-pressed")).toBe("true");
    await click(button(item, "Check"));
    const feedback = item.querySelector("[data-testid=item-feedback]")!;
    expect(feedback.getAttribute("role")).toBe("status");
    expect(feedback.getAttribute("aria-live")).toBe("polite");
    expect(feedback.textContent).toContain("Yes.");
    await click(button(item, "Start again"));
    expect(caps.every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(feedback.textContent).toBe("");
  });

  it("builds a fraction with stepper buttons, not free text", async () => {
    await renderPreview("student", "guided");
    const item = $$("[data-testid=practice-item]").find((el) => el.getAttribute("data-task") === "NAME_FRACTION")!;
    const [topMinus, topPlus, , bottomPlus] = [...item.querySelectorAll<HTMLButtonElement>(".cbx-stepper button")];
    expect(topPlus.getAttribute("aria-label")).toBe("Top number: one more");
    expect(topMinus.disabled).toBe(true);
    for (let i = 0; i < 2; i++) await click(topPlus);
    for (let i = 0; i < 5; i++) await click(bottomPlus);
    await click(button(item, "Check"));
    expect(item.querySelector("[data-testid=item-feedback]")!.textContent).toContain("2/5");
    expect(item.querySelector("input")).toBeNull();
  });

  it("declares touch-sized targets, visible focus and overflow-safe layout in CSS", () => {
    const css = readFileSync(path.resolve("app/globals.css"), "utf8");
    const block = css.slice(css.indexOf("/* Activity experiences"));
    expect(block).toMatch(/\.cbx-btn \{[^}]*min-height: 48px; min-width: 48px/);
    expect(block).toMatch(/\.cbx-obj-btn \{[^}]*min-width: 48px; min-height: 48px/);
    expect(block).toMatch(/\.cbx-strip-part \{[^}]*min-width: 0; min-height: 56px/);
    expect(block).toMatch(/\.cbx-check \{[^}]*min-height: 44px/);
    expect(block).toMatch(/\.cbx-btn:focus-visible[^{]*\{ outline: 3px solid/);
    expect(block).toMatch(/\.cbx-strip \{ width: 100%; max-width: 420px/);
    expect(block).toMatch(/@media \(forced-colors:active\)/);
  });
});

describe("offline-safe homework", () => {
  it("is paper-based, readable without script, and keeps learner instructions apart from teacher notes", async () => {
    const r = await resolved();
    const hw = r.learnerProjection.activities.find((a) => a.identity.itemId === ids.homework)!;
    const markup = renderToStaticMarkup(<LearnerActivityExperience experience={hw.experience!} minutes={15} collaboration="Individual" steps={hw.instructions.map((s) => s.text)} />);
    // Every question, hint (native <details>) and the self-check are in the server HTML.
    for (const item of hw.experience!.items) expect(markup).toContain(item.prompt);
    expect(markup).toContain("<details");
    expect(markup).toContain("Check your work");
    expect(markup).toContain("No device or internet needed");
    expect(markup).not.toMatch(/data-testid="practice-item"/);
    expect(markup).not.toContain(">Check<");
    for (const s of TEACHER_ONLY) expect(markup).not.toContain(s);
    expect(r.learnerProjection.offline.allowedCapabilities).toContain("PRINTABLE_WORKSHEETS");
    expect(r.learnerProjection.offline.assets.map((a) => a.assetId)).toContain("fixture.asset.parts-of-a-set-homework-sheet");
  });

  it("renders homework in Student view with the offline badge and family note", async () => {
    await renderPreview("student", "homework");
    expect($("[data-testid=offline-badge]")?.textContent).toBe("Works offline");
    expect($$("[data-testid=paper-item]")).toHaveLength(4);
    expect($("[data-testid=family-note]")?.textContent).toMatch(/grown-up at home/);
  });
});

describe("no write path", () => {
  it("activity renderers and logic use no network, storage, server actions or mutation", () => {
    const files = [
      "lib/content-bundle/v1/activityExperience.ts",
      "lib/content-bundle/preview/fractionFeedback.ts",
      "lib/content-bundle/v1/fixtures/grade4FractionsActivitiesFixture.ts",
      "components/teacher/content-bundle-preview/activity/FractionVisuals.tsx",
      "components/teacher/content-bundle-preview/activity/LearnerActivityExperience.tsx",
      "components/teacher/content-bundle-preview/activity/TeacherActivityGuide.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(path.resolve(file), "utf8");
      expect(source, file).not.toMatch(/fetch\(|axios|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|prisma|["']use server["']|method:\s*["']POST|publish\w*\(|\/api\//);
    }
  });
});
