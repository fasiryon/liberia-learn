/**
 * lib/sms/validators.ts
 *
 * Phone number validation for Liberia.
 *
 * Liberian mobile numbers follow the format: +231XXXXXXXX
 *   +231   — country code (Liberia)
 *   7, 8, or 9 digits follow the country code (total E.164 length: 12)
 *
 * Accepted network prefixes (MTN, Lonestar, Orange):
 *   55, 77, 88 (MTN)
 *   04, 05, 06 (Lonestar/Orange legacy)
 *   07, 55, 77, 88 are common
 *
 * We validate format only — not network prefix — to remain forward-compatible.
 */

/** E.164 pattern for Liberian numbers: +231 followed by 7–9 digits. */
const LIBERIA_E164_PATTERN = /^\+231\d{7,9}$/;

/**
 * Returns true if the phone number is a valid Liberian E.164 number.
 * Accepts only +231XXXXXXXX format (no spaces, dashes, or parentheses).
 */
export function isValidLiberianPhone(phone: string): boolean {
  return LIBERIA_E164_PATTERN.test(phone.trim());
}

/**
 * Normalize a raw Liberian phone number to E.164 (+231XXXXXXXX).
 * Handles common local formats:
 *   0XXXXXXXX  → +231XXXXXXXX   (leading zero)
 *   231XXXXXXX → +231XXXXXXX    (no plus)
 *   +231XXXXXX → +231XXXXXX     (already E.164, pass-through after trim)
 *
 * Returns null if the number cannot be normalized to a valid Liberian E.164.
 */
export function normalizeLiberianPhone(raw: string): string | null {
  const stripped = raw.trim().replace(/[\s\-().]/g, "");

  // Already E.164
  if (stripped.startsWith("+231")) {
    return LIBERIA_E164_PATTERN.test(stripped) ? stripped : null;
  }

  // Country code without plus
  if (stripped.startsWith("231")) {
    const candidate = `+${stripped}`;
    return LIBERIA_E164_PATTERN.test(candidate) ? candidate : null;
  }

  // Local format with leading zero
  if (stripped.startsWith("0") && stripped.length >= 8) {
    const candidate = `+231${stripped.slice(1)}`;
    return LIBERIA_E164_PATTERN.test(candidate) ? candidate : null;
  }

  // Local format without leading zero (7–9 digit national number)
  if (/^\d{7,9}$/.test(stripped)) {
    const candidate = `+231${stripped}`;
    return LIBERIA_E164_PATTERN.test(candidate) ? candidate : null;
  }

  return null;
}
