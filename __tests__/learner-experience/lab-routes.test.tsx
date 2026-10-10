// @vitest-environment jsdom
// Route migration: one Labs namespace, compatibility redirect, and draft labs never reach real students.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

const redirect = vi.hoisted(() => vi.fn((href: string) => { throw new Error(`REDIRECT:${href}`); }));
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NOT_FOUND"); }));
vi.mock("next/navigation", () => ({ redirect, notFound, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(async () => ({ id: "user-a", role: "STUDENT", schoolId: "school-a" })) }));
vi.mock("@/lib/db", () => ({ prisma: { labSession: { findFirst: vi.fn(async () => null) }, virtualLab: { findUnique: vi.fn(async () => null) } } }));
vi.mock("@/lib/student/labEligibility", () => ({ loadAuthorizedPracticalSessions: vi.fn(async () => []) }));

import InteractiveLabRedirect from "@/app/student/interactive-labs/[labId]/page";
import StudentLabDetailPage from "@/app/student/labs/[labId]/page";
import LessonExperiencePrototypePage from "@/app/lab-review/experience/[experienceId]/page";
import { InteractiveLabPlayer } from "@/components/interactive-labs/v2/InteractiveLabPlayer";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
});

describe("lab route migration", () => {
  it("redirects /student/interactive-labs/[labId] to the unified /student/labs/[labId]", () => {
    expect(() => InteractiveLabRedirect({ params: { labId: "g4-solid-figures" } })).toThrow("REDIRECT:/student/labs/g4-solid-figures");
  });

  it("the unified route refuses a DRAFT interactive lab (Mount Coffee stays student-inaccessible)", async () => {
    const markup = renderToStaticMarkup(await StudentLabDetailPage({ params: { labId: "mount-coffee-hydropower" } }));
    expect(markup).toContain("This lab is not available.");
  });

  it("legacy practical-lab behaviour is unchanged for other ids", async () => {
    const markup = renderToStaticMarkup(await StudentLabDetailPage({ params: { labId: "lab-sci-1" } }));
    expect(markup).toContain("No lab session was found for this assignment.");
  });

  it("the interactive player still refuses unapproved labs unless a host opts into internal preview", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => { root.render(<InteractiveLabPlayer labId="mount-coffee-hydropower" />); });
    expect(host.textContent).toContain("This lab is not available.");
    await act(async () => { root.render(<InteractiveLabPlayer labId="mount-coffee-hydropower" internalPreview />); });
    expect(host.textContent).toContain("Mount Coffee hydropower");
    expect(host.textContent).not.toContain("This lab is not available.");
    act(() => root.unmount());
  });

  it("the internal prototype route 404s in production and without the review harness", () => {
    const saved = { ...process.env };
    try {
      process.env.LAB_REVIEW_HARNESS = "1";
      (process.env as Record<string, string>).NODE_ENV = "production";
      expect(() => LessonExperiencePrototypePage({ params: { experienceId: "proto-g8-hydroelectric-power" }, searchParams: {} })).toThrow("NOT_FOUND");
      (process.env as Record<string, string>).NODE_ENV = "development";
      delete process.env.LAB_REVIEW_HARNESS;
      expect(() => LessonExperiencePrototypePage({ params: { experienceId: "proto-g8-hydroelectric-power" }, searchParams: {} })).toThrow("NOT_FOUND");
    } finally {
      process.env = saved;
    }
  });
});
