/**
 * Founder ruling 2026-11-16 (#12): (a) the sign-in page never shows NextAuth's raw error code ("CredentialsSignin") —
 * every failure gets one understandable, generic message that does not reveal whether an account exists; (b) on phones
 * the offline-sync toasts sit above the fixed bottom navigation and the accessibility button instead of covering them.
 * Browser regression (390/820/1440 overlap + login wording) is in the T1 overlay run on this branch.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loginErrorMessage, LOGIN_ERROR_GENERIC } from "@/lib/loginErrorCopy";

describe("sign-in error wording", () => {
  it("maps every NextAuth error code (and unknown ones) to the same generic message", () => {
    for (const code of ["CredentialsSignin", "AccessDenied", "Configuration", "Verification", "Default", "something_new", "", undefined, null]) {
      const msg = loginErrorMessage(code as never);
      expect(msg).toBe(LOGIN_ERROR_GENERIC);
      expect(msg).not.toMatch(/Credentials|Signin|AccessDenied|Configuration|no account|not found|does not exist|unknown user/i);
    }
  });
  it("the generic message tells the person what to do", () => {
    expect(LOGIN_ERROR_GENERIC).toMatch(/check/i);
    expect(LOGIN_ERROR_GENERIC).toMatch(/try again/i);
  });
  it("the login page shows the mapped message, never res.error itself", () => {
    const src = readFileSync("app/login/LoginClient.tsx", "utf8");
    expect(src).toContain("setError(loginErrorMessage(res.error))");
    expect(src).not.toMatch(/setError\(res\.error\)/);
  });
});

describe("offline-sync toasts on phones", () => {
  it("sit above the fixed bottom navigation and the accessibility button below 768px; unchanged from 768px up", () => {
    const src = readFileSync("app/student/SyncManager.tsx", "utf8");
    expect(src).toMatch(/fixed right-4 z-50[^"]*bottom-\[calc\(9\.5rem\+env\(safe-area-inset-bottom,0px\)\)\][^"]*md:bottom-4/);
    expect(src).not.toMatch(/"fixed bottom-4 right-4 z-50/);
  });
});
