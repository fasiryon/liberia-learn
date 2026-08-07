// app/moe/login/page.tsx
// Server component - checks ENABLE_MOE_LOGIN_PORTAL flag before rendering.
// When flag is off, renders an inline unavailable state.

import { isMoeLoginPortalEnabled } from "@/lib/serverFlags";
import MoeLoginClient from "./MoeLoginClient";
import { isAuth0Configured, isPrivilegedMfaEnforced } from "@/lib/auth/privilegedIdentity";

export const metadata = {
  title: "MOE Portal - Sign In",
};

export default function MoeLoginPage() {
  if (!isMoeLoginPortalEnabled()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4 py-8">
        <div className="w-full max-w-lg rounded-xl border border-[var(--ll-silver)]/30 bg-[var(--ll-surface)]/80 p-8 text-center shadow-none backdrop-blur">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ll-text)]">MOE Portal</h1>
          <p className="mt-3 text-sm text-[var(--ll-text)]">This portal is not currently available.</p>
        </div>
      </main>
    );
  }

  return (
    <MoeLoginClient
      auth0Configured={isAuth0Configured()}
      privilegedMfaRequired={isPrivilegedMfaEnforced()}
    />
  );
}
