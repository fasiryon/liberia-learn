// lib/exports/anonymize.ts — Sprint 7
// Anonymization service: strips or generalizes PII before export.
// All functions are pure transforms — no DB calls.

/**
 * Replaces a name with a pseudonymous token based on a stable hash
 * of the original value. The hash is one-way and non-reversible.
 */
function pseudonymize(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return `anon_${hash.toString(16).padStart(8, "0")}`;
}

/**
 * Generalizes a date to year+month only (removes day).
 * Input: ISO date string. Output: "YYYY-MM" or null.
 */
export function generalizeDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Suppresses a value entirely (returns null).
 * Used when a field cannot even be generalized safely.
 */
export function suppress(_value: unknown): null {
  return null;
}

/**
 * Anonymizes a free-text name (first name, last name, full name).
 * Returns a pseudonymous token.
 */
export function anonymizeName(value: string | null | undefined): string | null {
  if (!value) return null;
  return pseudonymize(value.trim().toLowerCase());
}

/**
 * Anonymizes an email address.
 * Returns "anon_<hash>@redacted" — preserves domain structure for debugging
 * while making the address non-identifiable.
 */
export function anonymizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const [local] = value.split("@");
  return `${pseudonymize(local)}@redacted`;
}

/**
 * Anonymizes a phone number — returns "REDACTED".
 */
export function anonymizePhone(_value: string | null | undefined): string {
  return "REDACTED";
}

/**
 * Strips known PII fields from a plain object.
 * Returns a new object with PII fields replaced by anonymized equivalents.
 *
 * Recognized PII keys (case-insensitive suffix match):
 *   name, email, phone, firstname, lastname, fullname
 */
export function stripPiiFromRecord(
  record: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const k = key.toLowerCase();
    if (k === "email" || k.endsWith("email")) {
      result[key] = anonymizeEmail(value as string);
    } else if (k === "phone" || k.endsWith("phone")) {
      result[key] = anonymizePhone(value as string);
    } else if (
      k === "name" ||
      k === "firstname" ||
      k === "lastname" ||
      k === "fullname" ||
      k.endsWith("name")
    ) {
      result[key] = anonymizeName(value as string);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Strips PII from an array of records.
 */
export function anonymizeRows(
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  return rows.map(stripPiiFromRecord);
}
