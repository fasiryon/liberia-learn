// app/moe/login/page.tsx
// Server component — checks ENABLE_MOE_LOGIN_PORTAL flag before rendering.
// When flag is off, returns 404. When on, renders the branded MOE login form.

import { notFound } from "next/navigation";
import { isMoeLoginPortalEnabled } from "@/lib/serverFlags";
import MoeLoginClient from "./MoeLoginClient";

export const metadata = {
  title: "MOE Portal — Sign In",
};

export default function MoeLoginPage() {
  if (!isMoeLoginPortalEnabled()) {
    notFound();
  }
  return <MoeLoginClient />;
}
