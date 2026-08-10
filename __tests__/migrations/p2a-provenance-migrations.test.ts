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
    expect(nullRejectionAssertion).toContain('"riskReasons",');
    expect(nullRejectionAssertion).toContain("NULL,");
    expect(nullRejectionAssertion).toContain("WHEN not_null_violation");
    expect(nullRejectionAssertion).toContain(
      "direct SQL NULL was accepted"
    );
    expect(nullRejectionAssertion).toContain(
      'RETURNING cardinality("riskReasons")'
    );
    expect(nullRejectionAssertion).toContain("ROLLBACK;");
  });
});

describe("P2-A AI generation correlation migrations", () => {
  it("adds a nullable column without a default or backfill", () => {
    const executableSql = migrationB1.replace(/^--.*$/gm, "");
    expect(migrationB1).toContain(
      'ADD COLUMN "generationCorrelationId" TEXT'
    );
    expect(executableSql).not.toMatch(/DEFAULT|UPDATE\s+"AIInteraction"/i);
  });

  it("creates the live-table index concurrently without transaction wrappers", () => {
    expect(migrationB2).toContain("CREATE INDEX CONCURRENTLY IF NOT EXISTS");
    expect(migrationB2).toContain(
      '"AIInteraction_generationCorrelationId_createdAt_idx"'
    );
    expect(migrationB2).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/im);
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
      "allowed projection update",
      "CurriculumProvenance identity update",
      "cross-root currentRevisionId update",
      "same-root currentRevisionId update",
    ];

    for (const assertion of requiredAssertions) {
      expect(guardAssertion).toContain(assertion);
    }
    expect(guardAssertion).toContain("ROLLBACK;");
  });
});
