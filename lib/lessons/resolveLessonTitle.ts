type LessonPayload = {
  title?: unknown;
  topic?: unknown;
  lessonTitle?: unknown;
  lessonName?: unknown;
};

function normalizeTitle(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[a-z0-9_-]{8,}$/i.test(trimmed) && !/\s/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function resolveLessonTitle(input: {
  payload?: LessonPayload | null;
  subject?: string | null;
  fallbackTitle?: string | null;
}): string {
  const payload = input.payload ?? undefined;
  const fromPayload =
    normalizeTitle(payload?.title) ??
    normalizeTitle(payload?.lessonTitle) ??
    normalizeTitle(payload?.lessonName) ??
    normalizeTitle(payload?.topic);

  if (fromPayload) {
    return fromPayload;
  }

  const fromFallback = normalizeTitle(input.fallbackTitle);
  if (fromFallback) {
    return fromFallback;
  }

  const subject =
    typeof input.subject === "string" && input.subject.trim()
      ? input.subject.trim().replace(/_/g, " ")
      : null;
  return subject ? `${subject} Lesson` : "Lesson";
}
