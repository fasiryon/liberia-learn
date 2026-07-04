// Phase 4A — plan inline illustrations for a VISUAL lesson from its body prose.
// Inline illustrations are added ONLY when the body explicitly describes several
// distinct depictable structures. Positions are paragraph indices in the body.

// Distinct depictable structure nouns worth illustrating inline.
const STRUCTURE_TERMS = [
  "cell", "nucleus", "membrane", "mitochondria", "chloroplast", "organelle",
  "leaf", "root", "stem", "flower", "seed", "heart", "lung", "kidney", "brain",
  "neuron", "bone", "muscle", "skeleton", "atom", "molecule", "proton", "electron",
  "circuit", "magnet", "lever", "pulley", "gear", "engine", "bridge", "wave",
  "planet", "star", "volcano", "mountain", "river", "rock", "mineral", "cloud",
  "ecosystem", "food chain", "water cycle", "solar system", "digestive system",
  "respiratory system", "circulatory system",
];

export const MAX_INLINE_PER_LESSON = 3;

export type InlineSpec = { position: number; subjectFocus: string };

/** Split a lesson body string into rendered paragraph units. */
export function splitBodyParagraphs(body: string): string[] {
  return String(body || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Return inline illustration specs, or [] when the body does not describe
 * enough distinct structures to warrant them.
 */
export function planInlineIllustrations(input: {
  title?: string | null;
  body: string;
}): InlineSpec[] {
  const paragraphs = splitBodyParagraphs(input.body);
  if (paragraphs.length === 0) return [];

  const found: { term: string; position: number }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < paragraphs.length; i++) {
    const lower = paragraphs[i].toLowerCase();
    for (const term of STRUCTURE_TERMS) {
      if (seen.has(term)) continue;
      if (lower.includes(term)) {
        found.push({ term, position: i });
        seen.add(term);
      }
    }
  }

  // "multiple distinct structures" gate: need at least 2 distinct terms.
  if (found.length < 2) return [];

  const titlePart = input.title ? `${input.title}: ` : "";
  return found.slice(0, MAX_INLINE_PER_LESSON).map((f) => ({
    position: f.position,
    subjectFocus: `${titlePart}${f.term}`,
  }));
}
