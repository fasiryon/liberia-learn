export function normalizeLessonPromptText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildLessonPromptExcerpt(
  value: string | null | undefined,
  maxWords = 800
): string {
  const normalized = normalizeLessonPromptText(value);
  if (!normalized) {
    return "No lesson content was provided.";
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return normalized;
  }

  return `${words.slice(0, maxWords).join(" ")}...`;
}
