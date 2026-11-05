// U1 RED scaffold: the contract is defined by __tests__/auth/session-revocation-u1.test.ts; implemented in the GREEN commit.
export const SESSION_ADMITTED_HEADER = "x-ll-session-admitted";
export function sessionClaimsFailure(_claims: Record<string, unknown>, _nowMs = Date.now()): string | null {
  return null;
}
