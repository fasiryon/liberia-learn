CREATE TABLE "MoePolicyDirective" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "policyType" TEXT NOT NULL,
    "targetScope" TEXT NOT NULL,
    "targetFilters" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "updatedById" TEXT,
    "districtId" TEXT,
    "schoolId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "auditMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoePolicyDirective_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MoeDirectiveApplication" (
    "id" TEXT NOT NULL,
    "directiveId" TEXT NOT NULL,
    "schoolId" TEXT,
    "classId" TEXT,
    "grade" INTEGER,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'needs_review',
    "appliedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoeDirectiveApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MoePolicyDirective_status_targetScope_createdAt_idx" ON "MoePolicyDirective"("status", "targetScope", "createdAt");
CREATE INDEX "MoePolicyDirective_policyType_status_idx" ON "MoePolicyDirective"("policyType", "status");
CREATE INDEX "MoePolicyDirective_districtId_schoolId_idx" ON "MoePolicyDirective"("districtId", "schoolId");

CREATE UNIQUE INDEX "MoeDirectiveApplication_directiveId_schoolId_classId_grade_subject_key" ON "MoeDirectiveApplication"("directiveId", "schoolId", "classId", "grade", "subject");
CREATE INDEX "MoeDirectiveApplication_directiveId_status_idx" ON "MoeDirectiveApplication"("directiveId", "status");
CREATE INDEX "MoeDirectiveApplication_schoolId_status_idx" ON "MoeDirectiveApplication"("schoolId", "status");
CREATE INDEX "MoeDirectiveApplication_grade_subject_status_idx" ON "MoeDirectiveApplication"("grade", "subject", "status");

ALTER TABLE "MoePolicyDirective" ADD CONSTRAINT "MoePolicyDirective_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MoePolicyDirective" ADD CONSTRAINT "MoePolicyDirective_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MoePolicyDirective" ADD CONSTRAINT "MoePolicyDirective_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MoePolicyDirective" ADD CONSTRAINT "MoePolicyDirective_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MoePolicyDirective" ADD CONSTRAINT "MoePolicyDirective_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MoeDirectiveApplication" ADD CONSTRAINT "MoeDirectiveApplication_directiveId_fkey" FOREIGN KEY ("directiveId") REFERENCES "MoePolicyDirective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MoeDirectiveApplication" ADD CONSTRAINT "MoeDirectiveApplication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MoeDirectiveApplication" ADD CONSTRAINT "MoeDirectiveApplication_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
