/**
 * Normalize a phone number to E.164 format.
 * Default country code is +231 (Liberia).
 */
export function normalizeToE164(
  phone: string,
  countryCode: string = "+231"
): string | null {
  let cleaned = phone.replace(/[\s\-().]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return /^\+\d{7,15}$/.test(cleaned) ? cleaned : null;
  if (cleaned.startsWith("00")) cleaned = "+" + cleaned.slice(2);
  else cleaned = countryCode + cleaned.replace(/^0/, "");
  return /^\+\d{7,15}$/.test(cleaned) ? cleaned : null;
}

