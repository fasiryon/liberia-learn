"use client";

import { GuardianWelcomeGate } from "@/app/guardian/GuardianWelcomeGate";
import { LegalFooter } from "@/components/LegalFooter";

export function GuardianShell({
  children,
  enableWelcomeGate,
}: {
  children: React.ReactNode;
  enableWelcomeGate: boolean;
}) {
  return (
    <>
      <GuardianWelcomeGate enabled={enableWelcomeGate} />
      {children}
      <LegalFooter />
    </>
  );
}
