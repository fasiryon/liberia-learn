const FLAGGED_KEYWORDS = [
  "fight",
  "hurt",
  "kill",
  "abuse",
  "threat",
  "bully",
  "bullying",
  "inappropriate",
  "harass",
  "violence",
  "weapon",
  "knife",
  "gun",
];

export function shouldFlag(body: string): boolean {
  const lower = body.toLowerCase();
  return FLAGGED_KEYWORDS.some((k) => lower.includes(k));
}
