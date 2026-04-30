export type AnonymizeForAIOptions = {
  knownNames?: Array<string | null | undefined>;
  knownEmails?: Array<string | null | undefined>;
};

export type AnonymizedAIText = {
  text: string;
  redactionCount: number;
};

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?:\+?231[\s-]?)?(?:\(?\d{2,3}\)?[\s-]?)?\d{3}[\s-]?\d{3,4}\b/g;
const STUDENT_IDENTIFIER_RE =
  /\b(?:student\s*(?:id|number)|admission\s*(?:id|number|no)|learner\s*(?:id|number)|id)\s*[:#-]?\s*[A-Z0-9][A-Z0-9-]{2,}\b/gi;
const NAME_LABEL_RE =
  /\b(?:my name is|i am|i'm|name\s*:)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}/g;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAndCount(text: string, pattern: RegExp, replacement: string) {
  let count = 0;
  const next = text.replace(pattern, () => {
    count += 1;
    return replacement;
  });
  return { text: next, count };
}

function cleanKnownValue(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function knownNamePatterns(knownNames: Array<string | null | undefined>) {
  const names = new Set<string>();
  for (const raw of knownNames) {
    const name = cleanKnownValue(raw);
    if (!name) continue;
    names.add(name);
    for (const part of name.split(/\s+/).filter((part) => part.length >= 2)) {
      names.add(part);
    }
  }
  return [...names]
    .sort((a, b) => b.length - a.length)
    .map((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi"));
}

export function anonymizeForAI(
  value: string,
  options: AnonymizeForAIOptions = {}
): AnonymizedAIText {
  let text = String(value ?? "");
  let redactionCount = 0;

  for (const email of options.knownEmails ?? []) {
    const clean = cleanKnownValue(email);
    if (!clean) continue;
    const result = replaceAndCount(text, new RegExp(escapeRegExp(clean), "gi"), "[student email]");
    text = result.text;
    redactionCount += result.count;
  }

  for (const pattern of knownNamePatterns(options.knownNames ?? [])) {
    const result = replaceAndCount(text, pattern, "Student");
    text = result.text;
    redactionCount += result.count;
  }

  for (const [pattern, replacement] of [
    [EMAIL_RE, "[student email]"],
    [PHONE_RE, "[phone]"],
    [STUDENT_IDENTIFIER_RE, "[student identifier]"],
    [NAME_LABEL_RE, "Student"],
  ] as const) {
    const result = replaceAndCount(text, pattern, replacement);
    text = result.text;
    redactionCount += result.count;
  }

  return { text, redactionCount };
}
