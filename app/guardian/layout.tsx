import { notFound } from "next/navigation";
import { isGuardianPortalEnabled } from "@/lib/serverFlags";

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
  if (!isGuardianPortalEnabled()) {
    notFound();
  }
  return children;
}
