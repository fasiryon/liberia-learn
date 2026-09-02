import { createHash, randomUUID } from "crypto";

export type QualityIncident = {
  incidentId: string;
  fingerprint: string;
  domain: string;
  severity: string;
  detectedBy: string;
  reference: { metricId?: string; fixtureId?: string };
  affectedVersion: number;
  status: "OPEN" | "CLOSED";
  owner: string;
  openedAt: string;
  closedAt?: string;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function fingerprint(input: { domain: string; reference: { metricId?: string; fixtureId?: string }; affectedVersion: number }): string {
  return createHash("sha256").update(canonical(input)).digest("hex");
}

export function upsertIncident(
  existing: QualityIncident[],
  candidate: Omit<QualityIncident, "incidentId" | "fingerprint" | "status" | "openedAt">,
  now: string,
): { incidents: QualityIncident[]; created: boolean } {
  const fp = fingerprint({ domain: candidate.domain, reference: candidate.reference, affectedVersion: candidate.affectedVersion });
  const match = existing.find((incident) => incident.fingerprint === fp && incident.status === "OPEN");
  if (match) return { incidents: existing, created: false };
  const incident: QualityIncident = { ...candidate, incidentId: randomUUID(), fingerprint: fp, status: "OPEN", openedAt: now };
  return { incidents: [...existing, incident], created: true };
}
