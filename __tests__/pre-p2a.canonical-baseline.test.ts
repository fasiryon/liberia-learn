import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function bytes(path: string): Buffer {
  return readFileSync(join(root, path));
}

function text(path: string): string {
  return bytes(path).toString("utf8");
}

function sha256(path: string): string {
  return createHash("sha256").update(bytes(path)).digest("hex");
}

const legacyManifest = JSON.parse(text("prisma/legacy-migration-manifest.json"));
const baselineCatalog = JSON.parse(text("prisma/canonical/catalog-manifest.json"));
const postHardeningCatalog = JSON.parse(
  text("prisma/canonical/post-hardening-catalog-manifest.json"),
);

describe("canonical pre-P2-A baseline", () => {
  it("makes reference-seed evidence independent of provider collation", () => {
    const evidenceQuery = text("scripts/pre-p2a-reference-seed-evidence.sql");
    expect(evidenceQuery.match(/COLLATE "C"/g)).toHaveLength(4);
    expect(evidenceQuery).toContain('"subject"::text COLLATE "C"');
  });

  it("freezes every legacy migration through the cutover byte for byte", () => {
    expect(legacyManifest.cutover.lastLegacyMigration).toBe(
      "20260728_000002_teaching_turn_sequence",
    );
    expect(legacyManifest.legacyMigrations).toHaveLength(128);
    expect(legacyManifest.repositoryAbsentProductionMigrations).toHaveLength(18);

    for (const migration of legacyManifest.legacyMigrations) {
      const fullPath = join(root, migration.path);
      expect(statSync(fullPath).size, migration.migrationName).toBe(migration.fileBytes);
      expect(sha256(migration.path), migration.migrationName).toBe(migration.sha256);
    }

    const initial = legacyManifest.legacyMigrations[0];
    expect(initial.encoding).toBe("utf-16le-bom");
    expect(bytes(initial.path).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xfe]));
  });

  it("keeps the production capture schema-only and the normalization deterministic", () => {
    const capture = JSON.parse(
      text("prisma/canonical/source/production-public-schema.capture.json"),
    );
    const raw = text("prisma/canonical/source/production-public-schema.raw.sql");
    const normalization = JSON.parse(text("prisma/canonical/normalization-manifest.json"));

    expect(capture.sourceProjectRef).toBe("bnphuinpvgpmebcsvmsp");
    expect(capture.sourceServerVersion).toBe("17.6");
    expect(capture.captureTool).toMatch(/PostgreSQL\) 17\./);
    expect(capture.containsRowData).toBe(false);
    expect(capture.containsCredentials).toBe(false);
    expect(raw).not.toMatch(/^\s*(COPY|INSERT\s+INTO)\s+/im);
    expect(sha256("prisma/canonical/source/production-public-schema.raw.sql")).toBe(
      capture.artifactSha256,
    );
    expect(normalization.canonicalBaselineSha256).toBe(
      "53a20e408463eb7ead872d820c137b2c0420bf969229c776011d573ed16a73f8",
    );
    expect(
      sha256(
        "prisma/canonical/migrations/20260728_000003_canonical_production_state_baseline/migration.sql",
      ),
    ).toBe(normalization.canonicalBaselineSha256);
  });

  it("preserves production-only objects and excludes forward-only intent", () => {
    const tableNames = baselineCatalog.tables.map((table: { name: string }) => table.name);
    const enumMap = new Map(
      baselineCatalog.enums.map((item: { name: string; labels: string[] }) => [
        item.name,
        item.labels,
      ]),
    );

    expect(tableNames).toContain("TrendSnapshot");
    expect(tableNames).toContain("_SkillToStandard");
    expect(tableNames).not.toContain("_prisma_migrations");
    expect(tableNames).not.toContain("PolicyConfig");
    expect(tableNames).not.toContain("PolicyOverride");
    expect(tableNames).not.toContain("PrivilegedIdentity");
    expect(tableNames).not.toContain("PrivilegedSessionAssurance");
    expect(enumMap.has("PolicyScope")).toBe(false);
    expect(enumMap.get("Role")).not.toContain("MOE_SUPER_ADMIN");
    expect(enumMap.get("Role")).not.toContain("MOE_DISTRICT_ADMIN");

    const user = baselineCatalog.tables.find(
      (table: { name: string }) => table.name === "User",
    );
    expect(user.columns.map((column: { name: string }) => column.name)).toContain(
      "welcomeCompletedAt",
    );
  });

  it("keeps reviewed privileged hardening as an exact forward delta", () => {
    const legacyForward =
      "prisma/migrations/20260803_000001_privileged_identity_hardening/migration.sql";
    const canonicalForward =
      "prisma/canonical/migrations/20260803_000001_privileged_identity_hardening/migration.sql";
    expect(sha256(canonicalForward)).toBe(sha256(legacyForward));
    expect(sha256(canonicalForward)).toBe(
      "1d313776b8e54cb4812425f5438ccff4637b245cf4b74574489371fd2140b211",
    );

    const before = new Set(
      baselineCatalog.tables.map((table: { name: string }) => table.name),
    );
    const added = postHardeningCatalog.tables
      .map((table: { name: string }) => table.name)
      .filter((name: string) => !before.has(name));
    expect(added).toEqual(["PrivilegedIdentity", "PrivilegedSessionAssurance"]);
    expect(postHardeningCatalog.enums).toEqual(baselineCatalog.enums);
  });

  it("uses explicit deterministic idempotent reference seed tooling", () => {
    const seed = text(
      "prisma/canonical/seeds/20260811_000001_essential_reference_v1.sql",
    );
    expect(seed).toContain("BEGIN;");
    expect(seed).toContain("COMMIT;");
    expect(seed.match(/ON CONFLICT/g)).toHaveLength(3);
    expect(seed).toContain("DO UPDATE SET");
    expect(seed).not.toMatch(/gen_random_uuid|uuid_generate/i);
    expect(seed).not.toMatch(/INSERT INTO\s+"?(User|Student|Guardian|AuditLog)"?/i);
  });

  it("proves static P2-A compatibility without executing or changing P2-A", () => {
    const expectedHashes: Record<string, string> = {
      "20260810_000001_p2a_curriculum_provenance_core":
        "d4ab65c9d577a75c1b37d96525971b928ef985926d9af9cfba21b5c0df48c7f7",
      "20260810_000002_p2a_ai_generation_correlation":
        "48c3c49f0f32026d815ec4135d886de7b7a3d10a80e0ccddbb3100162c6c7ab7",
      "20260810_000003_p2a_ai_generation_correlation_index":
        "234b635d51d628a46c24f140c5ef186db045986fd21594eee63f6029f4427ae6",
      "20260810_000004_p2a_curriculum_provenance_immutability":
        "90be560eb65fb6b5efbb1afe15599bb475cd05e38119a21b2808693c0b844097",
    };
    for (const [migration, hash] of Object.entries(expectedHashes)) {
      expect(sha256(`prisma/migrations/${migration}/migration.sql`), migration).toBe(hash);
    }

    type CatalogTable = { name: string; columns: Array<{ name: string }> };
    const tables = new Map<string, CatalogTable>(
      postHardeningCatalog.tables.map(
        (table: CatalogTable): [string, CatalogTable] => [table.name, table],
      ),
    );
    for (const required of ["AIInteraction", "User", "AuditLog", "CurriculumContent"]) {
      expect(tables.has(required), required).toBe(true);
    }
    const curriculumColumns = tables
      .get("CurriculumContent")!
      .columns.map((column) => column.name);
    expect(curriculumColumns).not.toContain("provenance");

    const p2aObjectNames = [
      "CurriculumProvenance",
      "CurriculumContentRevision",
      "CurriculumGovernanceEvent",
      "CurriculumEvidence",
    ];
    for (const objectName of p2aObjectNames) {
      expect(tables.has(objectName), objectName).toBe(false);
    }
    expect(postHardeningCatalog.extensions).toEqual([
      { name: "vector", schema: "public", version: "0.8.0" },
    ]);
  });

  it("keeps the canonical root isolated from the immutable legacy root", () => {
    const canonicalMigrationDirectories = readdirSync(
      join(root, "prisma/canonical/migrations"),
      { withFileTypes: true },
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(canonicalMigrationDirectories).toEqual([
      "20260728_000003_canonical_production_state_baseline",
      "20260803_000001_privileged_identity_hardening",
    ]);
  });
});
