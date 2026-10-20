// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextbookReader } from "@/components/textbooks/TextbookReader";
import { LegacyReading } from "@/components/experience/LegacyLesson";
import { parseLessonBlocks, splitLessonSections } from "@/lib/learner-experience/lessonText";
import type { ReadingBook } from "@/components/textbooks/model";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRole: async () => ({ id: "reader", schoolId: "school", role: "STUDENT" }) }));
vi.mock("@/lib/db", () => ({ prisma: { student: { findUnique: async () => ({ currentGrade: 7, deletedAt: null, user: { schoolId: "school" } }) } } }));
vi.mock("@/lib/student/learnDiscovery.server", () => ({ listAuthorizedLearnerContent: mocks.list }));
import Shelf from "@/app/student/textbooks/page";

afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });
describe("reviewed reader regressions", () => {
  it("retains a single authored heading without adding a fallback heading", () => {
    const reading = (body: string) => renderToStaticMarkup(<LegacyReading title="Lesson title" sections={splitLessonSections(parseLessonBlocks(body), "Lesson title")} />);
    expect(reading("## Opening\n\nThe learner's text.")).toMatch(/<h2[^>]*>Opening<\/h2>/);
    expect(reading("The learner's text.")).not.toContain("<h2");
  });
  it("uses an authorized payload title when the shelf row title is absent", async () => {
    mocks.list.mockResolvedValue([{ contentId: "one", title: null, payload: { title: "Authored reading title" }, subject: "MATH", grade: 7, contentType: "lesson" }]);
    expect(renderToStaticMarkup(await Shelf())).toContain("Authored reading title");
  });
  it("cannot bookmark an empty reading and drops bookmarks when its pages disappear", async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host);
    const book: ReadingBook = { id: "edge", version: "1", title: "Authorized reading", grade: 7, subject: "MATH", source: "authorized-reading", pages: [{ chapter: "First", title: "First page", body: "Original text" }] };
    const button = (label: string) => [...host.querySelectorAll("button")].find(b => b.textContent?.trim() === label)!;
    try {
      await act(async () => root.render(<TextbookReader book={book} persistenceScope="school:reader" />));
      await act(async () => button("Bookmark").click());
      expect(button("Bookmarked")).toBeDefined();
      await act(async () => button("Contents").click());
      const bookmarks = [...host.querySelectorAll("button")].find(b => b.textContent?.startsWith("Bookmarks"))!;
      await act(async () => bookmarks.click());
      expect(host.querySelector('nav[aria-label="Bookmarks"]')?.textContent).toContain("First page");
      await act(async () => root.render(<TextbookReader book={{ ...book, pages: [] }} persistenceScope="school:reader" />));
      expect(button("Bookmark").disabled).toBe(true);
      await act(async () => button("Bookmark").click());
      expect(host.textContent).toContain("Reading content unavailable");
      expect(host.querySelector('nav[aria-label="Bookmarks"]')?.textContent).toBe("");
    } finally { await act(async () => root.unmount()); host.remove(); }
  });
});
