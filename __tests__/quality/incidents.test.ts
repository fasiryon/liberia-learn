import { describe, expect, it } from "vitest";
import { upsertIncident, fingerprint } from "@/lib/quality/incidents";

const candidate = { domain: "HALLUCINATION", severity: "HIGH", detectedBy: "release-gate", reference: { metricId: "hallucination_rate" }, affectedVersion: 1, owner: "quality-team" };

describe("quality incident dedup", () => {
  it("creates a new incident on first detection", () => {
    const { incidents, created } = upsertIncident([], candidate, "2026-09-01T00:00:00.000Z");
    expect(created).toBe(true);
    expect(incidents).toHaveLength(1);
  });

  it("does not create a duplicate for the same fingerprint", () => {
    const first = upsertIncident([], candidate, "2026-09-01T00:00:00.000Z");
    const second = upsertIncident(first.incidents, candidate, "2026-09-01T01:00:00.000Z");
    expect(second.created).toBe(false);
    expect(second.incidents).toHaveLength(1);
  });

  it("creates a new incident when the affected version differs", () => {
    const first = upsertIncident([], candidate, "2026-09-01T00:00:00.000Z");
    const second = upsertIncident(first.incidents, { ...candidate, affectedVersion: 2 }, "2026-09-01T01:00:00.000Z");
    expect(second.created).toBe(true);
    expect(second.incidents).toHaveLength(2);
  });

  it("produces the same fingerprint for identical inputs regardless of key order", () => {
    const a = fingerprint({ domain: "X", reference: { metricId: "m", fixtureId: "f" }, affectedVersion: 1 });
    const b = fingerprint({ affectedVersion: 1, reference: { fixtureId: "f", metricId: "m" }, domain: "X" } as any);
    expect(a).toBe(b);
  });
});
