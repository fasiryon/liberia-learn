// MergeOps integration: the ledger diff guard lets automation verify and escalate, never approve.
import { describe, expect, it } from "vitest";
import { diffLedger } from "@/lib/curriculum/modernization/ledgerDiffGuard";
import { appendEvents, emptyLedger, hashEvent, type LedgerActor, type NewLedgerEvent } from "@/lib/curriculum/modernization/ledger";

const at = "2026-10-16T00:00:00.000Z";
const tool: LedgerActor = { kind: "AUTOMATED", id: "tool", role: "INVENTORY_TOOL" };
const author: LedgerActor = { kind: "AI_AGENT", id: "agent:author", role: "CANDIDATE_AUTHOR", modelFamily: "a" };
const reviewer: LedgerActor = { kind: "HUMAN", id: "reviewer:1", role: "CURRICULUM_REVIEWER" };
const ev = (actor: LedgerActor, body: NewLedgerEvent["body"]): NewLedgerEvent => ({ at, contentId: "l1", actor, body });
const base = appendEvents(emptyLedger(), [
  ev(tool, { type: "LIVE_OBSERVED", revisionId: "r1", contentHash: "h1", status: "APPROVED", lifecycleState: "APPROVED", extractSha256: "x" }),
  ev(author, { type: "CANDIDATE_REGISTERED", candidateId: "c", candidateVersion: "1", candidateHash: "c1", manifestHash: "m", legacyRevisionId: "r1", legacyContentHash: "h1", authors: [author] }),
]);

describe("ledger diff guard", () => {
  it("passes automated appends and never grants merge authority", () => {
    const head = appendEvents(base, [ev(tool, { type: "STALE_DETECTED", reason: "manifest check" })]);
    const report = diffLedger(base.events, head.events);
    expect(report.verdict).toBe("AUTOMATED_APPEND_ONLY");
    expect(report.mayAutoMerge).toBe(false);
  });
  it("escalates any event that claims a human decision", () => {
    const head = appendEvents(base, [ev(reviewer, { type: "REVIEW_RECORDED", candidateHash: "c1", scope: "ACADEMIC", decision: "ACCEPT", reportDigest: "r" })]);
    const report = diffLedger(base.events, head.events);
    expect(report.verdict).toBe("ESCALATE_HUMAN_AUTHORITY_EVENTS");
    expect(report.escalations[0]).toMatch(/reviewer:1/);
  });
  it("rejects rewritten or deleted history", () => {
    const rewritten = [...base.events];
    const { hash: _hash, ...unsigned } = rewritten[0];
    const forged = { ...unsigned, at: "2026-01-01T00:00:00.000Z" };
    rewritten[0] = { ...forged, hash: hashEvent(forged) };
    expect(diffLedger(base.events, rewritten).verdict).toBe("REJECT");
    expect(diffLedger(base.events, base.events.slice(0, 1)).verdict).toBe("REJECT");
  });
  it("reports no change when the ledger is untouched", () => {
    expect(diffLedger(base.events, base.events).verdict).toBe("NO_LEDGER_CHANGE");
  });
});
