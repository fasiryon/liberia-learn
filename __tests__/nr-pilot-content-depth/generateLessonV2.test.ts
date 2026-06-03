import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RouterOptions } from "@/lib/ai/routedCompletion";

// Mock routedCompletion
vi.mock("@/lib/ai/router", () => ({
  routedCompletion: vi.fn(),
}));

import { routedCompletion } from "@/lib/ai/router";
import { generateLessonV2 } from "@/lib/curriculum/generateLessonV2";

// 2000-word padding used by expansion mock to make thin sections pass all floors.
const EXPANSION_PAD = Array(200)
  .fill(
    "Boima studied mathematics in Monrovia and learned that every step of the borrowing method must be shown clearly " +
    "so students in Liberia can check their work accurately at Waterside Market or in classrooms across Nimba County."
  )
  .join(" ");

const MOCK_BODY = `## 1. Hook — The Real-World Challenge
Boima walked to Waterside Market in Monrovia with 847 LD in his pocket. He needed to buy cassava for LD 593.
How much change would he receive? This is a real problem every Liberian child faces daily. Every morning, children
across Nimba County, Bong County, and Lofa County go to local markets with their parents and must quickly calculate
change. If you cannot subtract correctly, a dishonest seller might give you less money back. Learning to subtract with
borrowing is not just a school skill — it is a survival skill in Liberian markets, from Waterside in Monrovia to the
market in Voinjama. Today you will master this skill so you can always check your change. Fatu's mother runs a small
shop near the St. Paul River. She sells palm oil, cassava, and mangoes. Every day she must calculate the change for
dozens of customers. She taught Fatu: "Always check your change before you leave the stall." How does Fatu do this so
quickly? She uses the borrowing method for subtraction, which is exactly what you will learn in this lesson. The
borrowing method, also called regrouping, is the foundation of all multi-digit subtraction. Once you understand it,
you can subtract any numbers quickly and accurately, whether you are checking change at Waterside Market, calculating
the remaining bags of rice in a warehouse in Buchanan, or determining how many students attended school this week in
a district office in Gbarnga, Bong County.

## 2. Learning Objectives
Learning Objective: Students will calculate subtraction with borrowing.
This skill is essential for managing money in Liberian markets. By the end of this lesson, students will be able to:
1. Calculate multi-digit subtraction problems using the standard borrowing method, correctly regrouping tens and hundreds
   as needed, including problems with zeros in the top number such as 1000 - 437.
2. Explain why the borrowing method works by connecting the process to the value of tens and hundreds in our place value
   system, and articulate this explanation in their own words using Liberian market examples.
3. Apply subtraction with borrowing to real-world money problems involving Liberian dollars (LD$), including calculating
   change, finding the difference between two prices, and solving two-step problems that combine addition and subtraction.
This matters for careers in accounting, market trading, banking, and any profession involving numbers and money in Liberia.

## 3. Prior Knowledge Activation
These three problems will warm up your subtraction skills before we tackle the borrowing method today.
1. What is 50 - 20? Think about this: if Pewee had 50 LD and spent 20 LD on rice, how much would remain?
Answer: 30. We subtract 2 tens from 5 tens. 5 - 2 = 3, so 50 - 20 = 30 LD remaining.
2. What is 100 - 45? Kpaan has 100 LD and buys mangoes for 45 LD at the Monrovia market.
Answer: 55. 100 - 45 = 55 LD remaining. We will learn today why this requires borrowing.
3. What is 200 - 73? Gbanyan's family harvested 200 bags of cassava and sold 73 at the market in Bong County.
Answer: 127. 200 - 73 = 127 bags remaining after the sale. This also uses the borrowing method.

## 4. Core Concept — Concrete Foundation
Introduction: Subtraction means taking away one quantity from another to find the difference. In the Liberian market,
subtraction happens constantly. If Fatu has 100 LD and spends 35 LD on palm oil from the market stall near Waterside,
she has 65 LD left. The term "difference" means the result of subtraction. The difference between 100 and 35 is 65.
But what happens when the digit we are subtracting is larger than the digit above it? Imagine Boima has 847 LD and
needs to subtract 593 LD. In the ones column: 7 - 3 = 4. Easy. In the tens column: 4 - 9. We cannot take 9 from 4
without getting a negative number. This is when we must borrow. Borrowing means we take one group of ten from the
tens column and add it to the ones column, giving us 10 extra ones. So 4 tens becomes 3 tens, and the ones column
goes from 7 to 17. Now 17 - 9 = 8. The term "regroup" describes this same process — we are reorganising the number
to make subtraction possible without creating negative digits.

## 5. Core Concept — The Rule and Why It Works
The borrowing rule: when the top digit in a column is smaller than the bottom digit, we borrow 1 unit from the column
to the left. That 1 unit equals 10 in the current column. This works because our number system is base 10 — each
column is worth 10 times the column to its right. One ten equals ten ones. One hundred equals ten tens. So when we
borrow 1 ten, we are simply exchanging it for 10 ones — the total value of the number does not change. Connect back
to Section 4: in 847 - 593, the tens digit 4 was too small to subtract 9. We borrowed 1 hundred (worth 10 tens) from
the hundreds column, making the tens column 14. 14 - 9 = 5. The hundreds column dropped from 8 to 7. 7 - 5 = 2.
So 847 - 593 = 254. Can you see why this always works? Because we never change the actual value — we only change
how it is grouped. 847 = 700 + 140 + 7 = 700 + 130 + 17. The total is still 847, just written differently.

## 6. Key Vocabulary
Subtraction: the operation of taking one number away from another. Example sentence: The subtraction of 593 LD from
847 LD tells Boima how much change he should receive at the Monrovia market. Memory tip: think of "sub" as "below" —
we take the bottom number away from the top.
Difference: the result you get when you subtract one number from another. Example sentence: The difference between
847 LD and 593 LD is 254 LD — this is Boima's change. Memory tip: the difference is how different two numbers are.
Borrow: to take 1 unit from the column to the left and exchange it for 10 units in the current column. Example
sentence: When Fatu sees 4 - 9 in the tens column, she must borrow 1 hundred from the hundreds column. Memory tip:
like borrowing sugar from a neighbour — you take from next door to help where you are short.
Regroup: another word for borrow, emphasising that we are reorganising how the number is written without changing its
value. Example sentence: We regroup 847 as 700 + 130 + 17 so we can subtract 593 more easily. Memory tip: regroup
means to group the digits differently, like rearranging bags in a market stall.

## 7. Worked Example 1 — Standard Method
Problem: Pewee has 847 LD. He spends 593 LD on food at the Waterside Market in Monrovia. How much does he have left?
Step 1: Write the problem in columns. Hundreds: 8 and 5. Tens: 4 and 9. Ones: 7 and 3.
Step 2: Ones column. 7 - 3 = 4. No borrowing needed.
Step 3: Tens column. 4 - 9. Since 4 is less than 9, we borrow. Borrow 1 hundred from the hundreds column.
        Hundreds column drops from 8 to 7. Tens column goes from 4 to 14.
Step 4: 14 - 9 = 5. Write 5 in the tens column.
Step 5: Hundreds column. 7 - 5 = 2. Write 2 in the hundreds column.
Answer: 847 - 593 = 254. Pewee has 254 LD left.
What do you notice about this method? Each column is handled separately, right to left, and borrowing fixes any column
where the top digit is smaller than the bottom. Try this yourself: Calculate 752 - 348. Show every step in columns.

## 8. Worked Example 2 — Alternative Method
Same problem type using the estimation and compensation method: 847 - 593.
Round 593 to 600. 847 - 600 = 247. Now compensate: we subtracted 7 too many, so add 7 back. 247 + 7 = 254.
Method 1 (borrowing) took 5 steps. Method 2 (estimation and compensation) took 3 steps.
Method 2 is faster when doing mental arithmetic or checking your answer quickly in a market situation.
Method 1 is more reliable when you need an exact answer and the rounding adjustments are large or complex.
Smart students learn both methods and choose based on the situation — just like Fatu's mother at her market stall.

## 9. Error Analysis
Common Error 1: Students write 847 - 593 = 346 by subtracting 3 - 7 = 6 in the ones column (flipping the order).
Why this error happens: the student subtracted the smaller digit from the larger regardless of position.
Correct working: 7 - 3 = 4, not 3 - 7. Always keep the top digit on top.
Rule to prevent it: the top number always stays on top. If the top digit is smaller, borrow — never flip.
Common Error 2: After borrowing, forgetting to reduce the column you borrowed from.
Example: In 847 - 593, after borrowing from hundreds, leaving hundreds as 8 instead of reducing to 7.
Why this happens: the student adds to the tens column but forgets the hundreds column gave one away.
Rule: when you borrow, mark the lending column immediately — cross out 8 and write 7 above it.
Common Error 3: Borrowing from a zero. In 800 - 593, the tens digit is 0 and cannot lend.
The student must borrow from hundreds first: 800 = 700 + 100 = 700 + 90 + 10. Then the ones can borrow from 10 tens.
Rule: when the column you want to borrow from is 0, go one more column to the left first.

## 10. Guided Practice — Problem 1
[STUDENT_PROBLEM_START:gp1]
Calculate 654 - 278. Show every step. Use the borrowing method.
[STUDENT_PROBLEM_END:gp1]
[ANSWER_START:gp1]
Step 1: 4 - 8, need to borrow. 14 - 8 = 6.
Step 2: 4 (after lending) - 7, need to borrow. 14 - 7 = 7.
Step 3: 5 (after lending) - 2 = 3.
Answer: 654 - 278 = 376.
[ANSWER_END:gp1]

## 11. Guided Practice — Problem 2
[STUDENT_PROBLEM_START:gp2]
Kpaan has 1,000 LD and buys mangoes for 437 LD. How much change does he get?
[STUDENT_PROBLEM_END:gp2]
[ANSWER_START:gp2]
1000 - 437: borrowing chain from thousands. Answer: 563 LD change.
[ANSWER_END:gp2]

## 12. Guided Practice — Problem 3
[STUDENT_PROBLEM_START:gp3]
A school has 500 exercise books. 187 are given out on Monday and 143 on Tuesday. How many remain?
[STUDENT_PROBLEM_END:gp3]
[ANSWER_START:gp3]
Total given: 187 + 143 = 330. Remaining: 500 - 330 = 170 books.
[ANSWER_END:gp3]

## 13. Independent Practice — Tier 1
[STUDENT_PROBLEM_START:ip1a]
Calculate 83 - 47.
[STUDENT_PROBLEM_END:ip1a]
[ANSWER_START:ip1a]
36
[ANSWER_END:ip1a]
[STUDENT_PROBLEM_START:ip1b]
Calculate 150 - 68.
[STUDENT_PROBLEM_END:ip1b]
[ANSWER_START:ip1b]
82
[ANSWER_END:ip1b]

## 14. Independent Practice — Tier 2 Standard
[STUDENT_PROBLEM_START:ip2a]
Finda earns 750 LD per week. She spends 382 LD on food. How much remains?
[STUDENT_PROBLEM_END:ip2a]
[ANSWER_START:ip2a]
368 LD
[ANSWER_END:ip2a]
[STUDENT_PROBLEM_START:ip2b]
A farmer harvests 934 bags of rice and sells 567. How many remain?
[STUDENT_PROBLEM_END:ip2b]
[ANSWER_START:ip2b]
367 bags
[ANSWER_END:ip2b]

## 15. Independent Practice — Tier 3 Advanced
[STUDENT_PROBLEM_START:ip3a]
A market stall had 1,200 items. After Monday 347 were sold, after Tuesday 289 more. How many remain?
[STUDENT_PROBLEM_END:ip3a]
[ANSWER_START:ip3a]
1200 - 347 - 289 = 564 items
[ANSWER_END:ip3a]
[STUDENT_PROBLEM_START:ip3b]
Gbanyan saves 50 LD per week for 20 weeks. He spends 642 LD on school fees. How much does he have left?
[STUDENT_PROBLEM_END:ip3b]
[ANSWER_START:ip3b]
50 × 20 = 1000 LD saved. 1000 - 642 = 358 LD remaining.
[ANSWER_END:ip3b]

## 16. Group Discussion
Discuss: When does estimation help and when do you need an exact answer?
Key points: Exact for money transactions. Estimate for quick mental checks.

## 17. Assessment, Exit Ticket, and Lesson Summary
Assessment:
1. Calculate 725 - 348.
2. Gbanyan has 500 LD and spends 273 LD. How much remains?

Key Takeaways:
- Subtraction finds the difference between two numbers
- Borrowing is needed when the top digit is smaller than the bottom digit
- Always check your answer with estimation
- Liberian money problems use the same subtraction rules as any numbers

In the next lesson, we will explore multiplication.`;

const MOCK_META = JSON.stringify({
  title: "Grade 5 MATH: Subtraction with Borrowing",
  learningObjectives: [
    "Calculate subtraction with borrowing",
    "Explain the borrowing method",
    "Apply subtraction to Liberian money problems",
  ],
  assessmentQuestions: [
    { question: "Calculate 725 - 348", answer: "377", choices: null },
    {
      question: "Gbanyan has 500 LD and spends 273 LD. How much remains?",
      answer: "227 LD",
      choices: null,
    },
  ],
});

describe("generateLessonV2", () => {
  beforeEach(() => {
    vi.mocked(routedCompletion).mockReset();
    // Route mock calls by aiUsage.route so expansion calls don't consume the Pass-2 mock:
    //   curriculum.v2.body  → MOCK_BODY (Pass 1)
    //   curriculum.v2.expand → current section text + padding (expansion)
    //   curriculum.v2.meta  → MOCK_META (Pass 2)
    vi.mocked(routedCompletion).mockImplementation((opts: RouterOptions) => {
      const route = opts.aiUsage?.route ?? "";
      if (route === "curriculum.v2.meta") {
        return Promise.resolve({ content: MOCK_META, model: "gpt-4o-mini", tier: "fast", inputTokens: 0, outputTokens: 0, estimatedCostUSD: 0 } as any);
      }
      if (route === "curriculum.v2.expand") {
        // Extract the current section text from the expansion prompt so we preserve
        // the ## headings, then append padding to exceed all per-section floors.
        const userMsg = opts.messages.find((m) => m.role === "user")?.content ?? "";
        const currentMatch = userMsg.match(/---\n([\s\S]*?)\n---/);
        const currentText = currentMatch ? currentMatch[1] : "";
        return Promise.resolve({ content: currentText + "\n\n" + EXPANSION_PAD, model: "gpt-4o", tier: "smart", inputTokens: 0, outputTokens: 0, estimatedCostUSD: 0 } as any);
      }
      // Default: Pass 1 (curriculum.v2.body)
      return Promise.resolve({ content: MOCK_BODY, model: "llama-3.3-70b-versatile", tier: "smart", inputTokens: 0, outputTokens: 0, estimatedCostUSD: 0 } as any);
    });
  });

  it("returns a valid CurriculumPayload with all V2 fields", async () => {
    const result = await generateLessonV2({
      grade: 5,
      subject: "MATH",
      topic: "Subtraction with Borrowing",
    });
    expect(result.payload.title).toBeTruthy();
    expect(result.payload.grade).toBe(5);
    expect(result.payload.subject).toBe("MATH");
    expect(result.wordCount).toBeGreaterThan(200);
    expect(result.payload.takeawaySummary).toBeTruthy();
    expect(result.payload.takeawaySummary).toContain("Subtraction finds the difference");
  });

  it("extracts problem sets from structured markers", async () => {
    const result = await generateLessonV2({
      grade: 5,
      subject: "MATH",
      topic: "Subtraction with Borrowing",
    });
    expect(result.problemSetsCount).toBeGreaterThan(0);
    const gp1 = result.payload.problemSets?.find((ps) => ps.id === "gp1");
    expect(gp1).toBeTruthy();
    expect(gp1!.studentPrompt).toContain("654 - 278");
    expect(gp1!.answerKey).toContain("376");
  });

  it("strips answer blocks from student body", async () => {
    const result = await generateLessonV2({
      grade: 5,
      subject: "MATH",
      topic: "Subtraction with Borrowing",
    });
    expect(result.payload.body).not.toContain("[ANSWER_START");
    expect(result.payload.body).not.toContain("376"); // answer key not in student body
    expect(result.payload.body).toContain("654 - 278"); // student prompt still visible
  });

  it("sets demoReady flag when provided", async () => {
    const result = await generateLessonV2({
      grade: 5,
      subject: "MATH",
      topic: "Subtraction",
      demoReady: true,
    });
    expect(result.payload.demoReady).toBe(true);
  });

  it("throws GenerateLessonV2Error when body is too thin", async () => {
    vi.mocked(routedCompletion).mockReset();
    vi.mocked(routedCompletion)
      .mockResolvedValueOnce({ content: "Too short", model: "llama" } as any)
      .mockResolvedValueOnce({ content: MOCK_META, model: "gpt-4o-mini" } as any);
    await expect(
      generateLessonV2({ grade: 5, subject: "MATH", topic: "Subtraction" })
    ).rejects.toThrow("too thin");
  });

  it("calls routedCompletion with modelOverride when model is specified", async () => {
    await generateLessonV2({
      grade: 5,
      subject: "MATH",
      topic: "Subtraction with Borrowing",
      model: "gpt-4o",
    });
    const pass1Call = vi.mocked(routedCompletion).mock.calls.find(
      (args) => (args[0] as RouterOptions).aiUsage?.route === "curriculum.v2.body"
    );
    expect(pass1Call).toBeTruthy();
    expect((pass1Call![0] as RouterOptions).modelOverride).toBe("gpt-4o");
  });

  it("fires expansion calls when sections are below floor", async () => {
    await generateLessonV2({
      grade: 5,
      subject: "MATH",
      topic: "Subtraction with Borrowing",
    });
    const expandCalls = vi.mocked(routedCompletion).mock.calls.filter(
      (args) => (args[0] as RouterOptions).aiUsage?.route === "curriculum.v2.expand"
    );
    // MOCK_BODY has thin Direct Instruction, Worked Examples, etc. → at least 1 expansion call
    expect(expandCalls.length).toBeGreaterThan(0);
  });
});
