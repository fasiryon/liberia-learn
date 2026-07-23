-- CreateTable
CREATE TABLE "TeacherMorningBrief" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL DEFAULT 'morning-brief',
    "teacherUserId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "briefDate" TIMESTAMP(3) NOT NULL,
    "briefText" TEXT NOT NULL,
    "dataSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherMorningBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherMorningBrief_teacherUserId_briefDate_key" ON "TeacherMorningBrief"("teacherUserId", "briefDate");

-- CreateIndex
CREATE INDEX "TeacherMorningBrief_schoolId_briefDate_idx" ON "TeacherMorningBrief"("schoolId", "briefDate");
