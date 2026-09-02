export type QualityFixtureDomain = "red_team" | "regression";
export type QualityFixtureDimension = { age?: string; subject?: string; language?: string; safetyCategory?: string };
export type QualityFixtureVerdict = "SAFE" | "UNSAFE" | "REFUSE" | "HELPFUL" | "GROUNDED" | "UNGROUNDED";
export type QualityFixture = {
  fixtureId: string;
  version: number;
  domain: QualityFixtureDomain;
  dimension: QualityFixtureDimension;
  input: { prompt: string; context?: string };
  expectedBehavior: { verdict: QualityFixtureVerdict; notes: string };
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  source: string;
  owner: string;
  reviewStatus: "DRAFT" | "APPROVED";
  createdAt: string;
  updatedAt: string;
  replacesFixtureVersion?: number;
  tags: string[];
};

const registry = new Map<string, Map<number, QualityFixture>>();

export function resetFixtureRegistryForTests(): void {
  registry.clear();
}

export function registerFixture(fixture: QualityFixture): void {
  const versions = registry.get(fixture.fixtureId) ?? new Map<number, QualityFixture>();
  const existing = versions.get(fixture.version);
  if (existing && JSON.stringify(existing) !== JSON.stringify(fixture)) {
    throw new Error(`fixture_version_immutable:${fixture.fixtureId}@${fixture.version}`);
  }
  versions.set(fixture.version, fixture);
  registry.set(fixture.fixtureId, versions);
}

export function getFixture(fixtureId: string, version?: number): QualityFixture | undefined {
  const versions = registry.get(fixtureId);
  if (!versions) return undefined;
  if (version !== undefined) return versions.get(version);
  return latestVersion(fixtureId);
}

export function latestVersion(fixtureId: string): QualityFixture | undefined {
  const versions = registry.get(fixtureId);
  if (!versions || versions.size === 0) return undefined;
  return [...versions.values()].sort((a, b) => b.version - a.version)[0];
}

function matchesDimension(fixture: QualityFixture, filter?: Partial<QualityFixtureDimension>): boolean {
  if (!filter) return true;
  return Object.entries(filter).every(([key, value]) => fixture.dimension[key as keyof QualityFixtureDimension] === value);
}

export function listFixtures(filter?: Partial<Pick<QualityFixture, "domain">> & { dimension?: Partial<QualityFixtureDimension> }): QualityFixture[] {
  const all = [...registry.values()].map((versions) => latestVersion([...versions.values()][0].fixtureId)!).filter(Boolean);
  return all.filter((fixture) => (!filter?.domain || fixture.domain === filter.domain) && matchesDimension(fixture, filter?.dimension));
}
