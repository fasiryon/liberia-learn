-- Phase 2 school operations
-- Manual migration
-- Safe: creates new enum/tables/indexes/fks only

CREATE TYPE "Weekday" AS ENUM (
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
);

ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'EXCUSED';

CREATE TABLE "TeacherAssignment" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT,
  "subjectName" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TeacherAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Timetable" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "subjectId" TEXT,
  "subjectName" TEXT,
  "dayOfWeek" "Weekday" NOT NULL,
  "periodLabel" TEXT NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "room" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Attendance" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "markedById" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeacherAssignment_schoolId_teacherId_idx"
ON "TeacherAssignment"("schoolId", "teacherId");

CREATE INDEX "TeacherAssignment_schoolId_classId_idx"
ON "TeacherAssignment"("schoolId", "classId");

CREATE UNIQUE INDEX "TeacherAssignment_teacherId_classId_subject_key"
ON "TeacherAssignment"("teacherId", "classId", "subjectId");

CREATE INDEX "Timetable_schoolId_dayOfWeek_idx"
ON "Timetable"("schoolId", "dayOfWeek");

CREATE INDEX "Timetable_teacherId_dayOfWeek_idx"
ON "Timetable"("teacherId", "dayOfWeek");

CREATE INDEX "Timetable_classId_dayOfWeek_idx"
ON "Timetable"("classId", "dayOfWeek");

CREATE INDEX "Attendance_schoolId_date_idx"
ON "Attendance"("schoolId", "date");

CREATE INDEX "Attendance_classId_date_idx"
ON "Attendance"("classId", "date");

CREATE INDEX "Attendance_studentId_date_idx"
ON "Attendance"("studentId", "date");

CREATE UNIQUE INDEX "Attendance_studentId_classId_date_key"
ON "Attendance"("studentId", "classId", "date");

ALTER TABLE "TeacherAssignment"
ADD CONSTRAINT "TeacherAssignment_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherAssignment"
ADD CONSTRAINT "TeacherAssignment_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherAssignment"
ADD CONSTRAINT "TeacherAssignment_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Timetable"
ADD CONSTRAINT "Timetable_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Timetable"
ADD CONSTRAINT "Timetable_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Timetable"
ADD CONSTRAINT "Timetable_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attendance"
ADD CONSTRAINT "Attendance_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attendance"
ADD CONSTRAINT "Attendance_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attendance"
ADD CONSTRAINT "Attendance_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attendance"
ADD CONSTRAINT "Attendance_markedById_fkey"
FOREIGN KEY ("markedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;