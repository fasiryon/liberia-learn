import { createHash } from "crypto";
import type { SchoolDay } from "@/lib/learner-experience/day/schoolDay";
import type { LessonLink } from "@/components/experience/day/SchoolDayJourney";

const digest = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);

/**
 * The plan's own identity (Atlas R1): pilot block ids are `pilot:<date>:<timetableId>` and the pilot planId is the date,
 * so two distinct same-date plans can share every id. This digests every period the student sees: its id, slot, label,
 * times, binding (kind, selection, package hash, version) and lesson link, in order.
 */
function planDigest(day: SchoolDay, lessons: Readonly<Record<string, LessonLink>>): string {
  const periods = day.blocks.map((b) => {
    const binding = b.binding as { kind: string; selection?: unknown; packageHash?: unknown; version?: unknown };
    return [b.id, b.slot, b.label ?? null, b.start, b.end, binding.kind, binding.selection ?? null, binding.packageHash ?? null, binding.version ?? null,
      lessons[b.id]?.href ?? null];
  });
  return digest(JSON.stringify([day.contract, day.planId, day.source, periods]));
}

/**
 * Scope for the display-only browser-session state of /learn/day (periods opened, day ended): the plan id, a digest of
 * the complete plan definition, and a short hash of the signed-in user, so the raw user id never appears in the page or
 * in sessionStorage. Server-only.
 */
export function daySessionKey(day: SchoolDay, lessons: Readonly<Record<string, LessonLink>>, userId: string): string {
  return `${day.planId}:${planDigest(day, lessons)}:${digest(userId)}`;
}
