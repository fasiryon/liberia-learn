import type { Prisma } from "@prisma/client";
import { parseStudentLabReturn } from "@/lib/learner-experience/labLaunch";
import { lessonRouteMatches } from "@/lib/learner-experience/lessonRoute";
import { resolveLessonDelivery } from "./lessonExperienceDelivery";

/** Reauthorize a lesson-origin launch against the exact delivery; a query grants no link authority. */
export async function authorizeStudentLabReturn(
  tx: Prisma.TransactionClient, user: { id: string; role: string; schoolId?: string | null },
  labId: string, query: Record<string, string | string[] | undefined>,
) {
  const parsed = parseStudentLabReturn(labId, query);
  if (!parsed || typeof query.rt !== "string") return null;
  const target = parsed.returnTarget.route;
  const kind = target.kind;
  const id = target.kind === "CONTENT" ? target.contentId : target.scheduledWorkId;
  try {
    const delivery = await resolveLessonDelivery(tx, user, id, parsed.context.origin.experienceVersion, kind);
    if (delivery.compatibility !== "NATIVE_V2" || delivery.lessonId !== parsed.context.origin.experienceId || !lessonRouteMatches(delivery.routeTarget, target)) return null;
    const link = delivery.authorizedLabLinks.find((entry) => entry.linkId === parsed.context.linkId && entry.labId === labId);
    if (!link || JSON.stringify(link.launchContext) !== JSON.stringify(parsed.context)) return null;
    return { ...parsed, labVersion: link.labVersion };
  } catch { return null; }
}
