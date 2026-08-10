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
