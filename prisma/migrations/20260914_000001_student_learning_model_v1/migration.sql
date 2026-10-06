-- Student Learning Model V1: canonical Grade 4 fractions concept state.
-- This migration creates new bounded authority tables only. It does not
-- migrate, reinterpret, or mutate legacy mastery data.

CREATE TABLE "GovernedLearningEvidence" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "learnerUserId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "ontologyReleaseId" TEXT NOT NULL,
  "ontologyReleaseIdentity" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "conceptRevision" INTEGER NOT NULL,
  "bindingId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "itemVersion" TEXT NOT NULL,
  "evidencePolicyId" TEXT NOT NULL,
  "evidencePolicyVersion" TEXT NOT NULL,
  "toolPolicyId" TEXT NOT NULL,
  "toolPolicyVersion" TEXT NOT NULL,
  "context" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "diagnosticKind" TEXT,
  "correct" BOOLEAN NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "observationFingerprint" TEXT NOT NULL,
  "ledgerSequence" INTEGER NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernedLearningEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedLearningEvidence_conceptRevision_check" CHECK ("conceptRevision" > 0),
  CONSTRAINT "GovernedLearningEvidence_ledgerSequence_check" CHECK ("ledgerSequence" > 0),
  CONSTRAINT "GovernedLearningEvidence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GovernedLearningEvidence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GovernedLearningEvidence_learnerUserId_fkey" FOREIGN KEY ("learnerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GovernedLearningEvidence_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GovernedEvidence_school_student_idempotency_key"
  ON "GovernedLearningEvidence"("schoolId", "studentId", "idempotencyKey");
CREATE UNIQUE INDEX "GovernedEvidence_partition_sequence_key"
  ON "GovernedLearningEvidence"("schoolId", "studentId", "ontologyReleaseIdentity", "conceptId", "conceptRevision", "ledgerSequence");
CREATE INDEX "GovernedLearningEvidence_partition_admittedAt_idx"
  ON "GovernedLearningEvidence"("schoolId", "studentId", "ontologyReleaseIdentity", "conceptId", "conceptRevision", "admittedAt");
CREATE INDEX "GovernedLearningEvidence_learnerUserId_admittedAt_idx"
  ON "GovernedLearningEvidence"("learnerUserId", "admittedAt");
CREATE INDEX "GovernedLearningEvidence_actorUserId_admittedAt_idx"
  ON "GovernedLearningEvidence"("actorUserId", "admittedAt");

CREATE TABLE "StudentConceptState" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "ontologyReleaseId" TEXT NOT NULL,
  "ontologyReleaseIdentity" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "conceptRevision" INTEGER NOT NULL,
  "masteryEstimate" DOUBLE PRECISION NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "uncertainty" DOUBLE PRECISION NOT NULL,
  "evidenceCount" INTEGER NOT NULL,
  "firstObservedAt" TIMESTAMP(3) NOT NULL,
  "lastObservedAt" TIMESTAMP(3) NOT NULL,
  "lastPracticedAt" TIMESTAMP(3),
  "stateRevision" INTEGER NOT NULL,
  "algorithmVersion" TEXT NOT NULL,
  "evidenceState" TEXT NOT NULL,
  "reasonCodes" JSONB NOT NULL,
  "throughEvidenceSequence" INTEGER NOT NULL,
  "stateHash" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentConceptState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentConceptState_values_check" CHECK (
    "masteryEstimate" BETWEEN 0 AND 1 AND
    "confidence" BETWEEN 0 AND 1 AND
    "uncertainty" BETWEEN 0 AND 1 AND
    "evidenceCount" > 0 AND
    "stateRevision" > 0 AND
    "throughEvidenceSequence" > 0
  ),
  CONSTRAINT "StudentConceptState_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudentConceptState_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StudentConceptState_partition_key"
  ON "StudentConceptState"("schoolId", "studentId", "ontologyReleaseIdentity", "conceptId", "conceptRevision");
CREATE INDEX "StudentConceptState_schoolId_studentId_updatedAt_idx"
  ON "StudentConceptState"("schoolId", "studentId", "updatedAt");
CREATE INDEX "StudentConceptState_studentId_conceptId_idx"
  ON "StudentConceptState"("studentId", "conceptId");

CREATE TABLE "MasteryUpdate" (
  "id" TEXT NOT NULL,
  "stateId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "acceptedEvidenceId" TEXT NOT NULL,
  "ontologyReleaseId" TEXT NOT NULL,
  "ontologyReleaseIdentity" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "conceptRevision" INTEGER NOT NULL,
  "priorRevision" INTEGER NOT NULL,
  "newRevision" INTEGER NOT NULL,
  "algorithmVersion" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "priorEstimate" DOUBLE PRECISION,
  "newEstimate" DOUBLE PRECISION NOT NULL,
  "priorConfidence" DOUBLE PRECISION,
  "newConfidence" DOUBLE PRECISION NOT NULL,
  "priorUncertainty" DOUBLE PRECISION,
  "newUncertainty" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "reasonCodes" JSONB NOT NULL,
  "stateHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MasteryUpdate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MasteryUpdate_revision_check" CHECK ("priorRevision" >= 0 AND "newRevision" = "priorRevision" + 1),
  CONSTRAINT "MasteryUpdate_values_check" CHECK (
    "newEstimate" BETWEEN 0 AND 1 AND
    "newConfidence" BETWEEN 0 AND 1 AND
    "newUncertainty" BETWEEN 0 AND 1
  ),
  CONSTRAINT "MasteryUpdate_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "StudentConceptState"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MasteryUpdate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MasteryUpdate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MasteryUpdate_acceptedEvidenceId_fkey" FOREIGN KEY ("acceptedEvidenceId") REFERENCES "GovernedLearningEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MasteryUpdate_acceptedEvidenceId_key" ON "MasteryUpdate"("acceptedEvidenceId");
CREATE UNIQUE INDEX "MasteryUpdate_state_revision_key" ON "MasteryUpdate"("stateId", "newRevision");
CREATE INDEX "MasteryUpdate_school_student_concept_createdAt_idx"
  ON "MasteryUpdate"("schoolId", "studentId", "conceptId", "createdAt");
CREATE INDEX "MasteryUpdate_stateId_createdAt_idx" ON "MasteryUpdate"("stateId", "createdAt");

CREATE OR REPLACE FUNCTION reject_student_learning_model_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER governed_learning_evidence_no_update_or_delete
BEFORE UPDATE OR DELETE ON "GovernedLearningEvidence"
FOR EACH ROW EXECUTE FUNCTION reject_student_learning_model_history_mutation();

CREATE TRIGGER governed_learning_evidence_no_truncate
BEFORE TRUNCATE ON "GovernedLearningEvidence"
FOR EACH STATEMENT EXECUTE FUNCTION reject_student_learning_model_history_mutation();

CREATE TRIGGER mastery_update_no_update_or_delete
BEFORE UPDATE OR DELETE ON "MasteryUpdate"
FOR EACH ROW EXECUTE FUNCTION reject_student_learning_model_history_mutation();

CREATE TRIGGER mastery_update_no_truncate
BEFORE TRUNCATE ON "MasteryUpdate"
FOR EACH STATEMENT EXECUTE FUNCTION reject_student_learning_model_history_mutation();

ALTER TABLE "GovernedLearningEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentConceptState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MasteryUpdate" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "GovernedLearningEvidence", "StudentConceptState", "MasteryUpdate" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "GovernedLearningEvidence", "StudentConceptState", "MasteryUpdate" FROM authenticated;
  END IF;
END;
$$;
