\set ON_ERROR_STOP on
SELECT s."code", count(DISTINCT t."id") AS tasks, count(DISTINCT d."id") AS decisions, max(t."createdAt") AS latest
FROM "School" s
LEFT JOIN "CurriculumReviewTask" t ON t."schoolId" = s."id"
LEFT JOIN "CurriculumReviewDecision" d ON d."taskId" = t."id"
WHERE s."code" LIKE 'p2b-e2e-%-a'
GROUP BY s."code"
ORDER BY latest DESC NULLS LAST
LIMIT 5;

SELECT c."contentId", t."status", t."requiredReviewCount", count(a."id") AS assignments, count(x."id") AS assessments, count(d."id") AS decisions
FROM "CurriculumReviewTask" t
JOIN "CurriculumProvenance" p ON p."id" = t."provenanceId"
JOIN "CurriculumContent" c ON c."id" = p."curriculumContentId"
LEFT JOIN "CurriculumReviewAssignment" a ON a."taskId" = t."id"
LEFT JOIN "CurriculumReviewAssessment" x ON x."taskId" = t."id"
LEFT JOIN "CurriculumReviewDecision" d ON d."taskId" = t."id"
WHERE c."contentId" LIKE 'p2b-e2e-1786714847027-%'
GROUP BY c."contentId", t."status", t."requiredReviewCount"
ORDER BY c."contentId";
