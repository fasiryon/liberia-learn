import { describe, it, expect } from "vitest";

/**
 * Generates 10-12 subject-specific homework questions.
 * Different question types for different subjects, all anchored in Liberian context.
 * (Duplicate of the function in scripts/seed-demo.ts and scripts/backfill-homework-questions.ts)
 */
function generateHomeworkQuestions(
  subject: string,
  label: string,
  hwIndex: number
): string[] {
  const base = [
    `Explain in your own words the main concept you learned about ${label} this week.`,
    `Give two real-life examples of how ${label} is used in everyday life in Liberia.`,
    `What is the most important vocabulary word you learned in ${label} this week? Write a definition and an example sentence.`,
    `Describe one thing that was difficult or confusing about ${label}. How did you try to understand it?`,
    `How does what you learned in ${label} connect to something you do at home or in your community?`,
    `Write 2-3 questions you would ask a teacher or classmate to help you understand ${label} better.`,
  ];

  const subjectExtra: Record<string, string[]> = {
    MATH: [
      `Solve this problem and show all your working: if a market seller in Monrovia has 345 LD and spends 178 LD on cassava, how much remains?`,
      `Create your own word problem using numbers. Swap with a family member and solve each other's problems.`,
      `List the steps you follow to solve a ${label} problem. Are there shortcuts? Explain one.`,
      `Draw a diagram or chart that shows what you learned in ${label} this week.`,
      `How would you use ${label} if you were running a small business in Liberia?`,
    ],
    SCIENCE: [
      `Describe an observation you made this week that relates to ${label}. What did you notice?`,
      `Design a simple experiment you could do at home to test an idea from ${label}. List the materials (use local items like leaves, water, or stones).`,
      `What is one scientific fact from ${label} that surprised you? Why?`,
      `How does ${label} help explain something you see in nature around Liberia?`,
      `Predict: what would happen if one factor in today's ${label} topic changed? Explain your reasoning.`,
    ],
    LITERACY: [
      `Write a short paragraph (5-7 sentences) using 3 vocabulary words you learned in ${label} this week.`,
      `Read one paragraph from a book, newspaper, or sign in your home or community. Write one sentence summarising what it says.`,
      `Practise writing your name, today's date, and the title of the ${label} lesson in your best handwriting.`,
      `Retell the main events of a story or text from ${label} to a family member. Ask them to check if you remembered correctly.`,
      `Find one word in your home or community (on a package, sign, or notice). What does it mean? Use it in a sentence.`,
    ],
    CIVICS: [
      `Name one right you have as a student or citizen in Liberia. How does this right help you?`,
      `Describe one responsibility you have at home, at school, or in your community. Why is it important?`,
      `How does the Liberian government make decisions that affect your daily life? Give one example.`,
      `Research one community leader or government official in your area. What is their role?`,
      `What is one rule in your school or community that you think is fair or unfair? Explain your reasoning.`,
    ],
    COMPUTER_SCIENCE: [
      `Write the steps (algorithm) for making a cup of tea or cooking cassava. Use numbered steps.`,
      `Find one example of technology (phone, radio, generator) in your community. Describe how it works in 3-4 sentences.`,
      `Create a pattern using shapes or numbers. Describe the rule for your pattern.`,
      `What is one way that computers or technology could help your school or community? Explain your idea.`,
      `Practice the keyboard skills you learned: write the alphabet in uppercase, then in lowercase.`,
    ],
  };

  const extra = subjectExtra[subject] ?? [
    `Practice the main skill from ${label} for 10 minutes. Describe what you did.`,
    `Create a simple quiz (3 questions) about ${label} to test a family member.`,
    `Draw or write something that shows what ${label} means to you.`,
    `How will you use what you learned in ${label} in the future?`,
    `Write a letter to a friend explaining what ${label} is about in your own words.`,
  ];

  // Pick 11 questions: all 6 base + 5 subject-specific (rotate by hwIndex, wrap around)
  const startIdx = hwIndex % extra.length;
  const selectedExtra: string[] = [];
  for (let i = 0; i < 5; i++) {
    selectedExtra.push(extra[(startIdx + i) % extra.length]);
  }
  const combined = [...base, ...selectedExtra];

  // Return exactly 11 questions
  return combined;
}

describe("generateHomeworkQuestions", () => {
  it("returns 11 questions for MATH", () => {
    const q = generateHomeworkQuestions("MATH", "Mathematics", 0);
    expect(q.length).toBe(11);
  });

  it("returns 11 questions for SCIENCE", () => {
    const q = generateHomeworkQuestions("SCIENCE", "Science", 0);
    expect(q.length).toBe(11);
  });

  it("returns 11 questions for LITERACY", () => {
    const q = generateHomeworkQuestions("LITERACY", "English/Literacy", 0);
    expect(q.length).toBe(11);
  });

  it("returns 11 questions for CIVICS", () => {
    const q = generateHomeworkQuestions("CIVICS", "Civics & Social Studies", 0);
    expect(q.length).toBe(11);
  });

  it("returns 11 questions for COMPUTER_SCIENCE", () => {
    const q = generateHomeworkQuestions("COMPUTER_SCIENCE", "Information Technology", 0);
    expect(q.length).toBe(11);
  });

  it("returns 11 questions for unknown subject (fallback)", () => {
    const q = generateHomeworkQuestions("PE", "Physical Education", 0);
    expect(q.length).toBe(11);
  });

  it("rotates questions by hwIndex for MATH", () => {
    const q0 = generateHomeworkQuestions("MATH", "Math", 0);
    const q1 = generateHomeworkQuestions("MATH", "Math", 1);
    const q2 = generateHomeworkQuestions("MATH", "Math", 2);

    // All should have 11 questions
    expect(q0.length).toBe(11);
    expect(q1.length).toBe(11);
    expect(q2.length).toBe(11);

    // MATH extra questions should be included
    const allText = [...q0, ...q1, ...q2].join(" ");
    expect(allText).toMatch(/Monrovia|LD|market seller|cassava|word problem/i);
  });

  it("includes all base questions", () => {
    const q = generateHomeworkQuestions("MATH", "Addition", 0);
    const combined = q.join(" ");

    // Check for key base question patterns
    expect(combined).toMatch(/explain in your own words/i);
    expect(combined).toMatch(/real-life examples/i);
    expect(combined).toMatch(/vocabulary word/i);
    expect(combined).toMatch(/difficult or confusing/i);
    expect(combined).toMatch(/connect to something/i);
  });

  it("includes Liberian context in questions", () => {
    const q = generateHomeworkQuestions("MATH", "Addition", 0);
    const combined = q.join(" ");

    // Should mention Liberia or Monrovia or community
    expect(combined.toLowerCase()).toMatch(/liberia|monrovia|community|home|school/);
  });

  it("includes subject-specific questions for SCIENCE", () => {
    const q = generateHomeworkQuestions("SCIENCE", "Biology", 0);
    const combined = q.join(" ");

    // Should include SCIENCE-specific content
    expect(combined.toLowerCase()).toMatch(
      /observation|experiment|scientific fact|nature|predict/i
    );
  });

  it("includes subject-specific questions for LITERACY", () => {
    const q = generateHomeworkQuestions("LITERACY", "English", 0);
    const combined = q.join(" ");

    // Should include LITERACY-specific content
    expect(combined.toLowerCase()).toMatch(
      /paragraph|vocabulary|read|retell|handwriting|word/i
    );
  });

  it("includes subject-specific questions for CIVICS", () => {
    const q = generateHomeworkQuestions("CIVICS", "Government", 0);
    const combined = q.join(" ");

    // Should include CIVICS-specific content
    expect(combined.toLowerCase()).toMatch(/right|responsibility|government|liberian/i);
  });

  it("includes subject-specific questions for COMPUTER_SCIENCE", () => {
    const q = generateHomeworkQuestions("COMPUTER_SCIENCE", "Computers", 0);
    const combined = q.join(" ");

    // Should include COMPUTER_SCIENCE-specific content
    expect(combined.toLowerCase()).toMatch(/algorithm|technology|pattern|keyboard|community/i);
  });

  it("different hwIndex values produce different extra questions", () => {
    const subjects = ["MATH", "SCIENCE", "LITERACY"];

    for (const subject of subjects) {
      const q0 = generateHomeworkQuestions(subject, subject, 0);
      const q4 = generateHomeworkQuestions(subject, subject, 4);

      // The last 5 questions should differ based on hwIndex rotation
      // (first 6 base questions should be the same)
      const q0Extra = q0.slice(6).join("|");
      const q4Extra = q4.slice(6).join("|");

      // They should not be identical (rotation should produce different sets)
      expect(q0Extra).not.toEqual(q4Extra);
    }
  });

  it("always returns exactly 11 questions regardless of input", () => {
    const testCases = [
      { subject: "MATH", label: "Math", hwIndex: 0 },
      { subject: "SCIENCE", label: "Science", hwIndex: 5 },
      { subject: "LITERACY", label: "English", hwIndex: 10 },
      { subject: "UNKNOWN", label: "Unknown", hwIndex: 999 },
    ];

    for (const tc of testCases) {
      const q = generateHomeworkQuestions(tc.subject, tc.label, tc.hwIndex);
      expect(q.length).toBe(11);
      expect(q.every((item) => typeof item === "string")).toBe(true);
      expect(q.every((item) => item.length > 0)).toBe(true);
    }
  });
});
