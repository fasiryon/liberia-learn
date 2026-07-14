/**
 * Guardian-facing Student ID (Sprint 6.1, Finding 1). The internal
 * Student.id is a ~25-char cuid, unusable for a guardian to type over SMS.
 * This is a short, unambiguous code: excludes O/0 and I/1 (the pairs most
 * often misread on a printed card or misheard/mistyped), and always
 * contains at least one letter and one digit so it never collides with an
 * ordinary English word when parsed back out of a guardian's free-text SMS
 * (see lib/agents/sms/identityVerification.ts).
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0, 1, I, O
const LENGTH = 7;

function randomFrom(alphabet: string): string {
  return alphabet[Math.floor(Math.random() * alphabet.length)];
}

/** Generates one candidate code. Not guaranteed unique - callers must check. */
export function generateHumanReadableStudentId(): string {
  let code: string;
  do {
    code = Array.from({ length: LENGTH }, () => randomFrom(ALPHABET)).join("");
  } while (!/[0-9]/.test(code) || !/[A-Z]/.test(code));
  return code;
}

export interface UniqueIdCheckClient {
  student: { findUnique: (args: { where: { humanReadableStudentId: string } }) => Promise<unknown | null> };
}

const MAX_ATTEMPTS = 8;

/** Generates a code and retries on the rare collision (32^7 space, checked
 * against the live table). Throws if it can't find a free code in 8 tries -
 * that would indicate a real problem (near-exhaustion or a broken query),
 * not something worth silently retrying forever. */
export async function createUniqueHumanReadableStudentId(client: UniqueIdCheckClient): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generateHumanReadableStudentId();
    const existing = await client.student.findUnique({ where: { humanReadableStudentId: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique humanReadableStudentId after 8 attempts.");
}
