INSERT INTO "School" (id, name) VALUES ('content-test-school', 'Disposable content test');
INSERT INTO "Class" (id, "schoolId", name, subject, "gradeLevel")
VALUES ('content-test-class', 'content-test-school', 'Disposable class', 'MATH', 4);
INSERT INTO "CurriculumContent" (id, "contentId", grade, subject, "contentType", status, version, payload, "updatedAt")
VALUES ('content-test-content', 'content-test-lesson', 4, 'MATH', 'LESSON', 'APPROVED', '1.0.0', '{}', now());
INSERT INTO "ScheduledWork" (id, "contentId", "classId", "scheduledDate", "createdById")
VALUES ('content-test-work', 'content-test-lesson', 'content-test-class', '2026-10-13', 'synthetic-actor');
