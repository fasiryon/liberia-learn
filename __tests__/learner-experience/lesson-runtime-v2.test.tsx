// @vitest-environment jsdom
// Lesson Experience V2 runtime: a server-delivered native lesson (GET /api/student/lessons/:id/experience)
// on the student lesson routes. The client renders only what the server stated (release, version,
// scene/objective identity, lab links, evidence disposition, completion) and never invents mastery,
// correctness, lab authorization or evidence persistence.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const push = vi.hoisted(() => vi.fn());
// Stable like Next's router: the lesson viewer's load effect depends on it.
const router = vi.hoisted(() => ({ push: (href: string) => push(href) }));
const store = vi.hoisted(() => new Map<string, unknown>());
const cache = vi.hoisted(() => ({ lesson: null as unknown, removed: [] as string[] }));
vi.mock("next/navigation", () => ({ useRouter: () => router, useParams: () => ({ contentId: "fixture-levers-g6" }) }));
vi.mock("@/lib/learner-experience/progressStore", () => ({
  loadExperienceProgress: async (id: string) => store.get(id) ?? null,
  saveExperienceProgress: async (progress: { experienceId: string }) => { store.set(progress.experienceId, JSON.parse(JSON.stringify(progress))); },
}));
vi.mock("@/components/toolkit/toolComponents", () => ({ TOOL_COMPONENTS: {} }));
vi.mock("@/components/interactive-labs/v2/InteractiveLabPlayer", () => ({ InteractiveLabPlayer: ({ labId }: { labId: string }) => <div data-fake-lab={labId} /> }));
vi.mock("@/lib/lesson-offline-cache", () => ({
  loadCachedLesson: async () => cache.lesson,
  isLessonCached: async () => false,
  cacheLessonContent: async () => true,
  refreshLessonAvailability: async () => false,
  removeCachedLesson: async (id: string) => { cache.removed.push(id); return true; },
}));
vi.mock("@/lib/trackEvent", () => ({ trackEvent: () => undefined, EVENTS: { LESSON_VIEW: "v", LESSON_COMPLETE: "c" } }));

import { NativeLessonRuntimeView, LessonUnavailable } from "@/components/learner-experience/LessonRuntimeV2";
import { InteractiveLabScreen } from "@/components/learner-experience/InteractiveLabScreen";
import LessonViewerClient from "@/app/student/lesson/[contentId]/LessonViewerClient";
import { lessonRouteHref, parseAuthorizedLabLinks, resolveLessonDelivery, resolveLessonRuntime, returnSceneFromSearch, unavailableReasonForStatus, type EvidenceChannel, type LessonRouteTarget, type NativeLessonRuntime } from "@/lib/learner-experience/lessonRuntime";
import { loadCachedNativeLesson, loadLessonDelivery } from "@/lib/learner-experience/lessonRuntimeClient";
import { labReturnStorageKey, parseStudentLabReturn } from "@/lib/learner-experience/labLaunch";
import { buildEvidenceEnvelope } from "@/lib/learner-experience/evidenceHandoff";
import { initialProgress, recordResponse } from "@/lib/learner-experience/progress";
import { SCENE_TYPES } from "@/lib/learner-experience/types";
import { FIXTURE_LAB_ID, FIXTURE_LAB_LINK_ID, runtimeLessonDelivery, runtimeLessonExperience, runtimeLessonResponse } from "../../e2e/product-design-v2/lessonFixtures";

const CONTENT: LessonRouteTarget = { kind: "CONTENT", contentId: "fixture-levers-g6" };
const WORK: LessonRouteTarget = { kind: "SCHEDULED_WORK", scheduledWorkId: "work-123", contentId: "fixture-levers-g6" };

let root: Root | null = null;
let host: HTMLDivElement;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => {
  store.clear(); push.mockReset(); window.sessionStorage.clear(); window.history.replaceState(null, "", "/student/lesson/fixture-levers-g6");
  cache.lesson = null; cache.removed = [];
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => true });
  host = document.createElement("div"); document.body.appendChild(host);
});
afterEach(() => { act(() => root?.unmount()); root = null; host.remove(); vi.unstubAllGlobals(); });

/** A live delivery (default) or a signed offline copy of the learner projection (source: CACHE). */
function resolved(options: { labAuthorized?: boolean; source?: "NETWORK" | "CACHE"; completedAt?: string | null; grade?: 2 | 6 } = {}): NativeLessonRuntime {
  const grade = options.grade ?? 6;
  const result = options.source === "CACHE"
    ? resolveLessonRuntime({ payload: runtimeLessonResponse(grade).payload, source: "CACHE", target: CONTENT, contentVersion: "1.0.0" })
    : resolveLessonDelivery(runtimeLessonDelivery(grade, { labAuthorized: options.labAuthorized }), { serverCompletedAt: options.completedAt ?? null });
  if (result.kind !== "NATIVE") throw new Error(`expected NATIVE, got ${JSON.stringify(result)}`);
  return result;
}

async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
async function render(node: React.ReactNode) {
  await act(async () => { root = createRoot(host); root.render(node); });
  await flush();
}
async function play(lesson: NativeLessonRuntime, options: { target?: LessonRouteTarget; evidence?: EvidenceChannel } = {}) {
  await render(<NativeLessonRuntimeView lesson={lesson} target={options.target ?? CONTENT} exitHref="/student/learn" enabledToolIds={[]} evidence={options.evidence} />);
}
const player = () => host.querySelector("[data-lesson-player-v2]") as HTMLElement;
const sceneId = () => player()?.getAttribute("data-scene-id");
const button = (label: string) => Array.from(host.querySelectorAll("button")).find((candidate) => candidate.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined;
const click = async (element: HTMLElement | undefined) => { if (!element) throw new Error("missing element"); await act(async () => { element.click(); }); await flush(); };
const choose = async (name: string, index: number) => click(host.querySelectorAll<HTMLInputElement>(`input[name='${name}']`)[index]);
const at = (lesson: NativeLessonRuntime, sceneIdValue: string, extra: Record<string, unknown> = {}) =>
  store.set(lesson.experience.id, { v: 2, experienceId: lesson.experience.id, experienceVersion: lesson.experience.version, sceneId: sceneIdValue, completedSceneIds: [], responses: {}, revealed: {}, labs: {}, updatedAt: "2026-10-12T00:00:00.000Z", ...extra });
async function type(selector: string, text: string) {
  const box = host.querySelector(selector) as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => { setter.call(box, text); box.dispatchEvent(new Event("input", { bubbles: true })); });
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
/** Route fetch by URL prefix; anything unrouted is a 404 (as the delivery seam is on a branch without it). */
function serve(routes: Record<string, () => Response>) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const match = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    return match ? routes[match]() : json(404, { error: "Not found" });
  }));
}

describe("delivery resolution: render only what the server stated", () => {
  it("a released native delivery resolves CURRENT with the server's identity and disposition", () => {
    const lesson = resolved();
    expect(lesson.availability).toBe("CURRENT");
    expect(lesson.identity).toEqual({ lessonId: "fixture-levers-g6", lessonVersion: "1.0.0", contentId: "fixture-levers-g6", contentVersion: "1.0.0", releaseId: "fixture-release", releaseIdentity: "fixture-release-identity", revisionId: "fixture-revision" });
    expect(lesson.evidenceDisposition).toBe("OBSERVATION_ONLY");
    expect(lesson.experience.authority.status).toBe("APPROVED_RELEASE");
    expect(lesson.experience.scenes.map((scene) => scene.type)).toEqual([...SCENE_TYPES]);
  });

  it("no release identity, a wrong contract or missing invariants never become a released lesson", () => {
    expect(resolveLessonDelivery(runtimeLessonDelivery(6, { releaseId: null }))).toEqual({ kind: "UNAVAILABLE", reason: "NOT_RELEASED" });
    expect(resolveLessonDelivery({ ...runtimeLessonDelivery(6), contractVersion: "lesson-experience-delivery/0.9.0" })).toEqual({ kind: "UNAVAILABLE", reason: "INCOMPATIBLE_VERSION" });
    expect(resolveLessonDelivery({ ...runtimeLessonDelivery(6), compatibility: "SOMETHING" })).toEqual({ kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" });
    expect(resolveLessonDelivery({ ...runtimeLessonDelivery(6), evidenceDisposition: { status: "OBSERVATION_ONLY", masteryMutation: true, authoritativeSubmission: false } })).toEqual({ kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" });
    expect(resolveLessonDelivery({ ...runtimeLessonDelivery(6), compatibility: "LEGACY_COMPATIBLE" })).toEqual({ kind: "LEGACY" });
  });

  it("restricted, secret-bearing and malformed scenes are refused, not repaired", () => {
    const delivery = runtimeLessonDelivery(6);
    const teacherText = { ...delivery, scenes: delivery.scenes.map((scene) => scene.id === "explain" ? { ...scene, content: { body: "Read this.\n\n## Teacher Notes\nThe answer is B." } } : scene) };
    expect(resolveLessonDelivery(teacherText)).toEqual({ kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" });
    const keyedPoint = { ...delivery, scenes: delivery.scenes.map((scene) => scene.id === "explain" ? { ...scene, content: { ...scene.content, keyPoints: [{ text: "x", correctAnswer: "y" }] } } : scene) };
    expect(resolveLessonDelivery(keyedPoint)).toEqual({ kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" });
    const badAuthority = { ...delivery, scenes: delivery.scenes.map((scene) => scene.id === "check" ? { ...scene, interaction: { ...scene.interaction, feedbackAuthority: "CLIENT" } } : scene) };
    expect(resolveLessonDelivery(badAuthority)).toEqual({ kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" });
    // An unknown key never survives the strict rebuild.
    const extra = { ...delivery, scenes: delivery.scenes.map((scene) => scene.id === "final" ? { ...scene, interaction: { ...scene.interaction, answerKey: [0, 0] } } : scene) };
    expect(JSON.stringify(resolveLessonDelivery(extra))).not.toContain("answerKey");
  });

  it("a learner projection payload (curriculum route / offline copy) never presents an unreleased lesson", async () => {
    for (const status of ["CURRICULUM_V2_DRAFT", "PROTOTYPE_FIXTURE", "LEGACY_UNGOVERNED"] as const) {
      expect(resolveLessonRuntime({ payload: runtimeLessonResponse(6, { status }).payload, source: "NETWORK", target: CONTENT })).toEqual({ kind: "UNAVAILABLE", reason: "NOT_RELEASED" });
    }
    expect(resolveLessonRuntime({ payload: { title: "x", body: "", studentReady: false }, source: "NETWORK", target: CONTENT })).toEqual({ kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" });
    expect(resolveLessonRuntime({ payload: { lessonExperience: { ...runtimeLessonExperience(6), contractVersion: "lesson-experience/0.9.0" } }, source: "CACHE", target: CONTENT })).toEqual({ kind: "UNAVAILABLE", reason: "INCOMPATIBLE_VERSION" });
    expect(resolveLessonRuntime({ payload: { title: "Old lesson", body: "Text", studentReady: true }, source: "NETWORK", target: CONTENT })).toEqual({ kind: "LEGACY" });
    // Real Curriculum V2 output through the real server projection stays a draft.
    const { runG4Proof } = await import("@/lib/curriculum/v2/g4Proof");
    const { projectStudentLessonPayload } = await import("@/lib/curriculum/studentLessonProjection");
    const outcome = runG4Proof("solid-figures.json", "moe-math-g4-s2-p6-geometry-and-statistics-obj5");
    if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
    expect(resolveLessonRuntime({ payload: projectStudentLessonPayload({ curriculumV2: outcome.lesson }), source: "NETWORK", target: CONTENT })).toEqual({ kind: "UNAVAILABLE", reason: "NOT_RELEASED" });
    expect(unavailableReasonForStatus(410)).toBe("REVOKED");
    expect(unavailableReasonForStatus(409)).toBe("INCOMPATIBLE_VERSION");
    expect(unavailableReasonForStatus(404)).toBe("NOT_FOUND");
  });

  it("lab links: only server-authorized links placed on their own LAB scene; never from a payload or cached copy", () => {
    const experience = resolved({ labAuthorized: true }).experience;
    const launchContext = runtimeLessonDelivery(6, { labAuthorized: true }).authorizedLabLinks[0].launchContext;
    const good = { launchContext, linkId: FIXTURE_LAB_LINK_ID, labId: FIXTURE_LAB_ID, sceneId: "lab", label: "Lever lab", authorization: "APPROVED_LINK_CERTIFIED_LAB" };
    expect(parseAuthorizedLabLinks([good], experience)).toEqual([{ linkId: FIXTURE_LAB_LINK_ID, labId: FIXTURE_LAB_ID, sceneId: "lab", title: "Lever lab", summary: null, launchContext }]);
    for (const bad of [{ ...good, authorization: "SHOWCASE" }, { ...good, sceneId: "explain" }, { ...good, linkId: "other-link" }, { ...good, labId: "../evil" }, { ...good, label: "" }]) expect(parseAuthorizedLabLinks([bad], experience)).toEqual([]);
    expect(parseAuthorizedLabLinks([good, good], experience)).toHaveLength(1);
    expect(resolved({ labAuthorized: true }).labLinks).toHaveLength(1);
    expect(resolved({ source: "CACHE" }).labLinks).toEqual([]);
  });

  it("keyless formative evidence reports the choice only (no client correctness)", () => {
    const lesson = resolved();
    const progress = recordResponse(initialProgress(lesson.experience), "check", "c1", 1);
    const envelope = buildEvidenceEnvelope(lesson.experience, progress, [], {});
    const check = envelope.observations.find((observation) => observation.sceneId === "check")!;
    expect(check.payload).toEqual({ items: [{ itemId: "c1", selectedIndex: 1 }], serverScored: false });
    expect(envelope.masteryMutation).toBe(false);
  });
});

describe("Lesson Player V2 on a student route", () => {
  it("renders the delivered lesson with its objective and stable identity", async () => {
    await play(resolved());
    expect(player().getAttribute("data-lesson-id")).toBe("fixture-levers-g6");
    expect(player().getAttribute("data-lesson-version")).toBe("1.0.0");
    expect(player().getAttribute("data-release-id")).toBe("fixture-release");
    expect(player().getAttribute("data-evidence-disposition")).toBe("OBSERVATION_ONLY");
    expect(player().getAttribute("data-availability")).toBe("CURRENT");
    expect(sceneId()).toBe("intro");
    expect(player().getAttribute("data-objective-ids")).toBe("fixture-obj-levers");
    expect(host.textContent).toContain("Scene 1 of 12");
    expect(host.querySelector("#lesson-goals")?.textContent).toBe("In this lesson you will");
    expect(host.textContent).toContain("Name the fulcrum, load and effort of a lever.");
    expect(host.textContent).not.toContain("Internal prototype");
    expect(host.querySelectorAll("h1")).toHaveLength(1);
  });

  it("navigates scene by scene, blocks Continue until a scene is complete, and allows Back", async () => {
    await play(resolved());
    for (const expected of ["goal", "explain", "watch"]) { await click(button("Continue")); expect(sceneId()).toBe(expected); }
    // MEDIA is text first: the description and transcript teach without the asset; a non-local ref is never fetched.
    expect(host.textContent).toContain("A plank resting on a log");
    expect(host.textContent).toContain("The child pushes down a little");
    expect(host.querySelector("img")).toBeNull();
    await click(button("Continue"));
    expect(sceneId()).toBe("diagram");
    expect(button("Continue")!.disabled).toBe(true);
    // Stages open in order, by keyboard-operable buttons.
    for (const label of ["Effort", "Fulcrum", "Load"]) await click(Array.from(host.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")).find((candidate) => candidate.textContent?.includes(label)));
    expect(button("Continue")!.disabled).toBe(false);
    await click(button("Previous"));
    expect(sceneId()).toBe("watch");
    expect(document.activeElement?.id).toBe("scene-title");
  });

  it("formative checks delivered without keys record the choice and never judge it", async () => {
    const lesson = resolved();
    at(lesson, "check");
    await play(lesson);
    expect(host.querySelector("[data-formative-feedback]")?.getAttribute("data-formative-feedback")).toBe("SERVER_REQUIRED");
    expect(button("Continue")!.disabled).toBe(true);
    await choose("c1", 0);
    expect(host.textContent).toContain("Your choice is saved. This lesson does not mark it.");
    expect(host.textContent).not.toMatch(/Right, the fulcrum|Look at the diagram again/);
    expect(button("Continue")!.disabled).toBe(false);
  });

  it("resumes by scene id, and a new lesson version starts fresh with an honest notice", async () => {
    const lesson = resolved();
    at(lesson, "review");
    await play(lesson);
    expect(sceneId()).toBe("review");
    expect(host.textContent).toContain("Scene 11 of 12");
    act(() => root?.unmount()); root = null;
    at(lesson, "review", { experienceVersion: "0.9.0" });
    await play(lesson);
    expect(sceneId()).toBe("intro");
    expect(host.querySelector("[data-runtime-notice]")?.textContent).toContain("This lesson was updated since you last opened it");
  });

  it("a lab the server did not authorize is delivered as a walkthrough scene", async () => {
    const lesson = resolved();
    at(lesson, "lab");
    await play(lesson);
    expect(host.querySelector("[data-lab-launchable]")?.getAttribute("data-lab-launchable")).toBe("false");
    expect(button("Explore in Lab")).toBeUndefined();
    expect(host.textContent).toContain("Lab not available here");
    expect(host.textContent).toContain("Slide the log toward the stone");
    expect(button("Continue")!.disabled).toBe(false);
  });

  it("launches an authorized lab on the existing Labs route and returns to the same scene", async () => {
    const lesson = resolved({ labAuthorized: true });
    at(lesson, "lab");
    await play(lesson);
    await click(button("Explore in Lab"));
    const url = new URL(push.mock.calls[0][0] as string, "http://x");
    expect(url.pathname).toBe(`/student/labs/${FIXTURE_LAB_ID}`);
    expect(url.searchParams.get("rt")).toBe("c:fixture-levers-g6");
    const origin = parseStudentLabReturn(FIXTURE_LAB_ID, Object.fromEntries(url.searchParams.entries()))!;
    expect(origin.context.origin).toMatchObject({ experienceId: "fixture-levers-g6", experienceVersion: "1.0.0", sceneId: "lab", objectiveIds: ["fixture-obj-levers", "fixture-obj-balance"] });
    expect(origin.returnHref).toBe("/student/lesson/fixture-levers-g6?scene=lab&from=lab");
    act(() => root?.unmount()); root = null;

    // The lab host hands back a summary; the learner had moved on in another tab, the return wins.
    store.set(lesson.experience.id, { ...(store.get(lesson.experience.id) as object), sceneId: "intro" });
    window.sessionStorage.setItem(labReturnStorageKey(lesson.experience.id), JSON.stringify({ labId: FIXTURE_LAB_ID, labVersion: "1.0.0", linkId: FIXTURE_LAB_LINK_ID, completedCheckIds: ["a"], totalChecks: 3, tripObserved: false, resetObserved: false, finalProfile: "LOW", minutesInLab: 2, exit: "RETURNED_EARLY" }));
    window.history.replaceState(null, "", origin.returnHref);
    await play(lesson);
    expect(sceneId()).toBe("lab");
    expect(host.textContent).toContain("Welcome back");
    expect(host.textContent).toContain("Lab checks finished: 1 of 3");
    expect(host.textContent).not.toContain("trip the plant");
    expect(button("Continue")!.disabled).toBe(false);
    expect(window.location.search).toBe("");
  });

  it("an assigned lesson returns to the assignment route; a forged hand-back is ignored", async () => {
    const lesson = resolveLessonDelivery(runtimeLessonDelivery(6, { labAuthorized: true, routeTarget: WORK })) as NativeLessonRuntime;
    at(lesson, "lab");
    await play(lesson, { target: WORK });
    await click(button("Explore in Lab"));
    const url = new URL(push.mock.calls[0][0] as string, "http://x");
    expect(parseStudentLabReturn(FIXTURE_LAB_ID, Object.fromEntries(url.searchParams.entries()))!.returnHref).toBe("/student/lessons/work-123?scene=lab&from=lab");
    act(() => root?.unmount()); root = null;
    store.clear();
    window.sessionStorage.setItem(labReturnStorageKey(lesson.experience.id), JSON.stringify({ labId: "g4-solid-figures", labVersion: "1", linkId: FIXTURE_LAB_LINK_ID, completedCheckIds: [], totalChecks: 1, tripObserved: false, resetObserved: false, finalProfile: "LOW", minutesInLab: 1, exit: "COMPLETED" }));
    window.history.replaceState(null, "", "/student/lessons/work-123?scene=lab&from=lab");
    await play(lesson, { target: WORK });
    expect(sceneId()).toBe("intro");
  });

  it("the lab return target is rebuilt from validated ids, never followed as a URL", () => {
    const base = { v: "1", lv: "1.0.0", link: FIXTURE_LAB_LINK_ID, exp: "fixture-levers-g6", ver: "1.0.0", scene: "lab", activity: "fixture-levers-g6", obj: "fixture-obj-levers" };
    for (const rt of ["https://evil.example", "c:../../admin", "x:abc", "c:", "//evil", "c:a/b"]) expect(parseStudentLabReturn(FIXTURE_LAB_ID, { ...base, rt })).toBeNull();
    expect(parseStudentLabReturn(FIXTURE_LAB_ID, base)).toBeNull();
    expect(returnSceneFromSearch(new URLSearchParams("scene=lab"))).toBeNull();
    expect(returnSceneFromSearch(new URLSearchParams("scene=../x&from=lab"))).toBeNull();
    expect(lessonRouteHref(WORK, "lab")).toBe("/student/lessons/work-123?scene=lab&from=lab");
  });

  it("assessment handoff: governed reference, no key in the page, no marking in the browser", async () => {
    const lesson = resolved();
    at(lesson, "final");
    await play(lesson);
    const seam = host.querySelector("[data-assessment-id]") as HTMLElement;
    expect(seam.getAttribute("data-assessment-id")).toBe("fixture-levers-final");
    expect(seam.getAttribute("data-assessment-version")).toBe("1.0.0");
    expect(seam.getAttribute("data-assessment-scoring")).toBe("SERVER_AUTHORITY");
    expect(host.textContent).toContain("Final check · 2 questions");
    expect(host.textContent).toContain("not marked or sent from this lesson yet");
    await choose("m1", 1);
    expect(host.textContent).not.toMatch(/correct|right|wrong|score/i);
    expect(host.innerHTML).not.toMatch(/correctIndex|answerKey/);
  });

  it("completion with the server's OBSERVATION_ONLY disposition is presentation-only and claims no mastery", async () => {
    const lesson = resolved();
    at(lesson, "final");
    await play(lesson);
    await choose("m1", 0); await choose("m2", 0);
    await click(button("Finish"));
    const panel = host.querySelector("[data-finish-state]") as HTMLElement;
    expect(panel.getAttribute("data-finish-state")).toBe("PRESENTATION_ONLY");
    expect(panel.textContent).toContain("saved on this device only");
    expect(panel.textContent).toContain("does not decide what you have mastered");
    expect(panel.textContent).not.toMatch(/you mastered|mastery achieved|score/i);
    expect(document.activeElement?.id).toBe("handoff-title");
    expect(button("Finished")!.disabled).toBe(true);
  });

  it("with an injected server channel, evidence for the current version is sent once and the server's dispositions shown", async () => {
    const submit = vi.fn(async (envelope: { observations: readonly { observationId: string }[] }) => ({ accepted: true, dispositions: envelope.observations.map((o) => ({ observationId: o.observationId, disposition: "SUBMIT_TO_ASSESSMENT_AUTHORITY" })) }));
    const lesson = resolved({ completedAt: "2026-10-11T10:00:00.000Z" });
    at(lesson, "final");
    await play(lesson, { evidence: { status: "SERVER", submit } });
    expect(host.textContent).toContain("marked by your school's assessment system");
    await choose("m1", 0); await choose("m2", 1);
    await click(button("Finish"));
    expect(submit).toHaveBeenCalledTimes(1);
    const envelope = submit.mock.calls[0][0] as unknown as { experienceId: string; experienceVersion: string; masteryMutation: boolean; observations: { kind: string; payload: Record<string, unknown> }[] };
    expect(envelope).toMatchObject({ experienceId: "fixture-levers-g6", experienceVersion: "1.0.0", masteryMutation: false });
    const mastery = envelope.observations.find((o) => o.kind === "MASTERY_RESPONSE")!;
    expect(JSON.stringify(mastery.payload)).not.toMatch(/correct|matched/i);
    expect(host.querySelector("[data-finish-state]")?.getAttribute("data-finish-state")).toBe("SENT");
    expect(host.querySelector("[data-finish-state] [data-evidence-dispositions]")?.getAttribute("data-evidence-dispositions")).toContain("SUBMIT_TO_ASSESSMENT_AUTHORITY");
    expect(host.querySelector("[data-server-completion]")?.textContent).toContain("completed");
  });

  it("a cached copy is read-only: labs do not open and nothing is submitted, even with a server channel", async () => {
    const submit = vi.fn();
    const lesson = resolved({ source: "CACHE" });
    at(lesson, "lab");
    await play(lesson, { evidence: { status: "SERVER", submit } });
    expect(player().getAttribute("data-availability")).toBe("CACHED_READ_ONLY");
    expect(player().getAttribute("data-evidence-disposition")).toBe("READ_ONLY");
    expect(host.textContent).toContain("Saved copy");
    expect(host.querySelector("[data-runtime-notice]")?.textContent).toContain("nothing is sent from it");
    expect(button("Explore in Lab")).toBeUndefined();
    await click(button("I read the walkthrough"));
    for (const id of ["lab", "reflect", "review"]) {
      expect(sceneId()).toBe(id);
      if (id === "reflect") await type("#reflect-r1", "Near the bag.");
      await click(button("Continue"));
    }
    await choose("m1", 0); await choose("m2", 0);
    await click(button("Finish"));
    expect(submit).not.toHaveBeenCalled();
    expect(host.querySelector("[data-finish-state]")?.getAttribute("data-finish-state")).toBe("READ_ONLY");
  });

  it("going offline mid-lesson reauthorizes before sending pending on the device instead of sending it", async () => {
    const submit = vi.fn(async () => ({ accepted: true, dispositions: [] }));
    serve({ "/api/student/lessons/fixture-levers-g6/experience": () => json(200, runtimeLessonDelivery(6)) });
    const lesson = resolved();
    at(lesson, "final");
    await play(lesson, { evidence: { status: "SERVER", submit } });
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => false });
    await act(async () => { window.dispatchEvent(new Event("offline")); });
    expect(host.querySelector("[data-runtime-notice]")?.textContent).toContain("You are offline");
    await choose("m1", 0); await choose("m2", 0);
    await click(button("Finish"));
    expect(submit).not.toHaveBeenCalled();
    expect(host.querySelector("[data-finish-state]")?.getAttribute("data-finish-state")).toBe("PENDING");
    expect(button("Try sending again")!.disabled).toBe(true);
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => true });
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await flush();
    await click(button("Try sending again"));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("Grade 2 uses the early-primary wording and larger targets", async () => {
    await play(resolved({ grade: 2 }));
    expect(player().getAttribute("data-age-band")).toBe("EARLY_PRIMARY");
    expect(host.textContent).toContain("Rice bags are heavy. A simple tool can help.");
  });

  it("unavailable states are honest and always offer a way back", async () => {
    await render(<LessonUnavailable reason="NOT_RELEASED" />);
    expect(host.querySelector("h1")?.textContent).toBe("This lesson isn't released yet");
    expect(host.querySelector("a")?.getAttribute("href")).toBe("/student/learn");
  });
});

describe("Labs route: lesson return only for a released lab", () => {
  const origin = () => parseStudentLabReturn(FIXTURE_LAB_ID, { v: "1", lv: "1.0.0", link: FIXTURE_LAB_LINK_ID, exp: "fixture-levers-g6", ver: "1.0.0", scene: "lab", activity: "fixture-levers-g6", obj: "fixture-obj-levers", rt: "c:fixture-levers-g6" })!;
  it("a released lab opened from a lesson offers Back to lesson", async () => {
    await render(<InteractiveLabScreen labId={FIXTURE_LAB_ID} access="RELEASED" lessonReturn={{ ...origin(), labVersion: "1.0.0", totalChecks: 3 }} />);
    expect(host.querySelector("[data-lab-host]")?.getAttribute("data-origin-scene")).toBe("lab");
    await click(button("Back to lesson"));
    expect(push).toHaveBeenCalledWith("/student/lesson/fixture-levers-g6?scene=lab&from=lab");
    expect(JSON.parse(window.sessionStorage.getItem(labReturnStorageKey("fixture-levers-g6"))!)).toMatchObject({ labId: FIXTURE_LAB_ID, linkId: FIXTURE_LAB_LINK_ID, totalChecks: 3 });
  });

  it("a showcase grant never becomes lesson-linked", async () => {
    await render(<InteractiveLabScreen labId={FIXTURE_LAB_ID} access="SHOWCASE" lessonReturn={{ ...origin(), labVersion: "1.0.0", totalChecks: 3 }} />);
    expect(host.querySelector("[data-lab-host]")).toBeNull();
    expect(host.querySelector("a")?.textContent).toContain("Back to Labs");
  });
});

describe("existing lesson deep links keep working through adapters", () => {
  const DELIVERY = "/api/student/lessons/fixture-levers-g6/experience";
  const CURRICULUM = "/api/curriculum/fixture-levers-g6";

  it("/student/lesson/[contentId] plays a native lesson from the delivery seam", async () => {
    serve({ [DELIVERY]: () => json(200, runtimeLessonDelivery(6, { labAuthorized: true })) });
    await render(<LessonViewerClient enabledToolIds={[]} />);
    await flush();
    expect(player().getAttribute("data-lesson-id")).toBe("fixture-levers-g6");
    expect(player().getAttribute("data-availability")).toBe("CURRENT");
    expect((fetch as unknown as { mock: { calls: string[][] } }).mock.calls.map((call) => call[0])).toEqual([`${DELIVERY}?kind=CONTENT`]);
  });

  it("/student/lesson/[contentId] keeps legacy lessons on the existing renderer (seam absent or legacy)", async () => {
    const legacy = { metadata: { version: "1", subject: "MATH", grade: 4 }, payload: { title: "Old lesson", body: "Legacy lesson text.", objectives: [], activities: [], studentReady: true }, audio: null, offlineManifest: null };
    for (const delivery of [() => json(404, { compatibility: "UNAVAILABLE", error: "UNAVAILABLE" }), () => json(200, { ...runtimeLessonDelivery(6), compatibility: "LEGACY_COMPATIBLE" })]) {
      serve({ [DELIVERY]: delivery, [CURRICULUM]: () => json(200, legacy) });
      await render(<LessonViewerClient enabledToolIds={[]} />);
      await flush();
      expect(player()).toBeNull();
      expect(host.textContent).toContain("Legacy lesson text.");
      // Library content exits to Learn, the same exit the native player uses on this route.
      expect(host.querySelector("a[aria-label='Back to Learn']")?.getAttribute("href")).toBe("/student/learn");
      act(() => root?.unmount()); root = null;
    }
  });

  it("/student/lesson/[contentId] shows honest unavailable states", async () => {
    serve({ [CURRICULUM]: () => json(410, { error: "Content revoked", offlineManifest: null }) });
    await render(<LessonViewerClient enabledToolIds={[]} />);
    await flush();
    expect(host.querySelector("[data-lesson-unavailable]")?.getAttribute("data-lesson-unavailable")).toBe("REVOKED");
    act(() => root?.unmount()); root = null;
    serve({ [DELIVERY]: () => json(409, { compatibility: "UNAVAILABLE", error: "INCOMPATIBLE_VERSION" }) });
    await render(<LessonViewerClient enabledToolIds={[]} />);
    await flush();
    expect(host.querySelector("[data-lesson-unavailable]")?.getAttribute("data-lesson-unavailable")).toBe("INCOMPATIBLE_VERSION");
    act(() => root?.unmount()); root = null;
    serve({ [DELIVERY]: () => json(200, runtimeLessonDelivery(6, { releaseId: null })) });
    await render(<LessonViewerClient enabledToolIds={[]} />);
    await flush();
    expect(host.querySelector("[data-lesson-unavailable]")?.getAttribute("data-lesson-unavailable")).toBe("NOT_RELEASED");
    act(() => root?.unmount()); root = null;
    // Offline with a signed saved copy of the learner projection: read-only player.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    cache.lesson = { metadata: { version: "1.0.0" }, payload: runtimeLessonResponse(6).payload };
    await render(<LessonViewerClient enabledToolIds={[]} />);
    await flush();
    expect(player().getAttribute("data-availability")).toBe("CACHED_READ_ONLY");
  });

  it("the delivery loader names the route's own id and reports what the seam said", async () => {
    serve({ "/api/student/lessons/work-123/experience": () => json(200, runtimeLessonDelivery(6, { routeTarget: WORK })) });
    expect(await loadLessonDelivery(WORK, "2026-10-11T10:00:00.000Z")).toMatchObject({ kind: "NATIVE", serverCompletion: { completedAt: "2026-10-11T10:00:00.000Z" } });
    serve({});
    expect(await loadLessonDelivery(WORK)).toEqual({ kind: "NO_DELIVERY", status: 404 });
    serve({ "/api/student/lessons/work-123/experience": () => json(409, {}) });
    expect(await loadLessonDelivery(WORK)).toEqual({ kind: "UNAVAILABLE", reason: "INCOMPATIBLE_VERSION" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await loadLessonDelivery(WORK)).toEqual({ kind: "NO_DELIVERY", status: "OFFLINE" });
    cache.lesson = null;
    expect(await loadCachedNativeLesson(WORK)).toEqual({ kind: "UNAVAILABLE", reason: "OFFLINE_NOT_CACHED" });
  });
});

describe("assigned lesson route component", () => {
  it("/student/lessons/[id] plays a native assigned lesson and shows the server's completion record", async () => {
    const { default: LessonDeliveryClient } = await import("@/app/student/lessons/[id]/LessonDeliveryClient");
    const work = { id: "work-123", contentId: "fixture-levers-g6", contentVersion: "1.0.0", title: "Levers help us lift", body: "Native migration retains legacy text", bodyStandard: "Legacy body", bodyBlock: "", status: "completed", completedAt: "2026-10-11T10:00:00.000Z" };
    serve({ "/api/student/work/work-123": () => json(200, work), "/api/student/lessons/work-123/experience": () => json(200, runtimeLessonDelivery(6, { routeTarget: WORK, completedAt: "2026-10-11T10:00:00.000Z" })) });
    window.history.replaceState(null, "", "/student/lessons/work-123");
    const lesson = runtimeLessonExperience(6);
    store.set(lesson.id, { v: 2, experienceId: lesson.id, experienceVersion: lesson.version, sceneId: "final", completedSceneIds: [], responses: { final: { m1: 0, m2: 0 } }, revealed: {}, labs: {}, updatedAt: "2026-10-12T00:00:00.000Z" });
    await render(<LessonDeliveryClient lessonId="work-123" enabledToolIds={[]} />);
    for (let i = 0; i < 5 && !player(); i++) await flush();
    expect(player().getAttribute("data-lesson-id")).toBe("fixture-levers-g6");
    expect(host.querySelectorAll("main")).toHaveLength(1);
    expect((fetch as any).mock.calls.some(([url]) => url.startsWith("/api/student/work/"))).toBe(false);
    await click(button("Finish"));
    expect(host.querySelector("[data-server-completion]")?.textContent).toContain("completed");
    expect(host.querySelector("[data-finish-state] a")?.getAttribute("href")).toBe("/student/today");
  });
});

describe("convergence cache and authority regression", () => {
  it("online native payload cannot bypass a failed delivery seam", () => {
    expect(resolveLessonRuntime({ payload: runtimeLessonResponse(6).payload, source: "NETWORK", target: CONTENT })).toEqual({ kind: "UNAVAILABLE", reason: "NOT_RELEASED" });
  });
  it("cached version mismatch is incompatible and cached checks have no keys", () => {
    expect(resolveLessonRuntime({ payload: runtimeLessonResponse(6).payload, source: "CACHE", target: CONTENT, contentVersion: "old-version" })).toEqual({ kind: "UNAVAILABLE", reason: "INCOMPATIBLE_VERSION" });
    expect(JSON.stringify(resolved({ source: "CACHE" }).experience)).not.toMatch(/correctIndex|optionFeedback/);
  });
  it("reconnect with a changed server version refuses the cached authority", async () => {
    serve({ "/api/student/lessons/fixture-levers-g6/experience": () => json(200, runtimeLessonDelivery(6, { version: "2.0.0" })) });
    await play(resolved({ source: "CACHE" }));
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await flush();
    expect(host.querySelector("[data-lesson-unavailable]")?.getAttribute("data-lesson-unavailable")).toBe("INCOMPATIBLE_VERSION");
  });
});

describe("cross-check native denial and keyless contract", () => {
  it.each(["REVOKED", "NOT_RELEASED", "NOT_STUDENT_READY"] as const)("native denial %s never requests legacy detail on either route", async (reason) => {
    const { default: Assigned } = await import("@/app/student/lessons/[id]/LessonDeliveryClient");
    for (const assigned of [false, true]) {
      serve({ [assigned ? "/api/student/lessons/work-123/experience" : "/api/student/lessons/fixture-levers-g6/experience"]: () => json(reason === "REVOKED" ? 410 : 404, { compatibility: "UNAVAILABLE", format: "NATIVE_V2", reason }) });
      await render(assigned ? <Assigned lessonId="work-123" /> : <LessonViewerClient enabledToolIds={[]} />);
      await flush();
      expect(host.querySelector("[data-lesson-unavailable]")?.getAttribute("data-lesson-unavailable")).toBe(reason);
      expect(host.querySelector("a")?.getAttribute("href")).toBe(assigned ? "/student/today" : "/student/learn");
      expect((fetch as any).mock.calls).toHaveLength(1);
      if (!assigned) expect(cache.removed).toContain(CONTENT.contentId);
      act(() => root?.unmount()); root = null;
    }
  });
  it("rejects keyed checks arriving from delivery rather than stripping their keys", () => {
    const d = runtimeLessonDelivery(6);
    const keyed = { ...d, scenes: d.scenes.map((scene) => scene.id === "check" ? { ...scene, interaction: { kind: "MULTIPLE_CHOICE", feedbackAuthority: "SERVER_REQUIRED", items: [{ id: "c1", prompt: "test", options: ["same", "same"], correctIndex: 0 }] } } : scene) };
    expect(resolveLessonDelivery(keyed)).toEqual({ kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" });
    expect(resolveLessonDelivery({ ...d, scenes: runtimeLessonExperience(6).scenes })).toEqual({ kind: "UNAVAILABLE", reason: "NOT_STUDENT_READY" });
  });
  it("500 errors never fall back to legacy, and exact versions are sent", async () => {
    serve({ "/api/student/lessons/fixture-levers-g6/experience": () => json(500, { compatibility: "UNAVAILABLE" }) });
    expect(await loadLessonDelivery(CONTENT, null, "1.0.0")).toEqual({ kind: "UNAVAILABLE", reason: "LOAD_FAILED" });
    expect((fetch as any).mock.calls[0][0]).toBe("/api/student/lessons/fixture-levers-g6/experience?kind=CONTENT&version=1.0.0");
  });
  it("route identities cannot be exchanged", async () => {
    serve({ "/api/student/lessons/work-123/experience": () => json(200, runtimeLessonDelivery(6)) });
    expect(await loadLessonDelivery(WORK)).toEqual({ kind: "UNAVAILABLE", reason: "INCOMPATIBLE_VERSION" });
  });
});

describe("X1 Today content-id legacy fallback", () => {
  const seam = "/api/student/lessons/fixture-levers-g6/experience";
  const legacyWork = "/api/student/work/fixture-levers-g6";
  const plain404 = () => json(404, { compatibility: "UNAVAILABLE", error: "UNAVAILABLE" });
  async function openTodayLink() {
    const { default: Assigned } = await import("@/app/student/lessons/[id]/LessonDeliveryClient");
    window.history.replaceState(null, "", "/student/lessons/fixture-levers-g6");
    await render(<Assigned lessonId="fixture-levers-g6" enabledToolIds={[]} />);
    await flush();
  }
  it("plain seam 404 follows the existing work API and renders the legacy Today lesson", async () => {
    serve({ [seam]: plain404, [legacyWork]: () => json(200, {
      id: "legacy-work", contentId: CONTENT.contentId, contentVersion: "1",
      title: "X1 synthetic legacy lesson", subject: "SCIENCE", grade: 6,
      teacherName: "Test teacher", classFormat: "standard", schoolName: "Test school",
      body: "X1 legacy instruction from Today.", bodyStandard: "X1 legacy instruction from Today.", bodyBlock: null,
      deliveryProfile: null, objectives: [], pseudoLabs: [], simulationDefinitions: [],
      status: "not_started", completedAt: null, takeawaySummary: null, problemSets: [],
    }) });
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    await openTodayLink();
    expect(host.textContent).toContain("X1 legacy instruction from Today.");
    expect(host.querySelector("[data-lesson-unavailable]")).toBeNull();
    expect(player()).toBeNull();
    expect((fetch as any).mock.calls.slice(0, 2).map(([url]) => url)).toEqual([`${seam}?kind=SCHEDULED_WORK`, legacyWork]);
  });
  it.each(["NOT_RELEASED", "REVOKED", "NOT_STUDENT_READY"] as const)("native denial %s never calls the legacy work API", async (reason) => {
    serve({ [seam]: () => json(reason === "REVOKED" ? 410 : 404, { compatibility: "UNAVAILABLE", format: "NATIVE_V2", reason }) });
    await openTodayLink();
    expect(host.querySelector("[data-lesson-unavailable]")?.getAttribute("data-lesson-unavailable")).toBe(reason);
    expect(host.querySelector("a")?.getAttribute("href")).toBe("/student/today");
    expect((fetch as any).mock.calls).toHaveLength(1);
  });
  it.each([
    [404, { reason: "NOT_RELEASED" }, "NOT_RELEASED"],
    [404, { reason: "REVOKED" }, "REVOKED"],
    [404, { reason: "NOT_STUDENT_READY" }, "NOT_STUDENT_READY"],
    [404, { reason: "INCOMPATIBLE_VERSION" }, "INCOMPATIBLE_VERSION"],
    [404, { error: "FORBIDDEN" }, "NOT_FOUND"],
    [409, { error: "INCOMPATIBLE_VERSION" }, "INCOMPATIBLE_VERSION"],
    [403, { error: "FORBIDDEN" }, "NOT_FOUND"],
    [500, { error: "UNAVAILABLE" }, "LOAD_FAILED"],
  ])("explicit denial/error %s %j never enters legacy delivery", async (status, body, reason) => {
    serve({ [seam]: () => json(status as number, body) });
    await openTodayLink();
    expect(host.querySelector("[data-lesson-unavailable]")?.getAttribute("data-lesson-unavailable")).toBe(reason);
    expect((fetch as any).mock.calls).toHaveLength(1);
    expect(player()).toBeNull();
  });
  it("a plain missing work reference cannot revive a native row rejected by the work API", async () => {
    serve({ [seam]: plain404, [legacyWork]: () => json(404, { error: "Lesson not found" }) });
    await openTodayLink();
    expect((fetch as any).mock.calls.map(([url]) => url)).toEqual([`${seam}?kind=SCHEDULED_WORK`, legacyWork]);
    expect(host.querySelector("[data-lesson-unavailable]")?.getAttribute("data-lesson-unavailable")).toBe("NOT_FOUND");
    expect(player()).toBeNull();
    expect(host.querySelector("a")?.getAttribute("href")).toBe("/student/today");
  });
});
