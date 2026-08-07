import { decodeJwt } from "jose";

export function parseAuth0MfaClaims(idToken?: string | null): {
  subject: string;
  mfa: boolean;
  authenticatedAt: Date;
  emailVerified: boolean;
} | null {
  if (!idToken) return null;
  try {
    // NextAuth verifies the provider response before this helper runs. This
    // decode reads the already-validated ID token to extract assurance claims.
    const claims = decodeJwt(idToken);
    const subject = typeof claims.sub === "string" ? claims.sub : "";
    const amr = Array.isArray(claims.amr) ? claims.amr : [];
    const authTime = typeof claims.auth_time === "number" ? claims.auth_time : null;
    if (!subject) return null;
    return {
      subject,
      mfa: amr.includes("mfa"),
      authenticatedAt: authTime ? new Date(authTime * 1000) : new Date(),
      emailVerified: claims.email_verified === true,
    };
  } catch {
    return null;
  }
}
