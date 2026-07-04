// Phase 4A — derive image search / generation keywords from lesson metadata.

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "at", "by",
  "from", "as", "is", "are", "was", "were", "be", "been", "its", "it", "this", "that",
  "introduction", "intro", "lesson", "unit", "part", "chapter", "overview", "review",
  "practice", "understanding", "learning", "about", "basics", "basic", "into",
]);

// Bias terms appended to steer curated photos toward the Liberian / West African context.
const CONTEXT_BIAS: Record<string, string> = {
  CIVICS: "Liberia West Africa community",
  SOCIAL_STUDIES: "Liberia West Africa",
  HISTORY: "West Africa",
  GEOGRAPHY: "West Africa landscape",
  CAREER: "African workplace",
  PE: "children exercise outdoors",
};

export function keywordTokens(input: {
  title?: string | null;
  topics?: string[] | null;
}): string[] {
  const raw = `${input.title ?? ""} ${(input.topics ?? []).join(" ")}`.toLowerCase();
  const tokens = raw
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  // dedupe, preserve order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** Build a concise search query string for photo-provider APIs. */
export function deriveSearchQuery(input: {
  title?: string | null;
  subject: string;
  topics?: string[] | null;
}): string {
  const tokens = keywordTokens(input).slice(0, 5);
  const bias = CONTEXT_BIAS[(input.subject || "").toUpperCase()] ?? "";
  const base = tokens.join(" ").trim();
  const query = `${base} ${bias}`.trim().replace(/\s+/g, " ");
  return query || (input.subject || "education").toLowerCase();
}
