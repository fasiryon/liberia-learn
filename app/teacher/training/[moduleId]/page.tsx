/**
 * app/teacher/training/[moduleId]/page.tsx  (Server Component)
 *
 * Module detail page.  Resolves the module from static definitions,
 * then hands rendering off to the client ModulePlayer component.
 *
 * Feature-gated: redirects to /teacher when ENABLE_TRAINING_CENTER is false.
 * Auth: TEACHER or ADMIN only.
 */

import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getModuleById } from "@/lib/training/modules";
import { ModulePlayer } from "./ModulePlayer";
import { isTrainingCenterEnabled } from "@/lib/serverFlags";

interface Props {
  params: { moduleId: string };
}

export const dynamic = "force-dynamic";

export default async function TrainingModulePage({ params }: Props) {
  // ── Feature gate ──────────────────────────────────────────────────────────
  if (!isTrainingCenterEnabled()) {
    redirect("/teacher");
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await requireUser().catch(() => null);
  if (!user?.id) redirect("/login");
  if (user.role !== "TEACHER" && user.role !== "ADMIN") redirect("/");

  // ── Module lookup ─────────────────────────────────────────────────────────
  const mod = getModuleById(params.moduleId);
  if (!mod) notFound();

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#10b98122,_transparent_60%)]" />
      <ModulePlayer module={mod} />
    </main>
  );
}
