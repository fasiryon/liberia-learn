/** Display-only contracts over existing authorized endpoints. No learning ranking. */
export type TodayWork = { id: string; title: string; subject: string; status: "not_started" | "in_progress" | "completed"; lessonHref: string; contentId: string };
export type TodayData = { availability: "current" | "stale" | "unavailable"; generatedAt?: string; items: TodayWork[]; catchUpItems?: TodayWork[]; completedCount?: number; remainingCount?: number;
  todayFocus?: { primaryLabel: string; primaryHref: string; currentOrNext: string }; schoolDay?: { note: string | null; items: Array<{ id: string; title: string | null; subject: string | null; timeRange: string | null; status: string; primaryAction: { href: string; label: string } }> } };
export type GovernedAction = { available: boolean; status?: string; conceptLabel?: string; subject?: string; decisionId?: string; action?: { kind: "DIAGNOSTIC" | "PRACTICE"; reason: string } };
export type AssignedWork = { id: string; title: string; subject: string; dueAt: string | null; isOverdue: boolean; submission: { turnedInAt: string | null } | null };
export type ReadState<T> = { state: "loading" | "ready" | "error"; data: T | null; error?: string };
export function studentTarget(value: unknown): value is string {
  return typeof value === "string" && /^\/student\/(?:learn|lesson|lessons|work|assignments|homework|exams|labs|adaptive|waec|progress)(?:\/|\?|$)/.test(value) && !/[\\\u0000-\u001f]/.test(value);
}
export function nextActionDisplay(governed: ReadState<GovernedAction>, today: ReadState<TodayData>) {
  if (governed.state === "loading") return { state: "loading" as const };
  if (governed.state === "error") return { state: "error" as const, message: governed.error ?? "Your next learning action could not load." };
  const action = governed.data;
  if (action?.available && action.action && action.decisionId) return { state: "ready" as const, title: action.conceptLabel ?? "Learning activity", reason: action.action.reason, href: "/student/learn", label: action.action.kind === "DIAGNOSTIC" ? "Check understanding" : "Continue learning", source: "Governed learning action" };
  if (action?.status === "NO_VALID_RESOURCE") return { state: "unavailable" as const, message: "Your learning activity is unavailable. Ask your teacher for your next step; assigned work is listed below." };
  if (today.state === "loading") return { state: "loading" as const };
  if (today.state === "error" || today.data?.availability !== "current") return { state: "error" as const, message: "Your current plan is unavailable. Reconnect or try again; this does not mean you have no work." };
  const focus = today.data.todayFocus;
  if (focus && focus.primaryHref !== "/student/lessons" && studentTarget(focus.primaryHref)) return { state: "ready" as const, title: focus.currentOrNext, reason: "From your school schedule and assigned work.", href: focus.primaryHref, label: focus.primaryLabel, source: "School learning plan" };
  if (today.data.items.some((item) => item.status !== "completed") || today.data.schoolDay?.items.some((item) => item.status !== "completed")) return { state: "unavailable" as const, message: "Your school plan has activity, but no ready learning destination was provided. Check assigned work or ask your teacher." };
  return { state: "empty" as const, message: "No next activity is scheduled. Check assigned work below or explore lessons." };
}
export function dueText(work: AssignedWork) {
  if (work.submission?.turnedInAt) return "Submitted";
  if (!work.dueAt || !Number.isFinite(Date.parse(work.dueAt))) return "No due date provided";
  return `${work.isOverdue ? "Overdue · " : "Due "}${new Date(work.dueAt).toLocaleString("en-LR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}
