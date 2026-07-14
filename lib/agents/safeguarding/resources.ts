/**
 * Sprint 6.1 Spec 5, Gate B: real safeguarding resources, not placeholders.
 *
 * LIBERIA_CHILD_PROTECTION_HOTLINE (116): verified against an official
 * source - Ministry of Gender, Children and Social Protection press
 * release confirming the toll-free 116 GBV/child-abuse hotline, launched
 * 2024-12-18: https://mogcsp.gov.lr/gender-ministry-unveils-national-gbv-116-call-center-with-support-from-world-bank/
 * (checked 2026-07-13).
 *
 * LIBERIA_POLICE_NUMBER (0770-800-911): confirmed via an official Liberia
 * National Police (LNP) public safety notice - Liberia's national
 * operations number for police assistance, crime reporting, and emergency
 * response (checked 2026-07-14). Explicitly NOT "911" - that number is not
 * in use in Liberia. Do not shorten or "correct" this to 911 anywhere.
 */
export const LIBERIA_CHILD_PROTECTION_HOTLINE = "116";
export const LIBERIA_POLICE_NUMBER = "0770-800-911";

export const SAFEGUARDING_ACKNOWLEDGMENT_MESSAGE =
  "I hear you, and this is serious. I've alerted the school right away. " +
  `If your child is in immediate danger, please call the police at ${LIBERIA_POLICE_NUMBER}. ` +
  `For more help, Liberia's child protection hotline is ${LIBERIA_CHILD_PROTECTION_HOTLINE}.`;
