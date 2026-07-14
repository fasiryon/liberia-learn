/**
 * Deterministic safeguarding keyword gate (Sprint 6.1 Spec 5, Gate C:
 * "erring on the side of escalation, false positives acceptable, false
 * negatives are not"). This is a floor UNDER the agent's own LLM judgment,
 * not a replacement for it - the LLM can still call safeguarding.escalate
 * on concerns this list doesn't anticipate. High recall by design: a
 * keyword hit on an unrelated message costs one HIGH EscalationQueue entry
 * (cheap, reviewable), which is the accepted tradeoff.
 */
const PATTERNS: RegExp[] = [
  /\bhurt(ing)?\s+(me|him|her|my|our|the child)\b/i,
  /\bhit(ting)?\s+(me|him|her|my|our|the child)\b/i,
  /\b(beat|beating|beaten)\s+(me|him|her|my|our|the child)\b/i,
  /\babus(e|ed|ing|ive)\b/i,
  /\bthreaten(ed|ing)?\b/i,
  /\b(is|has been)?\s*missing\b/i,
  /\bfollow(ing|ed)\s+(me|him|her|my child|us)\b/i,
  /\btouch(ed|ing)?\s+(me|him|her)\s+(inappropriately|wrong|bad)\b/i,
  /\bscared\s+(of|to)\b/i,
  /\bunsafe\b/i,
  /\bself[\s-]?harm\b/i,
  /\bkill(ing)?\s+(myself|himself|herself|my ?self)\b/i,
  /\bwants?\s+to\s+die\b/i,
  /\bsuicid/i,
  /\brape[d]?\b/i,
  /\bmolest/i,
  /\bkidnap/i,
  /\btrafficking\b/i,
];

/** True if the raw guardian message matches any safeguarding pattern. */
export function detectSafeguardingKeywords(text: string): boolean {
  if (!text) return false;
  return PATTERNS.some((p) => p.test(text));
}
