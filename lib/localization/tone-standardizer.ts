// lib/localization/tone-standardizer.ts
// Adjusts reading level and tone based on grade level.

/**
 * Returns tone guidance string for AI prompts based on grade level.
 * Used as a system instruction modifier in curriculum generation.
 */
export function toneGuidance(grade: number): string {
  if (grade <= 3) {
    return (
      "Write for early primary students (Grades 1–3, ages 6–9). " +
      "Sentence length: 8–14 words maximum. Use only words a child this age already knows, or define new words immediately with a physical example they can see or touch. " +
      "Speak directly to the student: 'You are going to learn...' not 'Students will learn...' " +
      "All examples must involve objects students can count, group, sort, or compare — no abstract variables. " +
      "Use Liberian names and local objects (yams, coins, buckets, stones). " +
      "Every instruction must be a single, clear action: 'Count the yams. Write the number.' " +
      "Even at this level, teach the WHY behind each step in simple words: 'We write the bigger number on top because it helps us subtract without making mistakes.' " +
      "Be warm and encouraging — frame difficulty as a puzzle to solve, not a barrier."
    );
  }
  if (grade <= 6) {
    return (
      "Write for upper primary students (Grades 4–6, ages 9–12). " +
      "Always present the concrete, physical example BEFORE stating the abstract rule. Never lead with a formula. " +
      "Introduce subject-specific vocabulary explicitly: state the term, define it in plain language, then use it in a Liberian context sentence. " +
      "After any rule or formula, immediately show it working on a specific number or situation. " +
      "Begin asking 'Why does this work?' — students at this level can start to reason, not just calculate. " +
      "Connect every skill to something real: market arithmetic, farm measurements, sports statistics. " +
      "Challenge the strongest students: add a stretch question or a 'Can you find another way?' prompt. " +
      "Sentence length 15–20 words. Tone: curious and rigorous — treat students as capable thinkers, not passive receivers."
    );
  }
  if (grade <= 9) {
    return (
      "Write for junior secondary students (Grades 7–9, ages 12–15). " +
      "Use full academic register: subject-specific terminology, formal sentence structures, technical precision. " +
      "For every core problem, show at least two solution methods where applicable and compare their efficiency. " +
      "Require students to write explanations in their own words — not just fill in blanks. " +
      "Connect every topic to careers and higher education: 'Engineers at Liberia's Freeport use this formula to calculate load bearing. If you study civil engineering, this is where it starts.' " +
      "Include Socratic questions embedded in worked examples: 'Why do we do this step before that one?', 'What would happen if the numbers were negative?' " +
      "Standards should approach national exam level (WAEC/BECE) on standard problems, and reach pre-competition level on challenge problems. " +
      "Cross-curricular connections are mandatory: a science lesson should connect to mathematics; a history lesson should connect to data analysis or economics."
    );
  }
  return (
    "Write for senior secondary students (Grades 10–12, ages 15–18). " +
    "Use university-preparatory language and discipline-specific terminology throughout. " +
    "Standard problems should match WAEC Senior Secondary Certificate level. Challenge problems should approach SAT, A-Level, or national Olympiad level. " +
    "Show multiple methods, proofs, and derivations — not just procedures. Students must see HOW formulas are derived, not just use them. " +
    "Include analytical and synthesis tasks: compare methodologies, evaluate assumptions, propose extensions. " +
    "Connect explicitly to university entrance requirements: 'This concept appears in first-year calculus at the University of Liberia and on the SAT Math section.' " +
    "Reference global and Liberian contexts equally: economic data from Liberia's Central Bank, scientific research from Liberian universities, historical analysis of Liberian law. " +
    "Expect students to construct multi-paragraph written justifications for mathematical or scientific claims. " +
    "Tone: peer-level intellectual rigor — write as if preparing a student for a scholarship interview."
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
