// @vitest-environment jsdom
// Student Experience V3 P1: Read mode as a playlist (one authored section on the stage at a time), the phone
// Contents drawer, the in-place tutor button and teaching-lesson gating. Presentation only: no request,
// no evidence, no completion.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { LegacyReading, LegacySlides } from "@/components/experience/LegacyLesson";
import { AskTutorButton, OPEN_TUTOR_EVENT } from "@/components/experience/AskTutorButton";
import { TeachingLessonPlayer } from "@/components/experience/teaching/TeachingLessonPlayer";
import { GRADE7_PLACE_VALUE } from "@/lib/learner-experience/teaching/demoLessons";
import { teachingLessonAvailability } from "@/lib/learner-experience/teaching/contract";
import { parseLessonBlocks, slideBlocks, splitLessonSections } from "@/lib/learner-experience/lessonText";

let root: Root | null = null;
let host: HTMLDivElement;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.scrollTo = vi.fn() as never;
  Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => { push.mockReset(); window.sessionStorage.clear(); window.history.replaceState(null, "", "/student/lesson/c1"); host = document.createElement("div"); document.body.appendChild(host); });
afterEach(() => { act(() => root?.unmount()); root = null; host.remove(); });

const render = async (node: React.ReactNode) => { await act(async () => { root = createRoot(host); root.render(node); }); };
const click = async (element: Element | null | undefined) => { expect(element).toBeTruthy(); await act(async () => { (element as HTMLElement).click(); }); };
const visibleSections = () => [...host.querySelectorAll<HTMLElement>("[data-read-section]")].filter((section) => !section.hidden);
const railButton = (n: number) => host.querySelectorAll(".ll4-read-rail button")[n - 1];

const body = Array.from({ length: 20 }, (_, index) => `## Part ${index + 1}\n\nText of part ${index + 1}.`).join("\n\n");
const sections = splitLessonSections(parseLessonBlocks(body), "Long lesson");

describe("Read mode playlist", () => {
  it("shows only the selected section; choosing an entry replaces the stage and updates the address", async () => {
    await render(<LegacyReading title="Long lesson" sections={sections} storageKey="c1" after={<label>Notes <input data-final-input /></label>} />);
    expect(sections).toHaveLength(20);
    expect(visibleSections().map((section) => section.dataset.readSection)).toEqual(["part-1"]);
    expect(host.querySelectorAll(".ll4-read-rail button")).toHaveLength(20);
    await click(railButton(17));
    expect(visibleSections().map((section) => section.dataset.readSection)).toEqual(["part-17"]);
    expect(new URL(window.location.href).searchParams.get("section")).toBe("part-17");
    expect(window.sessionStorage.getItem("ll-read-section:c1")).toBe("part-17");
    expect(document.activeElement?.id).toBe("part-17-h");
    expect(railButton(17).getAttribute("aria-current")).toBe("true");
    // Every section stays mounted (hidden), so nothing is lost by switching.
    expect(host.querySelectorAll("[data-read-section]")).toHaveLength(20);
  });

  it("Previous / Next move one section; the final hand-off shows only with the last section and keeps its input", async () => {
    await render(<LegacyReading title="Long lesson" sections={sections} storageKey="c1" after={<label>Notes <input data-final-input /></label>} />);
    const final = () => host.querySelector<HTMLElement>("[data-read-final]")!;
    expect(final().hidden).toBe(true);
    await click(railButton(20));
    expect(final().hidden).toBe(false);
    const input = host.querySelector<HTMLInputElement>("[data-final-input]")!;
    input.value = "kept";
    await click([...host.querySelectorAll(".ll4-read-pager button")][0]);
    expect(visibleSections()[0].dataset.readSection).toBe("part-19");
    expect(final().hidden).toBe(true);
    await click([...host.querySelectorAll(".ll4-read-pager button")][1]);
    expect(host.querySelector<HTMLInputElement>("[data-final-input]")!.value).toBe("kept");
  });

  it("opens a deep-linked section and follows browser Back/Forward", async () => {
    window.history.replaceState(null, "", "/student/lesson/c1?section=part-17");
    await render(<LegacyReading title="Long lesson" sections={sections} storageKey="c1" />);
    expect(visibleSections()[0].dataset.readSection).toBe("part-17");
    await click(railButton(18));
    window.history.replaceState(null, "", "/student/lesson/c1?section=part-17");
    await act(async () => { window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(visibleSections()[0].dataset.readSection).toBe("part-17");
  });

  it("resumes the last section read in this tab when the address names none", async () => {
    window.sessionStorage.setItem("ll-read-section:c1", "part-9");
    await render(<LegacyReading title="Long lesson" sections={sections} storageKey="c1" />);
    expect(visibleSections()[0].dataset.readSection).toBe("part-9");
  });

  it("the phone Contents drawer is a labelled dialog that closes on choosing a section", async () => {
    await render(<LegacyReading title="Long lesson" sections={sections} storageKey="c1" />);
    await click(host.querySelector(".ll4-read-drawer .ll4-drawer-trigger"));
    const dialog = host.querySelector("[role=dialog]")!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.querySelectorAll("button[aria-current]")).toHaveLength(1);
    await click(dialog.querySelectorAll(".ll4-drawer-list button")[4]);
    expect(host.querySelector("[role=dialog]")).toBeNull();
    expect(visibleSections()[0].dataset.readSection).toBe("part-5");
  });
});

describe("Legacy slides", () => {
  it("labels teacher notes from headings and lets the learner skip them without removing anything", async () => {
    const md = "## Objective\n\nRead big numbers.\n\n## Teacher Explanation\n\nThe teacher models.\n\n## Guided Practice\n\nTry 2,350,480 with a partner.";
    const slides = ["Objective", "Teacher Explanation", "Guided Practice"].map((title) => ({ title, blocks: slideBlocks(title, md.split(`## ${title}`)[1].split("##")[0]) }));
    let index = 0;
    const setIndex = (next: number) => { index = next; void rerender(); };
    const rerender = async () => { await act(async () => { root!.render(<LegacySlides slides={slides} index={index} onIndexChange={setIndex} subject="MATHEMATICS" />); }); };
    await render(<LegacySlides slides={slides} index={0} onIndexChange={setIndex} subject="MATHEMATICS" />);
    const skip = [...host.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Skip notes for teachers"))!;
    await click(skip);
    await click([...host.querySelectorAll("button")].find((button) => button.textContent?.trim().startsWith("Next")));
    expect(index).toBe(2);
    expect(host.textContent).toContain("Guided Practice");
    expect(host.querySelector("[data-number-lens]")).toBeTruthy();
    expect(host.textContent).toContain("two million, three hundred fifty thousand, four hundred eighty");
  });
});

describe("Ask the tutor in place", () => {
  it("opens the tutor shell when it answers, otherwise goes to the tutor page", async () => {
    await render(<AskTutorButton />);
    await click(host.querySelector("button"));
    expect(push).toHaveBeenCalledWith("/student/ai-tutor");
    push.mockReset();
    const answer = (event: Event) => { (event as CustomEvent<{ handled: boolean }>).detail.handled = true; };
    window.addEventListener(OPEN_TUTOR_EVENT, answer);
    await click(host.querySelector("button"));
    window.removeEventListener(OPEN_TUTOR_EVENT, answer);
    expect(push).not.toHaveBeenCalled();
  });
});

describe("Teaching lesson player", () => {
  it("labels DEMO, gates Continue on the digit cards and explains a reversed placement", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await render(<TeachingLessonPlayer lesson={GRADE7_PLACE_VALUE} availability={teachingLessonAvailability(GRADE7_PLACE_VALUE, () => null)} initialSceneId="digits" />);
    expect(host.textContent).toContain("DEMO · not a released lesson");
    const cont = () => [...host.querySelectorAll("footer button")].pop() as HTMLButtonElement;
    expect(cont().disabled).toBe(true);
    // Place the cards in reverse order of the target's digits.
    const target = [5, 0, 4, 0, 0, 0, 9].reverse();
    for (let place = 0; place < 7; place++) {
      const card = [...host.querySelectorAll<HTMLButtonElement>(".ll4-digit-card")].find((button) => !button.disabled && button.textContent === String(target[place]))!;
      await click(card);
      await click(host.querySelectorAll(".ll4-slot")[place]);
    }
    expect(host.textContent).toMatch(/reverse order/);
    expect(cont().disabled).toBe(true);
    await click([...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Clear the places")));
    const right = [5, 0, 4, 0, 0, 0, 9];
    for (let place = 0; place < 7; place++) {
      const card = [...host.querySelectorAll<HTMLButtonElement>(".ll4-digit-card")].find((button) => !button.disabled && button.textContent === String(right[place]))!;
      await click(card);
      await click(host.querySelectorAll(".ll4-slot")[place]);
    }
    expect(host.textContent).toMatch(/You made 5,040,009/);
    expect(cont().disabled).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
