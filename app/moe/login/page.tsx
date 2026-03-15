// app/moe/login/page.tsx
// Server component - checks ENABLE_MOE_LOGIN_PORTAL flag before rendering.
// When flag is off, renders an inline unavailable state.

import { isMoeLoginPortalEnabled } from "@/lib/serverFlags";
import MoeLoginClient from "./MoeLoginClient";

export const metadata = {
  title: "MOE Portal - Sign In",
};

export default function MoeLoginPage() {
  if (!isMoeLoginPortalEnabled()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020d1f] px-4 py-8">
        <div className="w-full max-w-lg rounded-2xl border border-blue-800/30 bg-[#0a1e3d]/80 p-8 text-center shadow-2xl shadow-blue-950/60 backdrop-blur">
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">MOE Portal</h1>
          <p className="mt-3 text-sm text-slate-300">This portal is not currently available.</p>
        </div>
      </main>
    );
  }

  return <MoeLoginClient />;
}
