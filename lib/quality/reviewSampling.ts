import { createHash } from "crypto";

export type SamplingPolicy = {
  policyId: string;
  version: number;
  domain: "TUTOR_HELPFULNESS" | "HALLUCINATION" | "GROUNDING" | "MODERATION_FALSE_POSITIVE" | "MODERATION_FALSE_NEGATIVE";
  ratePer1000: number;
  minimumSample: number;
  priorityTags: string[];
  riskEscalationRatePer1000: number;
  window: { fromHours: number };
  owner: string;
};

type PopulationRow = { artifactRef: string; occurredAt: string; riskTags: string[] };

function stableBucket(artifactRef: string): number {
  const digest = createHash("sha256").update(artifactRef).digest();
  return digest.readUInt16BE(0) % 1000;
}

export function selectSample(population: PopulationRow[], policy: SamplingPolicy, now: string): string[] {
  const cutoff = new Date(now).getTime() - policy.window.fromHours * 60 * 60 * 1000;
  const eligible = population.filter((row) => new Date(row.occurredAt).getTime() >= cutoff);
  const priority = eligible.filter((row) => row.riskTags.some((tag) => policy.priorityTags.includes(tag)));
  const rest = eligible.filter((row) => !priority.includes(row));
  const sampledRest = rest.filter((row) => stableBucket(row.artifactRef) < policy.ratePer1000);
  const combined = [...priority, ...sampledRest];
  if (combined.length < policy.minimumSample) {
    const remaining = rest.filter((row) => !sampledRest.includes(row)).sort((a, b) => stableBucket(a.artifactRef) - stableBucket(b.artifactRef));
    for (const row of remaining) {
      if (combined.length >= policy.minimumSample) break;
      combined.push(row);
    }
  }
  return [...new Set(combined.map((row) => row.artifactRef))];
}
