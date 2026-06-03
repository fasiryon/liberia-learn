/**
 * scripts/backfill-homework-questions.ts
 *
 * Updates existing Homework records to have subject-appropriate 10-11 question sets.
 * Safe to run multiple times (idempotent: only updates records with ≤ 3 questions).
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/backfill-homework-questions.ts [--dry-run] [--limit N]
 *
 * Examples:
 *   npx dotenv -e .env.production -- npx tsx scripts/backfill-homework-questions.ts --dry-run
 *   npx dotenv -e .env.production -- npx tsx scripts/backfill-homework-questions.ts --limit 50
 */

// Use direct Postgres URL for local scripts (bypasses Prisma Accelerate requirement)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient } from "@prisma/client";
import { parseArgs } from "node:util";

const prisma = new PrismaClient();

/**
 * Generates 10-12 subject-specific homework questions.
 * Different question types for different subjects, all anchored in Liberian context.
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

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
      limit: { type: "string" },
    },
    strict: false,
  });
  const dryRun = values["dry-run"] as boolean;
  const limit = values["limit"] ? parseInt(values["limit"] as string) : 500;

  console.log(
    `[backfill-homework-questions] Starting... dryRun=${dryRun} limit=${limit}`
  );

  // Find homework with ≤ 3 questions (or null questions) — these are the old ones
  const homeworks = await prisma.homework.findMany({
    take: limit,
    select: { id: true, title: true, questions: true, classId: true },
  });

  const toUpdate = homeworks.filter((hw) => {
    const q = hw.questions;
    if (!q) return true;
    if (Array.isArray(q)) return q.length <= 3;
    return false;
  });

  console.log(
    `[backfill-homework-questions] Found ${toUpdate.length} homework records to update (out of ${homeworks.length} total)`
  );

  let updated = 0;
  for (const hw of toUpdate) {
    // Infer subject from title (best effort)
    const titleUpper = (hw.title ?? "").toUpperCase();
    const subject =
      titleUpper.includes("MATH") || titleUpper.includes("MATHEMATICS")
        ? "MATH"
        : titleUpper.includes("SCIENCE")
          ? "SCIENCE"
          : titleUpper.includes("LITERACY") ||
              titleUpper.includes("ENGLISH") ||
              titleUpper.includes("READING")
            ? "LITERACY"
            : titleUpper.includes("SOCIAL") || titleUpper.includes("CIVICS")
              ? "CIVICS"
              : titleUpper.includes("COMPUTER") || titleUpper.includes("IT")
                ? "COMPUTER_SCIENCE"
                : "GENERAL";
    const label = hw.title ?? subject;
    const questions = generateHomeworkQuestions(subject, label, updated);

    if (dryRun) {
      console.log(
        `[dry-run] Would update ${hw.id} (${hw.title}) → ${questions.length} questions`
      );
    } else {
      await prisma.homework.update({
        where: { id: hw.id },
        data: { questions },
      });
      console.log(
        `Updated ${hw.id} (${hw.title}) → ${questions.length} questions`
      );
    }
    updated++;
  }

  console.log(
    `[backfill-homework-questions] Done. ${dryRun ? "Would have updated" : "Updated"} ${updated} records.`
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
