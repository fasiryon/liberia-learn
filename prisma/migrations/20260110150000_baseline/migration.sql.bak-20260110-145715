-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum


-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateEnum
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "hashedPwd" TEXT,
    "name" TEXT,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Monrovia',
    "primaryHex" TEXT,
    "secondaryHex" TEXT,
    "accentHex" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "county" TEXT,
    "community" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relation" TEXT,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Standard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "band" "GradeBand" NOT NULL,

    CONSTRAINT "Standard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "band" "GradeBand" NOT NULL,
    "descriptor" TEXT NOT NULL,
    "examples" JSONB,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "standardId" TEXT,
    "subject" "Subject" NOT NULL,
    "band" "GradeBand" NOT NULL,
    "title" TEXT NOT NULL,
    "weeks" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objectives" JSONB NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 45,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeItem" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "stimulus" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "answerKey" JSONB,
    "hints" JSONB,

    CONSTRAINT "PracticeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "classId" TEXT,
    "unitId" TEXT,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentItem" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "practiceItemId" TEXT,
    "rubric" JSONB,
    "points" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AssessmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "score" INTEGER,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "letter" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasteryRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "lastAssessedAt" TIMESTAMP(3),

    CONSTRAINT "MasteryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewSchedule" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "nextAt" TIMESTAMP(3) NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 7,

    CONSTRAINT "ReviewSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "classId" TEXT,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "points" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "turnedInAt" TIMESTAMP(3),
    "score" INTEGER,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapstoneProject" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "repoUrl" TEXT,
    "mentorId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "CapstoneProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "thumbnail" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capstoneProjectId" TEXT,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerContact" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,

    CONSTRAINT "PartnerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerProgram" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PartnerProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockScheduleTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slots" JSONB NOT NULL,
    "level" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockScheduleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "config" JSONB,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMetric" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "tasksFailed" INTEGER NOT NULL DEFAULT 0,
    "avgDurationMs" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SystemEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationWorkOrder" (
    "id" TEXT NOT NULL,
    "ewoId" TEXT NOT NULL,
    "ewoType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "target" JSONB NOT NULL,
    "constraints" JSONB NOT NULL,
    "batchRules" JSONB,
    "artifacts" JSONB NOT NULL,
    "history" JSONB[],
    "childEwos" TEXT[],
    "parentEwoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3),
    "initiator" TEXT,

    CONSTRAINT "EducationWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumContent" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hash" TEXT,
    "payload" JSONB NOT NULL,

    CONSTRAINT "CurriculumContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumAsset" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sizeKb" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "altText" TEXT,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "lastCached" TIMESTAMP(3),

    CONSTRAINT "CurriculumAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernedArtifact" (
    "id" TEXT NOT NULL,
    "ewoId" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agent1Path" TEXT,
    "agent5Path" TEXT,
    "appliedPatch" BOOLEAN NOT NULL DEFAULT false,
    "curriculumContentId" TEXT,
    "decision" TEXT,
    "governanceModel" TEXT,
    "governancePath" TEXT,
    "governanceTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patchJson" JSONB,
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3),
    "artifactJson" JSONB NOT NULL,
    "governanceDecision" TEXT,
    "governanceReason" TEXT,

    CONSTRAINT "GovernedArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryRun" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "FactoryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "GradeCategory" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassGradePolicy" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "term" INTEGER NOT NULL DEFAULT 1,
    "weights" JSONB NOT NULL,
    "latePolicy" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassGradePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradableItem" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "GradableItemType" NOT NULL,
    "scoringType" "ScoringType" NOT NULL,
    "gradingMethod" "GradingMethod" NOT NULL,
    "countsTowardGrade" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "maxPoints" INTEGER DEFAULT 100,
    "dueAt" TIMESTAMP(3),
    "checkpointSequence" INTEGER,
    "improvementPolicy" JSONB,
    "publishedToParents" BOOLEAN NOT NULL DEFAULT false,
    "lockState" "GradeLockState" NOT NULL DEFAULT 'DRAFT',
    "lockedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradableItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradableItemObjective" (
    "id" TEXT NOT NULL,
    "gradableItemId" TEXT NOT NULL,
    "standardId" TEXT,
    "skillId" TEXT,
    "objectiveText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradableItemObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalEvaluator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "credentialRef" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalEvaluator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSubmission" (
    "id" TEXT NOT NULL,
    "gradableItemId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "members" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradableSubmission" (
    "id" TEXT NOT NULL,
    "gradableItemId" TEXT NOT NULL,
    "studentId" TEXT,
    "groupSubmissionId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "submissionType" "SubmissionType" NOT NULL DEFAULT 'ONLINE',
    "payload" JSONB NOT NULL,
    "recordedOffline" BOOLEAN NOT NULL DEFAULT false,
    "timeSpentMinutes" INTEGER,
    "excuseStatus" "ExcuseStatus" NOT NULL DEFAULT 'NONE',
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "turnedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradableSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeRecord" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "scorePoints" INTEGER,
    "scorePercent" DOUBLE PRECISION,
    "rubricResult" JSONB,
    "feedbackText" TEXT,
    "gradedByUserId" TEXT,
    "externalEvaluatorId" TEXT,
    "gradedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "aiConfidence" DOUBLE PRECISION,
    "humanReviewed" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeRevision" (
    "id" TEXT NOT NULL,
    "gradeRecordId" TEXT NOT NULL,
    "previousSnapshot" JSONB NOT NULL,
    "newSnapshot" JSONB NOT NULL,
    "revisedByUserId" TEXT,
    "revisionReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousHash" TEXT,
    "hash" TEXT,

    CONSTRAINT "GradeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeAppeal" (
    "id" TEXT NOT NULL,
    "gradeRecordId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'SUBMITTED',
    "resolutionType" "AppealResolutionType",
    "claimText" TEXT NOT NULL,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNotes" TEXT,

    CONSTRAINT "GradeAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeAuditFlag" (
    "id" TEXT NOT NULL,
    "gradeRecordId" TEXT NOT NULL,
    "flagType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,

    CONSTRAINT "GradeAuditFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectiveMasterySnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "masteryLevel" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "measurementType" "MasteryMeasurementType" NOT NULL,
    "contextNote" TEXT,

    CONSTRAINT "ObjectiveMasterySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasteryEvidence" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "sourceType" "EvidenceSourceType" NOT NULL,
    "weight" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "MasteryEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentIntervention" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "interventionType" "InterventionType" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "assignedByUserId" TEXT,

    CONSTRAINT "StudentIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterventionOutcome" (
    "interventionId" TEXT NOT NULL,
    "masteryBefore" DOUBLE PRECISION,
    "masteryAfter" DOUBLE PRECISION,
    "measuredAfterDays" INTEGER,
    "improvement" DOUBLE PRECISION,
    "success" BOOLEAN,
    "notes" TEXT,

    CONSTRAINT "InterventionOutcome_pkey" PRIMARY KEY ("interventionId")
);

-- CreateTable
CREATE TABLE "CohortBenchmark" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cohortType" "CohortType" NOT NULL,
    "cohortId" TEXT,
    "skillId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "medianMastery" DOUBLE PRECISION,
    "p25Mastery" DOUBLE PRECISION,
    "p75Mastery" DOUBLE PRECISION,
    "sampleSize" INTEGER,

    CONSTRAINT "CohortBenchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SkillToStandard" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SkillToStandard_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardian_studentId_guardianId_key" ON "StudentGuardian"("studentId", "guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_classId_key" ON "Enrollment"("studentId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_meetingId_studentId_key" ON "AttendanceRecord"("meetingId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Standard_code_key" ON "Standard"("code");

-- CreateIndex
CREATE INDEX "Standard_subject_band_idx" ON "Standard"("subject", "band");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_assessmentId_studentId_key" ON "Submission"("assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "Grade_classId_studentId_idx" ON "Grade"("classId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MasteryRecord_studentId_skillId_key" ON "MasteryRecord"("studentId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewSchedule_studentId_skillId_key" ON "ReviewSchedule"("studentId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_studentId_key" ON "AssignmentSubmission"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "AgentTask_agentId_status_idx" ON "AgentTask"("agentId", "status");

-- CreateIndex
CREATE INDEX "AgentTask_createdAt_idx" ON "AgentTask"("createdAt");

-- CreateIndex
CREATE INDEX "AgentMetric_agentId_timestamp_idx" ON "AgentMetric"("agentId", "timestamp");

-- CreateIndex
CREATE INDEX "SystemEvent_severity_createdAt_idx" ON "SystemEvent"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "SystemEvent_source_eventType_idx" ON "SystemEvent"("source", "eventType");

-- CreateIndex
CREATE INDEX "ChatMessage_studentId_createdAt_idx" ON "ChatMessage"("studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EducationWorkOrder_ewoId_key" ON "EducationWorkOrder"("ewoId");

-- CreateIndex
CREATE INDEX "EducationWorkOrder_status_idx" ON "EducationWorkOrder"("status");

-- CreateIndex
CREATE INDEX "EducationWorkOrder_ewoType_idx" ON "EducationWorkOrder"("ewoType");

-- CreateIndex
CREATE INDEX "EducationWorkOrder_priority_idx" ON "EducationWorkOrder"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumContent_contentId_key" ON "CurriculumContent"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumContent_hash_key" ON "CurriculumContent"("hash");

-- CreateIndex
CREATE INDEX "CurriculumContent_grade_subject_idx" ON "CurriculumContent"("grade", "subject");

-- CreateIndex
CREATE INDEX "CurriculumContent_contentType_status_idx" ON "CurriculumContent"("contentType", "status");

-- CreateIndex
CREATE INDEX "CurriculumAsset_lessonId_idx" ON "CurriculumAsset"("lessonId");

-- CreateIndex
CREATE INDEX "CurriculumAsset_cached_idx" ON "CurriculumAsset"("cached");

-- CreateIndex
CREATE UNIQUE INDEX "GovernedArtifact_ewoId_key" ON "GovernedArtifact"("ewoId");

-- CreateIndex
CREATE INDEX "GovernedArtifact_schemaId_idx" ON "GovernedArtifact"("schemaId");

-- CreateIndex
CREATE INDEX "GovernedArtifact_curriculumContentId_idx" ON "GovernedArtifact"("curriculumContentId");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryRun_runId_key" ON "FactoryRun"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "GradeCategory_classId_idx" ON "GradeCategory"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeCategory_classId_name_key" ON "GradeCategory"("classId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ClassGradePolicy_classId_key" ON "ClassGradePolicy"("classId");

-- CreateIndex
CREATE INDEX "ClassGradePolicy_classId_term_idx" ON "ClassGradePolicy"("classId", "term");

-- CreateIndex
CREATE UNIQUE INDEX "ClassGradePolicy_classId_term_key" ON "ClassGradePolicy"("classId", "term");

-- CreateIndex
CREATE INDEX "GradableItem_classId_type_idx" ON "GradableItem"("classId", "type");

-- CreateIndex
CREATE INDEX "GradableItem_categoryId_idx" ON "GradableItem"("categoryId");

-- CreateIndex
CREATE INDEX "GradableItem_lockState_idx" ON "GradableItem"("lockState");

-- CreateIndex
CREATE INDEX "GradableItem_dueAt_idx" ON "GradableItem"("dueAt");

-- CreateIndex
CREATE INDEX "GradableItemObjective_gradableItemId_idx" ON "GradableItemObjective"("gradableItemId");

-- CreateIndex
CREATE INDEX "GradableItemObjective_standardId_idx" ON "GradableItemObjective"("standardId");

-- CreateIndex
CREATE INDEX "GradableItemObjective_skillId_idx" ON "GradableItemObjective"("skillId");

-- CreateIndex
CREATE INDEX "GroupSubmission_gradableItemId_idx" ON "GroupSubmission"("gradableItemId");

-- CreateIndex
CREATE INDEX "GroupSubmission_classId_idx" ON "GroupSubmission"("classId");

-- CreateIndex
CREATE INDEX "GradableSubmission_gradableItemId_idx" ON "GradableSubmission"("gradableItemId");

-- CreateIndex
CREATE INDEX "GradableSubmission_studentId_idx" ON "GradableSubmission"("studentId");

-- CreateIndex
CREATE INDEX "GradableSubmission_groupSubmissionId_idx" ON "GradableSubmission"("groupSubmissionId");

-- CreateIndex
CREATE INDEX "GradableSubmission_status_idx" ON "GradableSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GradeRecord_submissionId_key" ON "GradeRecord"("submissionId");

-- CreateIndex
CREATE INDEX "GradeRecord_gradedAt_idx" ON "GradeRecord"("gradedAt");

-- CreateIndex
CREATE INDEX "GradeRecord_gradedByUserId_idx" ON "GradeRecord"("gradedByUserId");

-- CreateIndex
CREATE INDEX "GradeRecord_externalEvaluatorId_idx" ON "GradeRecord"("externalEvaluatorId");

-- CreateIndex
CREATE INDEX "GradeRevision_gradeRecordId_createdAt_idx" ON "GradeRevision"("gradeRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "GradeRevision_hash_idx" ON "GradeRevision"("hash");

-- CreateIndex
CREATE INDEX "GradeAppeal_gradeRecordId_idx" ON "GradeAppeal"("gradeRecordId");

-- CreateIndex
CREATE INDEX "GradeAppeal_studentId_idx" ON "GradeAppeal"("studentId");

-- CreateIndex
CREATE INDEX "GradeAppeal_status_idx" ON "GradeAppeal"("status");

-- CreateIndex
CREATE INDEX "GradeAuditFlag_flagType_idx" ON "GradeAuditFlag"("flagType");

-- CreateIndex
CREATE INDEX "GradeAuditFlag_severity_createdAt_idx" ON "GradeAuditFlag"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "GradeAuditFlag_gradeRecordId_idx" ON "GradeAuditFlag"("gradeRecordId");

-- CreateIndex
CREATE INDEX "ObjectiveMasterySnapshot_studentId_skillId_measuredAt_idx" ON "ObjectiveMasterySnapshot"("studentId", "skillId", "measuredAt");

-- CreateIndex
CREATE INDEX "ObjectiveMasterySnapshot_measuredAt_idx" ON "ObjectiveMasterySnapshot"("measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "MasteryEvidence_gradeId_key" ON "MasteryEvidence"("gradeId");

-- CreateIndex
CREATE INDEX "MasteryEvidence_snapshotId_idx" ON "MasteryEvidence"("snapshotId");

-- CreateIndex
CREATE INDEX "MasteryEvidence_gradeId_idx" ON "MasteryEvidence"("gradeId");

-- CreateIndex
CREATE INDEX "StudentIntervention_studentId_skillId_startedAt_idx" ON "StudentIntervention"("studentId", "skillId", "startedAt");

-- CreateIndex
CREATE INDEX "CohortBenchmark_cohortType_cohortId_skillId_measuredAt_idx" ON "CohortBenchmark"("cohortType", "cohortId", "skillId", "measuredAt");

-- CreateIndex
CREATE INDEX "_SkillToStandard_B_index" ON "_SkillToStandard"("B");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeItem" ADD CONSTRAINT "PracticeItem_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItem" ADD CONSTRAINT "AssessmentItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItem" ADD CONSTRAINT "AssessmentItem_practiceItemId_fkey" FOREIGN KEY ("practiceItemId") REFERENCES "PracticeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryRecord" ADD CONSTRAINT "MasteryRecord_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryRecord" ADD CONSTRAINT "MasteryRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSchedule" ADD CONSTRAINT "ReviewSchedule_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSchedule" ADD CONSTRAINT "ReviewSchedule_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapstoneProject" ADD CONSTRAINT "CapstoneProject_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_capstoneProjectId_fkey" FOREIGN KEY ("capstoneProjectId") REFERENCES "CapstoneProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerContact" ADD CONSTRAINT "PartnerContact_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProgram" ADD CONSTRAINT "PartnerProgram_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMetric" ADD CONSTRAINT "AgentMetric_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumAsset" ADD CONSTRAINT "CurriculumAsset_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CurriculumContent"("contentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernedArtifact" ADD CONSTRAINT "GovernedArtifact_curriculumContentId_fkey" FOREIGN KEY ("curriculumContentId") REFERENCES "CurriculumContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeCategory" ADD CONSTRAINT "GradeCategory_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassGradePolicy" ADD CONSTRAINT "ClassGradePolicy_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableItem" ADD CONSTRAINT "GradableItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GradeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableItem" ADD CONSTRAINT "GradableItem_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableItem" ADD CONSTRAINT "GradableItem_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableItemObjective" ADD CONSTRAINT "GradableItemObjective_gradableItemId_fkey" FOREIGN KEY ("gradableItemId") REFERENCES "GradableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableItemObjective" ADD CONSTRAINT "GradableItemObjective_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableItemObjective" ADD CONSTRAINT "GradableItemObjective_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSubmission" ADD CONSTRAINT "GroupSubmission_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSubmission" ADD CONSTRAINT "GroupSubmission_gradableItemId_fkey" FOREIGN KEY ("gradableItemId") REFERENCES "GradableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableSubmission" ADD CONSTRAINT "GradableSubmission_gradableItemId_fkey" FOREIGN KEY ("gradableItemId") REFERENCES "GradableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableSubmission" ADD CONSTRAINT "GradableSubmission_groupSubmissionId_fkey" FOREIGN KEY ("groupSubmissionId") REFERENCES "GroupSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradableSubmission" ADD CONSTRAINT "GradableSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_externalEvaluatorId_fkey" FOREIGN KEY ("externalEvaluatorId") REFERENCES "ExternalEvaluator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_gradedByUserId_fkey" FOREIGN KEY ("gradedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "GradableSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRevision" ADD CONSTRAINT "GradeRevision_gradeRecordId_fkey" FOREIGN KEY ("gradeRecordId") REFERENCES "GradeRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRevision" ADD CONSTRAINT "GradeRevision_revisedByUserId_fkey" FOREIGN KEY ("revisedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAppeal" ADD CONSTRAINT "GradeAppeal_gradeRecordId_fkey" FOREIGN KEY ("gradeRecordId") REFERENCES "GradeRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAppeal" ADD CONSTRAINT "GradeAppeal_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAppeal" ADD CONSTRAINT "GradeAppeal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAuditFlag" ADD CONSTRAINT "GradeAuditFlag_gradeRecordId_fkey" FOREIGN KEY ("gradeRecordId") REFERENCES "GradeRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAuditFlag" ADD CONSTRAINT "GradeAuditFlag_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectiveMasterySnapshot" ADD CONSTRAINT "ObjectiveMasterySnapshot_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectiveMasterySnapshot" ADD CONSTRAINT "ObjectiveMasterySnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryEvidence" ADD CONSTRAINT "MasteryEvidence_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryEvidence" ADD CONSTRAINT "MasteryEvidence_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ObjectiveMasterySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntervention" ADD CONSTRAINT "StudentIntervention_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntervention" ADD CONSTRAINT "StudentIntervention_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntervention" ADD CONSTRAINT "StudentIntervention_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionOutcome" ADD CONSTRAINT "InterventionOutcome_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "StudentIntervention"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortBenchmark" ADD CONSTRAINT "CohortBenchmark_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SkillToStandard" ADD CONSTRAINT "_SkillToStandard_A_fkey" FOREIGN KEY ("A") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SkillToStandard" ADD CONSTRAINT "_SkillToStandard_B_fkey" FOREIGN KEY ("B") REFERENCES "Standard"("id") ON DELETE CASCADE ON UPDATE CASCADE;




