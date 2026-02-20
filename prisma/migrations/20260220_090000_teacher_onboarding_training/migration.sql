-- Create TrainingStatus enum
CREATE TYPE "TrainingStatus" AS ENUM ('not_started', 'in_progress', 'complete');

-- TeacherProfile
CREATE TABLE "TeacherProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "permissions" JSONB,
    "gradesTaught" "GradeBand"[],
    "subjectsTaught" "Subject"[],
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON "TeacherProfile"("userId");
CREATE INDEX "TeacherProfile_schoolId_idx" ON "TeacherProfile"("schoolId");

ALTER TABLE "TeacherProfile"
ADD CONSTRAINT "TeacherProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherProfile"
ADD CONSTRAINT "TeacherProfile_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- TrainingModule
CREATE TABLE "TrainingModule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingModule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainingModule_isActive_sortOrder_idx" ON "TrainingModule"("isActive", "sortOrder");

-- TrainingProgress
CREATE TABLE "TrainingProgress" (
    "id" TEXT NOT NULL,
    "teacherUserId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "status" "TrainingStatus" NOT NULL DEFAULT 'not_started',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionEvidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingProgress_teacherUserId_moduleId_key" ON "TrainingProgress"("teacherUserId", "moduleId");
CREATE INDEX "TrainingProgress_teacherUserId_status_idx" ON "TrainingProgress"("teacherUserId", "status");
CREATE INDEX "TrainingProgress_moduleId_status_idx" ON "TrainingProgress"("moduleId", "status");

ALTER TABLE "TrainingProgress"
ADD CONSTRAINT "TrainingProgress_teacherUserId_fkey"
FOREIGN KEY ("teacherUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingProgress"
ADD CONSTRAINT "TrainingProgress_moduleId_fkey"
FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
