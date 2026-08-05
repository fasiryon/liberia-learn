import { Suspense } from "react";
import StepUpClient from "./StepUpClient";
import { isAuth0Configured } from "@/lib/auth/privilegedIdentity";

export const metadata = { title: "Security check - LiberiaLearn" };

export default function StepUpPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4 py-8">
          <p className="text-sm text-[var(--ll-text-muted)]">Loading security check...</p>
        </main>
      }
    >
      <StepUpClient auth0Configured={isAuth0Configured()} />
    </Suspense>
  );
}
