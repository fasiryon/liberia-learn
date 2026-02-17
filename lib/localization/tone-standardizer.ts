// lib/localization/tone-standardizer.ts
// Adjusts reading level and tone based on grade level.

/**
 * Returns tone guidance string for AI prompts based on grade level.
 * Used as a system instruction modifier in curriculum generation.
 */
export function toneGuidance(grade: number): string {
  if (grade <= 3) {
    return (
      "Write for early elementary students (grades 1-3). " +
      "Use very simple, short sentences (5-8 words). " +
      "Use basic vocabulary that a 6-8 year old would understand. " +
      "Include encouraging language. Avoid abstract concepts. " +
      "Use concrete examples with familiar objects."
    );
  }
  if (grade <= 6) {
    return (
      "Write for upper elementary students (grades 4-6). " +
      "Use clear, moderate-length sentences. " +
      "Introduce subject-specific vocabulary with brief definitions. " +
      "Include real-world examples relevant to Liberian students. " +
      "Use a friendly, supportive tone."
    );
  }
  if (grade <= 9) {
    return (
      "Write for middle school students (grades 7-9). " +
      "Use academic language appropriate for young teenagers. " +
      "Include technical vocabulary with context clues. " +
      "Encourage critical thinking with discussion questions. " +
      "Connect concepts to real-world applications in Liberia."
    );
  }
  return (
    "Write for high school students (grades 10-12). " +
    "Use full academic register with discipline-specific terminology. " +
    "Expect students to handle complex, multi-step reasoning. " +
    "Include analysis, synthesis, and evaluation activities. " +
    "Reference Liberian and global contexts."
  );
}

/**
 * Post-processes generated text to simplify vocabulary for lower grades.
 * Lightweight — for heavy lifting, use toneGuidance() in the prompt instead.
 */
export function standardizeTone(text: string, grade: number): string {
  if (grade > 6) return text; // Only simplify for lower grades

  let result = text;

  // Replace common complex words with simpler alternatives for grades 1-6
  const simplifications: [RegExp, string][] = [
    [/\butilize\b/gi, "use"],
    [/\bdemonstrate\b/gi, "show"],
    [/\bpurchase\b/gi, "buy"],
    [/\bcommence\b/gi, "start"],
    [/\bterminate\b/gi, "end"],
    [/\badditionally\b/gi, "also"],
    [/\bfurthermore\b/gi, "also"],
    [/\bhowever\b/gi, "but"],
    [/\btherefore\b/gi, "so"],
    [/\bnevertheless\b/gi, "but"],
    [/\bapproximate(?:ly)?\b/gi, "about"],
    [/\bsufficient\b/gi, "enough"],
    [/\bnumerous\b/gi, "many"],
    [/\brequire\b/gi, "need"],
    [/\bassist\b/gi, "help"],
    [/\bobtain\b/gi, "get"],
    [/\bprovide\b/gi, "give"],
    [/\bselect\b/gi, "pick"],
    [/\bindicate\b/gi, "show"],
    [/\bprior to\b/gi, "before"],
    [/\bsubsequent(?:ly)?\b/gi, "next"],
    [/\bin order to\b/gi, "to"],
  ];

  if (grade <= 3) {
    for (const [pattern, replacement] of simplifications) {
      result = result.replace(pattern, replacement);
    }
  } else {
    // Grades 4-6: only simplify the most complex words
    const basicSimplifications = simplifications.slice(0, 10);
    for (const [pattern, replacement] of basicSimplifications) {
      result = result.replace(pattern, replacement);
    }
  }

  return result;
}
