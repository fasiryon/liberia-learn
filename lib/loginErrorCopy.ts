/**
 * Sign-in failure wording (founder ruling 2026-11-16, #12). NextAuth reports failures as codes such as
 * "CredentialsSignin"; showing them is confusing, and different messages per cause would reveal whether an account
 * exists. Every failure therefore gets this one message.
 */
export const LOGIN_ERROR_GENERIC = "We couldn't sign you in. Check your details and try again.";

export function loginErrorMessage(_code: string | null | undefined): string {
  return LOGIN_ERROR_GENERIC;
}
