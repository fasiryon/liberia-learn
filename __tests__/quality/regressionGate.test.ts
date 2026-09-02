import { describe, expect, it, beforeEach } from "vitest";
import { resetFixtureRegistryForTests, listFixtures } from "@/lib/quality/fixtureRegistry";
import { loadRegressionFixtures } from "@/lib/quality/fixtures/regression";
import { evaluateFixtureDeterministically } from "@/lib/quality/qualityGate.test-adapter";

describe("regression fixture set", () => {
  beforeEach(() => resetFixtureRegistryForTests());

  it("preserves at least 5 real historical defects with APPROVED status", () => {
    loadRegressionFixtures();
    const fixtures = listFixtures({ domain: "regression" });
    expect(fixtures.length).toBeGreaterThanOrEqual(5);
    for (const fixture of fixtures) {
      expect(fixture.reviewStatus).toBe("APPROVED");
      expect(fixture.source).not.toBe("manual");
    }
  });
});

describe("CI regression gate", () => {
  beforeEach(() => resetFixtureRegistryForTests());

  it("every regression fixture still passes its expected behavior deterministically", async () => {
    loadRegressionFixtures();
    const results = await Promise.all(
      listFixtures({ domain: "regression" }).map(evaluateFixtureDeterministically)
    );
    const failed = results.filter((r) => !r.passed);
    expect(failed).toEqual([]);
  });
});
