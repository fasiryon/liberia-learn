import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const migrationA = readFileSync(
  resolve(
    root,
    "prisma/migrations/20260810_000001_p2a_curriculum_provenance_core/migration.sql"
  ),
  "utf8"
);
const nullRejectionAssertion = readFileSync(
  resolve(root, "prisma/migrations/verification/p2a-risk-reasons-null-rejection.sql"),
  "utf8"
);
const migrationB1 = readFileSync(
  resolve(
    root,
    "prisma/migrations/20260810_000002_p2a_ai_generation_correlation/migration.sql"
  ),
  "utf8"
);
const migrationB2 = readFileSync(
  resolve(
    root,
    "prisma/migrations/20260810_000003_p2a_ai_generation_correlation_index/migration.sql"
  ),
  "utf8"
);
const migrationC = readFileSync(
  resolve(
    root,
    "prisma/migrations/20260810_000004_p2a_curriculum_provenance_immutability/migration.sql"
  ),
  "utf8"
);
const guardAssertion = readFileSync(
  resolve(root, "prisma/migrations/verification/p2a-immutability-and-root-guards.sql"),
  "utf8"
);
const readOnlyAssertion = readFileSync(
  resolve(root, "prisma/migrations/verification/p2a-post-migration-readonly.sql"),
  "utf8"
);
const stagingRunbook = readFileSync(
  resolve(root, "docs/ops/P2A_STAGING_MIGRATION_RUNBOOK.md"),
  "utf8"
);

describe("P2-A provenance Migration A", () => {
  it("defines the approved 14-enum set", () => {
    const approvedEnums = [
      "CurriculumProvenanceCompleteness",
      "CurriculumLifecycleState",
      "CurriculumRevisionKind",
      "CurriculumOriginKind",
      "CurriculumGovernanceEventType",
      "CurriculumGovernanceActorType",
      "CurriculumApprovalBasis",
      "CurriculumReviewAuthority",
      "CurriculumFutureAssignmentPolicy",
      "CurriculumExistingAssignmentPolicy",
      "CurriculumOfflineCachePolicy",
      "CurriculumEvidenceType",
      "CurriculumEvidencePurpose",
      "CurriculumEvidenceStatus",
    ];

    expect(approvedEnums).toHaveLength(14);
    for (const enumName of approvedEnums) {
      expect(schema).toContain(`enum ${enumName} {`);
      expect(migrationA).toContain(`CREATE TYPE "${enumName}" AS ENUM`);
    }
  });

  it("keeps riskReasons required in Prisma", () => {
    expect(schema).toMatch(/riskReasons\s+String\[\]\s+@default\(\[\]\)/);
  });

  it("enforces no NULL riskReasons in PostgreSQL", () => {
    expect(migrationA).toContain(
      '"riskReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]'
    );
  });

  it("ships a rollback-only direct SQL assertion for NULL rejection and [] defaulting", () => {
    expect(nullRejectionAssertion).toContain("SET LOCAL search_path = public, pg_catalog");
    expect(nullRejectionAssertion).toContain("schema_nullable IS DISTINCT FROM 'NO'");
    expect(nullRejectionAssertion).toContain('"riskReasons",');
    expect(nullRejectionAssertion).toContain("NULL,");
    expect(nullRejectionAssertion).toContain("WHEN not_null_violation");
    expect(nullRejectionAssertion).toContain(
      "direct SQL NULL was accepted"
    );
    expect(nullRejectionAssertion).toContain('RETURNING "riskReasons"');
    expect(nullRejectionAssertion).toContain("default_reasons IS NULL");
    expect(nullRejectionAssertion).toContain("cardinality(default_reasons) <> 0");
    expect(nullRejectionAssertion).toContain("ROLLBACK;");
  });

  it("sets fail-fast metadata-lock and bounded statement timeouts", () => {
    expect(migrationA).toContain("SET lock_timeout = '5s';");
    expect(migrationA).toContain("SET statement_timeout = '5min';");
    expect(migrationA).toContain("RESET statement_timeout;");
    expect(migrationA).toContain("RESET lock_timeout;");
  });
});

describe("P2-A AI generation correlation migrations", () => {
  it("adds a nullable column without a default or backfill", () => {
    const executableSql = migrationB1.replace(/^--.*$/gm, "");
    expect(migrationB1).toContain(
      'ADD COLUMN "generationCorrelationId" TEXT'
    );
    expect(executableSql).not.toMatch(/DEFAULT|UPDATE\s+"AIInteraction"/i);
    expect(migrationB1).toContain("SET lock_timeout = '5s';");
    expect(migrationB1).toContain("SET statement_timeout = '5min';");
  });

  it("creates the live-table index concurrently without transaction wrappers", () => {
    expect(migrationB2).toContain("CREATE INDEX CONCURRENTLY IF NOT EXISTS");
    expect(migrationB2).toContain(
      '"AIInteraction_generationCorrelationId_createdAt_idx"'
    );
    expect(migrationB2).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/im);
    expect(migrationB2).toContain("SET lock_timeout = '5s';");
    expect(migrationB2).toContain("SET statement_timeout = '0';");
  });
});

describe("P2-A immutability and root guards", () => {
  it("installs mutation rejection and current-revision ownership triggers", () => {
    expect(migrationC).toContain(
      "curriculum_content_revision_no_update_or_delete"
    );
    expect(migrationC).toContain(
      "curriculum_governance_event_no_update_or_delete"
    );
    expect(migrationC).toContain("curriculum_evidence_no_update_or_delete");
    expect(migrationC).toContain("curriculum_provenance_no_delete");
    expect(migrationC).toContain("curriculum_provenance_identity_no_update");
    expect(migrationC).toContain("curriculum_provenance_current_revision_guard");
    expect(migrationC).toContain("SET lock_timeout = '5s';");
    expect(migrationC).toContain("SET statement_timeout = '5min';");
  });

  it("ships rollback-only assertions for every approved staging guard case", () => {
    const requiredAssertions = [
      "CurriculumContentRevision UPDATE",
      "CurriculumContentRevision DELETE",
      "CurriculumContentRevision TRUNCATE",
      "CurriculumGovernanceEvent UPDATE",
      "CurriculumGovernanceEvent DELETE",
      "CurriculumGovernanceEvent TRUNCATE",
      "CurriculumEvidence UPDATE",
      "CurriculumEvidence DELETE",
      "CurriculumEvidence TRUNCATE",
      "CurriculumProvenance DELETE",
      "CurriculumProvenance TRUNCATE",
      "allowed lifecycle/completeness projection update",
      "CurriculumProvenance identity update",
      "cross-root currentRevisionId update",
      "same-root currentRevisionId update",
    ];

    for (const assertion of requiredAssertions) {
      expect(guardAssertion).toContain(assertion);
    }
    expect(guardAssertion).toContain("expected_sqlstate");
    expect(guardAssertion).toContain("expected_message_fragment");
    expect(guardAssertion).toContain("produced unexpected rejection");
    expect(guardAssertion).toContain("unexpectedly succeeded");
    expect(guardAssertion).toContain("SET LOCAL search_path = public, pg_catalog");
    expect(guardAssertion).toContain("ROLLBACK;");
  });
});

describe("P2-A final read-only verification", () => {
  it("contains only SELECT or WITH SQL statements", () => {
    const executableSql = readOnlyAssertion
      .replace(/^\s*--.*$/gm, "")
      .replace(/^\s*\\.*$/gm, "")
      .replace(/'(?:''|[^'])*'/g, "''");
    const statements = executableSql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement).toMatch(/^(SELECT|WITH)\b/i);
    }
    expect(readOnlyAssertion).not.toMatch(/prisma\s+migrate\s+resolve/i);
  });

  it("checks every required post-migration invariant", () => {
    const requiredEvidence = [
      "installed_enum_count",
      "CurriculumProvenance",
      "CurriculumContentRevision",
      "CurriculumGovernanceEvent",
      "CurriculumEvidence",
      "risk_reasons_assertion",
      "generation_correlation_assertion",
      "b2_index_assertion",
      "trigger_assertion",
      "foreign_key_assertion",
      "unique_index_assertion",
      "migration_state_assertion",
      "curriculum_content_column_assertion",
    ];

    for (const evidence of requiredEvidence) {
      expect(readOnlyAssertion).toContain(evidence);
    }
  });

  it("documents exact timeout policy and timeout STOP behavior", () => {
    expect(stagingRunbook).toContain("| A | `5s` | `5min`");
    expect(stagingRunbook).toContain("| B1 | `5s` | `5min`");
    expect(stagingRunbook).toContain("| B2 | `5s` | `0`");
    expect(stagingRunbook).toContain("| C | `5s` | `5min`");
    expect(stagingRunbook).toContain("SQLSTATE 55P03");
    expect(stagingRunbook).toContain("SQLSTATE 57014");
    expect(stagingRunbook).toContain("mandatory STOP condition");
  });
});
