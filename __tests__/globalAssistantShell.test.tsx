import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockUsePathname = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

import GlobalAssistantShell, {
  buildExplainDifferentlyQuestion,
} from "@/components/rag/GlobalAssistantShell";
import { getAssistantRoleConfig } from "@/lib/ai/rag/assistantAccess";

describe("GlobalAssistantShell", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/teacher");
  });

  it("renders launcher button when closed", () => {
    const html = renderToStaticMarkup(
      <GlobalAssistantShell
        roleConfig={getAssistantRoleConfig("TEACHER")!}
        initialGrade={7}
        suggestedSubjects={["MATH", "SCIENCE"]}
      />
    );

    expect(html).toContain("Assistant");
    expect(html).not.toContain("AI Assistant");
    expect(html).not.toContain('placeholder="Ask about lessons, standards, policy, or planning"');
  });

  it("opens a compact panel instead of the oversized shell", () => {
    const html = renderToStaticMarkup(
      <GlobalAssistantShell
        roleConfig={getAssistantRoleConfig("TEACHER")!}
        initialGrade={7}
        suggestedSubjects={["MATH", "SCIENCE"]}
        initialOpen
      />
    );

    expect(html).toContain("max-h-[70vh]");
    expect(html).toContain("max-w-md");
    expect(html).toContain('placeholder="Subject"');
    expect(html).toContain('placeholder="Grade"');
    expect(html).toContain(">policy<");
    expect(html).toContain(">mixed<");
  });

  it("hides arbitrary grade and mode controls for students", () => {
    const html = renderToStaticMarkup(
      <GlobalAssistantShell
        roleConfig={getAssistantRoleConfig("STUDENT")!}
        initialGrade={7}
        suggestedSubjects={["MATH", "SCIENCE"]}
        initialOpen
      />
    );

    expect(html).not.toContain('placeholder="Grade"');
    expect(html).not.toContain(">policy<");
    expect(html).not.toContain(">mixed<");
    expect(html).toContain("Grade:</span> 7");
    expect(html).toContain(">MATH<");
  });

  it("shows mode label based on pathname and renders guardian-safe scope controls", () => {
    mockUsePathname.mockReturnValue("/guardian/messages");

    const html = renderToStaticMarkup(
      <GlobalAssistantShell
        roleConfig={getAssistantRoleConfig("GUARDIAN")!}
        initialGrade={7}
        suggestedSubjects={["MATH"]}
        guardianLearners={[
          {
            id: "student-1",
            label: "Martha Doe",
            grade: 7,
            subjects: ["MATH", "SCIENCE"],
          },
          {
            id: "student-2",
            label: "Samuel Doe",
            grade: 5,
            subjects: ["LITERACY"],
          },
        ]}
        initialOpen
      />
    );

    expect(html).not.toContain('placeholder="Grade"');
    expect(html).not.toContain('placeholder="Subject"');
    expect(html).toContain("Student");
    expect(html).toContain("Martha Doe");
    expect(html).toContain("Samuel Doe");
    expect(html).toContain("Grade:</span> 7");
    expect(html).toContain("Support");
  });

  it("shows weak grounding messaging, source badges, and action buttons", () => {
    const html = renderToStaticMarkup(
      <GlobalAssistantShell
        roleConfig={getAssistantRoleConfig("TEACHER")!}
        initialGrade={7}
        suggestedSubjects={["MATH", "SCIENCE"]}
        initialOpen
        initialMessages={[
          {
            id: "message-1",
            question: "Explain fractions",
            result: {
              answer: "Fractions describe equal parts of a whole.",
              retrievalWeak: true,
              hadFallback: true,
              isWeakGrounding: true,
              actions: [
                {
                  type: "GENERATE_ASSIGNMENT",
                  label: "Generate Assignment",
                  payload: {
                    question: "Explain fractions",
                    subject: "MATH",
                    gradeLevel: "7",
                    contextMode: "lesson",
                  },
                },
                {
                  type: "FIX_LESSON",
                  label: "Fix Lesson",
                  payload: {
                    question: "Explain fractions",
                    subject: "MATH",
                    gradeLevel: "7",
                    contextMode: "lesson",
                  },
                },
              ],
              sources: [
                {
                  id: "source-1",
                  title: "Fractions Unit",
                  excerpt: "Equal parts of a whole.",
                  sourceType: "curriculum",
                  sourceLabel: "teacher-fractions",
                  similarity: 0.82,
                  groundingStrength: "weak",
                },
                {
                  id: "source-2",
                  title: "Practice Lesson",
                  excerpt: "Homework follow-up.",
                  sourceType: "lesson",
                  sourceLabel: "week-2",
                  similarity: 0.79,
                },
                {
                  id: "source-3",
                  title: "Grade 7 Standard",
                  excerpt: "Benchmark outcome.",
                  sourceType: "standard",
                  sourceLabel: "math-standard",
                  similarity: 0.76,
                },
                {
                  id: "source-4",
                  title: "Security Policy",
                  excerpt: "Governance reference.",
                  sourceType: "policy",
                  sourceLabel: "docs/security",
                  similarity: 0.74,
                },
              ],
            },
          },
        ]}
      />
    );

    expect(html).toContain("Limited curriculum grounding");
    expect(html).toContain("📘 Curriculum");
    expect(html).toContain("📗 Lesson");
    expect(html).toContain("📊 Standard");
    expect(html).toContain("📄 Policy");
    expect(html).toContain("Generate Assignment");
    expect(html).toContain("Fix Lesson");
  });

  it("renders inline confirmation UI for confirmation-required actions", () => {
    const action = {
      type: "SUGGEST_INTERVENTION" as const,
      label: "Suggest Intervention",
      payload: {
        question: "How should we respond to weak mastery?",
        subject: "MATH",
        gradeLevel: "7",
        contextMode: "governance" as const,
      },
      requiresConfirmation: true,
    };

    const html = renderToStaticMarkup(
      <GlobalAssistantShell
        roleConfig={getAssistantRoleConfig("ADMIN")!}
        initialGrade={7}
        suggestedSubjects={["MATH"]}
        initialOpen
        initialMessages={[
          {
            id: "message-2",
            question: "How should we respond to weak mastery?",
            result: {
              answer: "Use a targeted intervention cycle.",
              retrievalWeak: false,
              hadFallback: false,
              isWeakGrounding: false,
              actions: [action],
              sources: [],
            },
          },
        ]}
        initialPendingConfirmation={{
          messageId: "message-2",
          action,
        }}
      />
    );

    expect(html).toContain("Confirm Suggest Intervention?");
    expect(html).toContain(">Confirm<");
    expect(html).toContain(">Cancel<");
  });

  it("builds the explain-differently follow-up prompt", () => {
    expect(
      buildExplainDifferentlyQuestion({
        type: "EXPLAIN_DIFFERENTLY",
        label: "Explain Differently",
        payload: {
          question: "Explain fractions",
          subject: "MATH",
          gradeLevel: "7",
          contextMode: "learning",
        },
      })
    ).toBe("Explain this differently: Explain fractions");
  });
});
