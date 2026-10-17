/**
 * Deterministic ledger diff guard for engineering automation (MergeOps).
 *
 * MergeOps may verify, report and escalate. It may not approve academic content, forge human decisions
 * or publish. This guard tells it what a pull request does to the modernization ledger:
 *   - the base ledger must be an exact prefix of the head ledger (append-only; no rewrite, no deletion);
 *   - the head ledger must replay (chain and every authority rule);
 *   - appended events are classified. Automated observation events may proceed through ordinary review.
 *     Any event that claims a human or authority role is escalated: a git file cannot prove who a human
 *     actor is, so those events need the named curriculum authority's own approval of the pull request.
 */
import { replayLedger, type LedgerEvent, type ActorRole } from "./ledger";

export type LedgerDiffVerdict = "NO_LEDGER_CHANGE" | "AUTOMATED_APPEND_ONLY" | "ESCALATE_HUMAN_AUTHORITY_EVENTS" | "REJECT";

export type LedgerDiffReport = Readonly<{
  verdict: LedgerDiffVerdict;
  appended: number;
  appendedByType: Readonly<Record<string, number>>;
  escalations: readonly string[];
  problems: readonly string[];
  /** MergeOps never gets authority from this report. */
  mayAutoMerge: false;
}>;

/** Roles whose events record a decision only an identified person may take. */
const AUTHORITY_ROLES: ReadonlySet<ActorRole> = new Set(["CURRICULUM_REVIEWER", "GOVERNANCE_OWNER", "CURRICULUM_AUTHORITY", "MEASUREMENT_LEAD"]);
/** Events that change what learners may receive. */
const RELEASE_EVENTS = new Set(["RELEASE_AUTHORIZED", "RELEASED"]);

export function diffLedger(base: readonly LedgerEvent[], head: readonly LedgerEvent[]): LedgerDiffReport {
  const problems: string[] = [];
  const escalations: string[] = [];
  if (head.length < base.length) problems.push(`HISTORY_DELETED: head has ${head.length} events, base ${base.length}`);
  base.forEach((event, index) => {
    if (head[index]?.hash !== event.hash) problems.push(`HISTORY_REWRITTEN at seq ${event.seq}`);
  });
  try { replayLedger(head); } catch (error) { problems.push(`REPLAY_FAILED: ${(error as Error).message}`); }
  const appended = problems.length ? [] : head.slice(base.length);
  const appendedByType: Record<string, number> = {};
  for (const event of appended) {
    appendedByType[event.body.type] = (appendedByType[event.body.type] ?? 0) + 1;
    if (event.actor.kind === "HUMAN" || AUTHORITY_ROLES.has(event.actor.role)) escalations.push(`seq ${event.seq} ${event.body.type} by ${event.actor.role}:${event.actor.id} needs that person's own approval of this pull request`);
    if (RELEASE_EVENTS.has(event.body.type)) escalations.push(`seq ${event.seq} ${event.body.type} changes learner delivery and needs the curriculum authority and a separately authorized release`);
  }
  const verdict: LedgerDiffVerdict = problems.length ? "REJECT" : !appended.length ? "NO_LEDGER_CHANGE" : escalations.length ? "ESCALATE_HUMAN_AUTHORITY_EVENTS" : "AUTOMATED_APPEND_ONLY";
  return Object.freeze({ verdict, appended: appended.length, appendedByType: Object.freeze(appendedByType), escalations: Object.freeze(escalations), problems: Object.freeze(problems), mayAutoMerge: false as const });
}
