/**
 * components/PublicFooter.tsx
 *
 * Shared footer for all public-facing pages (homepage, login).
 * Shows legal links at a minimum.
 * Mobile-safe at 375 px — uses flex-wrap so links stack cleanly.
 */
import { LegalFooter } from "@/components/LegalFooter";

export function PublicFooter() {
  return <LegalFooter />;
}
