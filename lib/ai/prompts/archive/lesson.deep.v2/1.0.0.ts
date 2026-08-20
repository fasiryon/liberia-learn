import { createHash } from "crypto";

export const lessonDeepV2Archive = Object.freeze({
  key: "lesson.deep.v2",
  version: "1.0.0",
  createdAt: "2026-08-13T00:00:00.000Z",
  approvedDynamic: true,
});

export function buildArchivedPass1System(
  grade: number,
  subject: string,
  moeAlignmentCodes?: string[],
): string {
  const moeHint = moeAlignmentCodes?.length
    ? `Address MOE standards: ${moeAlignmentCodes.join(", ")}.`
    : "";
  return `You are an expert Liberian teacher writing a complete classroom lesson for Grade ${grade} ${subject}.
Write the FULL lesson body as Markdown prose. Do NOT write JSON. Write the actual teaching content.
Use Liberian context throughout: names (Boima, Fatu, Pewee, Kpaan, Finda, Gbanyan), places (Monrovia, Nimba, Bong, Lofa, Waterside Market), foods (cassava, palm oil, rice, mangoes), currency (LD$ and US$).
${moeHint}
Rules:
- Minimum word count per section is stated in the template. Write to the floor â€” do not truncate.
- Show EVERY STEP of every worked example with all arithmetic visible.
- Never describe what a section will contain â€” write the actual content immediately.
- For sections with [STUDENT_PROBLEM_START:id] markers, follow the exact marker format shown.
- Every practice problem must include the complete worked answer inside [ANSWER_START:id]...[ANSWER_END:id] markers.`;
}

export function buildArchivedPass1User(
  grade: number,
  subject: string,
  topic: string,
): string {
  return `Write a complete Grade ${grade} ${subject} lesson on: "${topic}"

Use exactly these 17 sections with ## headings:

## 1. Hook â€” The Real-World Challenge (300+ words)
A vivid, complete story from Liberian life. Full narrative â€” do not describe, write it.
Name people (Boima, Fatu, Pewee, Kpaan, Finda, Gbanyan), places (Monrovia, Nimba, Bong, Lofa),
foods (cassava, palm oil, rice, mangoes), currency (LD$ and US$).
End with a question students want to answer.

## 2. Learning Objectives (150+ words)
"Learning Objective:" label. 3 measurable objectives (calculate/explain/identify/apply/compare/prove).
WHY this matters for real life in Liberia + future careers.

## 3. Prior Knowledge Activation (200+ words)
3 warm-up problems, fully stated, numbered 1-3. Each followed by "Answer:" with complete solution.

## 4. Core Concept â€” Concrete Foundation (400+ words)
"Introduction:" label. Concept in physical/tangible Liberian context.
Full explanation speaking directly to student. One complete concrete example.
Define every new term on first use.

## 5. Core Concept â€” The Rule and Why It Works (300+ words)
State the abstract rule/formula/principle.
Explain WHY it works in plain language. Connect to Section 4's concrete example.
"Can you see why this always works?"

## 6. Key Vocabulary (200+ words)
Every new term: (a) definition, (b) full example sentence in Liberian context, (c) memory tip.

## 7. Worked Example 1 â€” Standard Method (300+ words)
Full problem statement. EVERY step shown and labelled. Liberian names/LD$.
"What do you notice about this method?" + expected student observation.
"Try this yourself: [a similar problem, fully stated]"

## 8. Worked Example 2 â€” Alternative Method (300+ words)
Same problem type, different method (visual/shortcut/algebraic).
"Method 1 took X steps. Method 2 took Y steps. Method 2 is faster when..."

## 9. Error Analysis (250+ words)
"Common Error:" label. 3 specific wrong answers students commonly produce.
For each: WHY this error happens, correct working side-by-side, one-sentence rule to prevent it.

## 10. Guided Practice â€” Problem 1 (200+ words)
[STUDENT_PROBLEM_START:gp1]
Full problem statement only. No solution visible to student.
[STUDENT_PROBLEM_END:gp1]
[ANSWER_START:gp1]
Complete step-by-step solution with every step shown.
[ANSWER_END:gp1]

## 11. Guided Practice â€” Problem 2 (200+ words)
[STUDENT_PROBLEM_START:gp2]
Full problem statement only.
[STUDENT_PROBLEM_END:gp2]
[ANSWER_START:gp2]
Complete solution, slightly harder than Problem 1.
[ANSWER_END:gp2]

## 12. Guided Practice â€” Problem 3 (200+ words)
[STUDENT_PROBLEM_START:gp3]
Full problem combining two ideas from this lesson.
[STUDENT_PROBLEM_END:gp3]
[ANSWER_START:gp3]
Complete solution explaining why both ideas are needed.
[ANSWER_END:gp3]

## 13. Independent Practice â€” Tier 1 (150+ words)
[STUDENT_PROBLEM_START:ip1a]
Problem 1 statement.
[STUDENT_PROBLEM_END:ip1a]
[ANSWER_START:ip1a]
Answer 1.
[ANSWER_END:ip1a]
[STUDENT_PROBLEM_START:ip1b]
Problem 2 statement.
[STUDENT_PROBLEM_END:ip1b]
[ANSWER_START:ip1b]
Answer 2.
[ANSWER_END:ip1b]

## 14. Independent Practice â€” Tier 2 Standard (150+ words)
[STUDENT_PROBLEM_START:ip2a]
Problem 1 statement.
[STUDENT_PROBLEM_END:ip2a]
[ANSWER_START:ip2a]
Answer 1.
[ANSWER_END:ip2a]
[STUDENT_PROBLEM_START:ip2b]
Problem 2 statement.
[STUDENT_PROBLEM_END:ip2b]
[ANSWER_START:ip2b]
Answer 2.
[ANSWER_END:ip2b]

## 15. Independent Practice â€” Tier 3 Advanced (150+ words)
[STUDENT_PROBLEM_START:ip3a]
Problem 1 statement.
[STUDENT_PROBLEM_END:ip3a]
[ANSWER_START:ip3a]
Answer 1.
[ANSWER_END:ip3a]
[STUDENT_PROBLEM_START:ip3b]
Problem 2 statement.
[STUDENT_PROBLEM_END:ip3b]
[ANSWER_START:ip3b]
Answer 2.
[ANSWER_END:ip3b]

## 16. Group Discussion (150+ words)
Full discussion prompt. 4-5 key points students should arrive at.
Cross-curricular connection to Liberian context.

## 17. Assessment, Exit Ticket, and Lesson Summary (200+ words)
"Assessment:" label. 2 exit ticket questions fully stated.
Key Takeaways:
- [3-5 actual bullets summarising what was learned â€” NOT copied from body, written fresh]
"In the next lesson, we will..."

TOTAL MINIMUM: 3,500 words. Start writing immediately. Begin with ## 1.`;
}

export function buildArchivedPass2User(bodySlice: string): string {
  return `Lesson content:
---
${bodySlice}
---

Return ONLY this JSON (no other text):
{
  "title": "[descriptive lesson title, max 80 chars]",
  "learningObjectives": ["[objective 1 from Learning Objectives section]", "[objective 2]", "[objective 3]"],
  "assessmentQuestions": [
    {"question": "[from Assessment/Exit Ticket section]", "answer": "[expected answer]", "choices": null},
    {"question": "[second question]", "answer": "[expected answer]", "choices": null}
  ]
}`;
}

export function buildArchivedExpansionUser(
  groupLabel: string,
  currentText: string,
  targetWords: number,
  grade: number,
  subject: string,
  topic: string,
): string {
  const currentWords = currentText.trim().split(/\s+/).filter(Boolean).length;
  return `You are expanding a section of a Grade ${grade} ${subject} lesson on "${topic}".

The section "${groupLabel}" is currently ${currentWords} words but needs at least ${targetWords} words.

Current content:
---
${currentText}
---

Rewrite this section to be at least ${targetWords} words by:
- Adding more detail to every explanation
- Expanding each worked example to show every arithmetic step
- Adding more checks for student understanding
- Using more Liberian context (names: Boima, Fatu, Pewee; places: Monrovia, Nimba; currency: LD$)

IMPORTANT:
- Do NOT change the section topic
- Preserve any [STUDENT_PROBLEM_START/END:id] and [ANSWER_START/END:id] markers exactly
- Keep the ## heading(s) at the top
- Return ONLY the expanded section text, nothing else`;
}

export const lessonDeepV2PromptHash = createHash("sha256")
  .update(
    [
      buildArchivedPass1System(0, "{{subject}}", ["{{alignment}}"]),
      buildArchivedPass1User(0, "{{subject}}", "{{topic}}"),
      buildArchivedExpansionUser(
        "{{group}}",
        "{{currentText}}",
        0,
        0,
        "{{subject}}",
        "{{topic}}",
      ),
      buildArchivedPass2User("{{body}}"),
    ].join("\n"),
    "utf8",
  )
  .digest("hex");
