export function compressMemorySummary(summary: string, maxLength = 700) {
  const normalized = summary.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

