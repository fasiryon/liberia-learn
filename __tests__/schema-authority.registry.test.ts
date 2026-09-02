import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractPrismaDiffKeys,
  validateSchemaAuthorityDiff,
  type SchemaAuthorityRegistry,
} from "@/lib/db/schemaAuthority";

const repositoryRoot = path.resolve(__dirname, "..");
const registry = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "prisma/canonical/schema-authority-registry.json"), "utf8"),
) as SchemaAuthorityRegistry & { entries: Array<Record<string, unknown>> };
const postgresManifest = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "prisma/canonical/postgres-object-manifest.json"), "utf8"),
);

describe("layered schema authority registry", () => {
  it("uses specific exceptions with complete governance metadata", () => {
    expect(registry.authorityModel).toBe("LAYERED_SCHEMA_AUTHORITY_MODEL");
    expect(registry.entries.length).toBeGreaterThan(10);

    const keys = new Set<string>();
    for (const entry of registry.entries) {
      for (const field of [
        "id", "objectType", "objectNames", "prismaState", "physicalState",
        "authorityLayer", "classification", "rationale", "risk", "owner",
        "introducedBy", "evidence", "reviewCondition", "destructiveIfAutoConverged",
        "expectedInProduction", "expectedInStaging", "expectedInCleanBootstrap",
      ]) {
        expect(entry[field], `${String(entry.id)}.${field}`).not.toBeUndefined();
      }
      for (const key of entry.allowedPrismaDiffKeys as string[]) {
        expect(key).not.toContain("*");
        expect(keys.has(key), `duplicate ${key}`).toBe(false);
        keys.add(key);
      }
    }
  });

  it("parses multi-column Prisma alter statements without broad matching", () => {
    expect(extractPrismaDiffKeys(`
      ALTER TABLE "VirtualLab" ALTER COLUMN "equipmentList" DROP DEFAULT,
      ALTER COLUMN "updatedAt" DROP DEFAULT;
      DROP TABLE "TrendSnapshot";
    `)).toEqual([
      "default:VirtualLab.equipmentList:drop",
      "default:VirtualLab.updatedAt:drop",
      "table:TrendSnapshot:drop",
    ]);
  });

  it("fails an unregistered destructive difference", () => {
    const minimal: SchemaAuthorityRegistry = {
      schemaVersion: 1,
      authorityModel: "LAYERED_SCHEMA_AUTHORITY_MODEL",
      entries: [],
    };
    const result = validateSchemaAuthorityDiff('DROP TABLE "Student";', minimal);
    expect(result.ok).toBe(false);
    expect(result.unregisteredKeys).toEqual(["table:Student:drop"]);
    expect(result.destructiveKeys).toEqual(["table:Student:drop"]);
  });

  it("pins every required PostgreSQL object and security invariant", () => {
    const requiredObjects = [
      ...postgresManifest.tables,
      ...postgresManifest.indexes,
      ...postgresManifest.constraints,
      ...postgresManifest.functions,
      ...postgresManifest.triggers,
    ] as Array<{ name: string; required: boolean; definitionMd5: string | null }>;

    for (const entry of requiredObjects.filter((candidate) => candidate.required)) {
      expect(entry.definitionMd5, entry.name).toMatch(/^[a-f0-9]{32}$/);
    }
    expect(postgresManifest.tables.map((entry: { name: string }) => entry.name)).toContain("TrendSnapshot");
    expect(postgresManifest.indexes.map((entry: { name: string }) => entry.name)).toEqual(
      expect.arrayContaining([
        "rag_chunk_embedding_idx",
        "curriculum_content_embedding_idx",
        "InterventionRecommendation_idempotencyKey_key",
        "ReviewerCredential_id_reviewerProfileId_key",
      ]),
    );
    expect(postgresManifest.constraints.map((entry: { name: string }) => entry.name)).toEqual(
      expect.arrayContaining([
        "CurriculumReviewAssessment_credential_profile_fkey",
        "CurriculumReviewAssessment_scope_credential_fkey",
        "CurriculumReviewAssignment_credential_profile_fkey",
        "CurriculumReviewAssignment_scope_credential_fkey",
      ]),
    );
    expect(postgresManifest.security.rls).toMatchObject({
      selector: "ALL_PUBLIC_TABLES",
      expectedTableCount: 233,
      expectedEnabledCount: 233,
    });
    expect(postgresManifest.security.grants.production.anonAuthenticatedGrantCount).toBe(0);
    expect(postgresManifest.security.grants.cleanBootstrap.p2cAnonAuthenticatedGrantCount).toBe(0);
  });
});
