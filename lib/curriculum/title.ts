type CurriculumPayload = Record<string, unknown>;

function asPayload(value: unknown): CurriculumPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as CurriculumPayload;
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function extractHeadingFromMarkdown(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const match = value.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/m);
  return match?.[1]?.trim() || null;
}

function extractHeadingFromBlocks(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const heading = firstNonEmptyString(
      record.heading,
      record.title,
      record.lessonTitle,
      record.text
    );
    if (heading) {
      return heading;
    }
  }

  return null;
}

export function formatCurriculumSubject(subject: string): string {
  return subject
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function extractCurriculumTitle(payloadValue: unknown): string | null {
  const payload = asPayload(payloadValue);
  const metadata =
    payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
      ? (payload.metadata as Record<string, unknown>)
      : null;

  return firstNonEmptyString(
    payload.title,
    payload.lessonTitle,
    metadata?.lessonTitle,
    extractHeadingFromBlocks(payload.content),
    extractHeadingFromBlocks(payload.blocks),
    extractHeadingFromMarkdown(payload.body),
    extractHeadingFromMarkdown(payload.body_standard),
    extractHeadingFromMarkdown(payload.body_block)
  );
}

export function buildCurriculumDisplayTitle(params: {
  title?: string | null;
  subject: string;
  gradeLevel: number;
  payload?: unknown;
}) {
  return (
    firstNonEmptyString(params.title, extractCurriculumTitle(params.payload)) ??
    `${formatCurriculumSubject(params.subject)} Grade ${params.gradeLevel} Lesson`
  );
}
