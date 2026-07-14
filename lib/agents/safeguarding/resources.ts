/**
 * Sprint 6.1 Spec 5, Gate B: real safeguarding resources, not placeholders.
 *
 * LIBERIA_CHILD_PROTECTION_HOTLINE (116): verified against an official
 * source - Ministry of Gender, Children and Social Protection press
 * release confirming the toll-free 116 GBV/child-abuse hotline, launched
 * 2024-12-18: https://mogcsp.gov.lr/gender-ministry-unveils-national-gbv-116-call-center-with-support-from-world-bank/
 * (checked 2026-07-13).
 *
 * POLICE GUIDANCE: NOT a specific verified number. A general Liberia police
 * emergency number was NOT confirmed against an official source during this
 * implementation (web search was rate-limited mid-session; retrying it is a
 * follow-up, not a guess made under deadline pressure). Per the explicit
 * "do not use placeholders in production" instruction, this deliberately
 * says "the police" rather than inventing a number. AGENT_GUARDIAN_ENABLED
 * should not flip to true in production until this is resolved with a real,
 * cited number - flagged in the sprint report, not silently shipped.
 */
export const LIBERIA_CHILD_PROTECTION_HOTLINE = "116";

export const SAFEGUARDING_ACKNOWLEDGMENT_MESSAGE =
  "I hear you, and this is serious. I've alerted the school right away. " +
  "If your child is in immediate danger, call the police now. For more help, Liberia's child protection hotline is " +
  LIBERIA_CHILD_PROTECTION_HOTLINE +
  ".";
