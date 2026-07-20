import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "fs";
import path from "path";

vi.mock("@/lib/ai/router", () => ({ routedCompletion: vi.fn() }));

const ROOT = path.resolve(__dirname, "..");
const p = (...segments: string[]) => path.join(ROOT, ...segments);

describe("Tutor Architecture Consolidation — deprecated paths are removed, not just unreached", () => {
  it("removes the deprecated /api/ai/chat route and its TutorAgent backend", () => {
    expect(existsSync(p("app", "api", "ai", "chat", "route.ts"))).toBe(false);
    expect(existsSync(p("lib", "ai", "tutor-agent.ts"))).toBe(false);
    expect(existsSync(p("components", "AiTutorChat.tsx"))).toBe(false);
  });

  it("removes the deprecated /api/student/tutor/[contentId]/chat + history routes and the widget that called them", () => {
    expect(
      existsSync(p("app", "api", "student", "tutor", "[contentId]", "chat", "route.ts"))
    ).toBe(false);
    expect(
      existsSync(p("app", "api", "student", "tutor", "[contentId]", "history", "route.ts"))
    ).toBe(false);
    expect(existsSync(p("components", "TutorChatWidget.tsx"))).toBe(false);
  });

  it("removes answerStudentQuestion (and its dedicated prompt builders) from studentTutor.ts while keeping getStudentTutorResponse", async () => {
    const studentTutor = await import("@/lib/ai/tutor/studentTutor");
    expect((studentTutor as Record<string, unknown>).answerStudentQuestion).toBeUndefined();
    expect(typeof studentTutor.getStudentTutorResponse).toBe("function");
    expect(typeof studentTutor.isValidRequestType).toBe("function");

    const source = readFileSync(p("lib", "ai", "tutor", "studentTutor.ts"), "utf8");
    expect(source).not.toContain("buildChatSystemPrompt");
    expect(source).not.toContain("buildRagSystemPrompt");
    expect(source).not.toContain("loadStudentChatContext");
  });

  it("old /ai-tutor route redirects into the real grounded page instead of rendering its own chat UI", () => {
    const source = readFileSync(p("app", "ai-tutor", "page.tsx"), "utf8");
    expect(source).toContain('redirect("/student/ai-tutor")');
    expect(source).not.toContain("AiTutorChat");
  });

  it("the nav-visible AI Tutor link points at the consolidated /student/ai-tutor page", () => {
    const source = readFileSync(p("components", "StudentSidebar.tsx"), "utf8");
    expect(source).toContain('href="/student/ai-tutor"');
    expect(source).not.toContain('href="/ai-tutor"');
  });

  it("the new /student/ai-tutor page exists inside the student layout tree and requires STUDENT role", () => {
    expect(existsSync(p("app", "student", "ai-tutor", "page.tsx"))).toBe(true);
    const source = readFileSync(p("app", "student", "ai-tutor", "page.tsx"), "utf8");
    expect(source).toContain('requireRole("STUDENT")');
  });

  it("LessonDeliveryClient no longer mounts the deprecated per-lesson chat widget", () => {
    const source = readFileSync(
      p("app", "student", "lessons", "[id]", "LessonDeliveryClient.tsx"),
      "utf8"
    );
    expect(source).not.toContain("TutorChatWidget");
  });
});
