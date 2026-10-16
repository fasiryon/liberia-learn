-- PREPARED ONLY. Execute only under the permissions/runbook in
-- docs/ops/CONTENT_FACTORY_V2_READ_ONLY_PRODUCTION_INVENTORY.md.
-- No DDL, DML, temporary tables, locking reads or application functions.
\set ON_ERROR_STOP on
\getenv reference_salt FACTORY_INVENTORY_REFERENCE_SALT
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '3s';
SET LOCAL idle_in_transaction_session_timeout = '120s';

SELECT jsonb_build_object('kind', 'session',
  'schemaVersion', 'factory-production-capture/1.0.0',
  'capturedAt', to_char(transaction_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'transactionReadOnly', current_setting('transaction_read_only'),
  'isolation', current_setting('transaction_isolation'),
  'snapshot', pg_current_snapshot()::text,
  'serverVersion', current_setting('server_version'),
  'referenceSaltValid', length(:'reference_salt') >= 64,
  'rowSecurity', current_setting('row_security'),
  'sessionGuard', 1 / CASE WHEN current_setting('transaction_read_only') = 'on'
    AND length(:'reference_salt') >= 64
    AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolcreatedb OR rolcreaterole))
    AND NOT has_schema_privilege(current_user, 'public', 'CREATE')
    AND NOT EXISTS (SELECT 1 FROM pg_class cl JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      WHERE ns.nspname = 'public' AND cl.relkind IN ('r', 'p')
        AND has_table_privilege(current_user, cl.oid, 'INSERT,UPDATE,DELETE,TRUNCATE'))
    THEN 1 ELSE 0 END);

-- A zero-row visibility result is not accepted as a complete national inventory.
SELECT jsonb_build_object('kind', 'coverage', 'contentTypes',
  (SELECT jsonb_agg(jsonb_build_object('contentType', t."contentType", 'count', t.n) ORDER BY t."contentType")
   FROM (SELECT "contentType", count(*) AS n FROM public."CurriculumContent" GROUP BY "contentType") t),
  'lessonCount', (SELECT count(*) FROM public."CurriculumContent" WHERE upper("contentType") = 'LESSON'),
  'legacyLessonMetadataCount', (SELECT count(*) FROM public."Lesson"));

SELECT jsonb_build_object(
  'kind', 'lesson', 'databaseId', c.id, 'contentId', c."contentId", 'grade', c.grade, 'subject', c.subject,
  'unitId', c."unitId", 'orderInUnit', c."orderInUnit", 'lessonType', c."lessonType", 'contentType', c."contentType", 'title', c.title,
  'schoolId', c."schoolId", 'visibility', c.visibility, 'teacherCreated', c."teacherCreated",
  'version', c.version, 'lessonVersion', c."lessonVersion", 'status', c.status, 'publishedAt', c."publishedAt",
  'payload', c.payload, 'learningObjectives', c."learningObjectives", 'moeAlignments', c."moeAlignments",
  'waecSyllabusTopics', c."waecSyllabusTopics", 'deliveryProfile', c."deliveryProfile",
  'heroImageUrl', c."heroImageUrl", 'heroImageMeta', c."heroImageMeta", 'inlineIllustrations', c."inlineIllustrations",
  'provenanceId', p.id, 'lifecycleState', p."lifecycleState", 'provenanceCompleteness', p."provenanceCompleteness",
  'currentRevisionId', p."currentRevisionId",
  'revisions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'revisionId', r.id, 'sequence', r.sequence, 'snapshotSchemaVersion', r."snapshotSchemaVersion",
    'contentSnapshot', r."contentSnapshot", 'contentHash', r."contentHash", 'originKind', r."originKind",
    'revisionKind', r."revisionKind", 'sourceRevisionId', r."sourceRevisionId",
    'generatorName', r."generatorName", 'generatorVersion', r."generatorVersion",
    'primaryPromptKey', r."primaryPromptKey", 'primaryPromptVersion', r."primaryPromptVersion", 'primaryPromptHash', r."primaryPromptHash"
  ) ORDER BY r.sequence) FROM public."CurriculumContentRevision" r WHERE r."provenanceId" = p.id), '[]'::jsonb),
  'governanceReferences', COALESCE((SELECT jsonb_agg(jsonb_build_object('eventId', g.id, 'sequence', g.sequence,
    'revisionId', g."revisionId", 'eventType', g."eventType", 'lifecycleResult', g."lifecycleResult",
    'approvalBasis', g."approvalBasis", 'reviewAuthority', g."reviewAuthority", 'occurredAt', g."occurredAt") ORDER BY g.sequence)
    FROM public."CurriculumGovernanceEvent" g WHERE g."provenanceId" = p.id), '[]'::jsonb),
  'assignmentCount', (SELECT count(*) FROM public."Assignment" a WHERE a."contentId" IN (c.id, c."contentId") OR a."scheduledWorkId" IN (SELECT s.id FROM public."ScheduledWork" s WHERE s."contentId" = c."contentId")),
  'assignmentSubmissionCount', (SELECT count(*) FROM public."AssignmentSubmission" sub JOIN public."Assignment" a ON a.id = sub."assignmentId" WHERE a."contentId" IN (c.id, c."contentId") OR a."scheduledWorkId" IN (SELECT s.id FROM public."ScheduledWork" s WHERE s."contentId" = c."contentId")),
  'homeworkCount', (SELECT count(*) FROM public."Homework" h WHERE h."contentId" IN (c.id, c."contentId") OR h."scheduledWorkId" IN (SELECT s.id FROM public."ScheduledWork" s WHERE s."contentId" = c."contentId")),
  'homeworkSubmissionCount', (SELECT count(*) FROM public."HomeworkSubmission" sub JOIN public."Homework" h ON h.id = sub."homeworkId" WHERE h."contentId" IN (c.id, c."contentId") OR h."scheduledWorkId" IN (SELECT s.id FROM public."ScheduledWork" s WHERE s."contentId" = c."contentId")),
  'gradedSubmissionCount', (SELECT count(*) FROM public."GradedSubmission" gs WHERE gs."lessonId" = c.id),
  'teacherLessonAssignmentCount', (SELECT count(*) FROM public."TeacherLessonAssignment" ta WHERE ta."contentId" = c."contentId"),
  'timetableAssignmentCount', (SELECT count(*) FROM public."TimetableAssignment" ta WHERE ta."curriculumContentId" = c."contentId"),
  'scheduledWorkCount', (SELECT count(*) FROM public."ScheduledWork" s WHERE s."contentId" = c."contentId"),
  'progressCount', (SELECT count(*) FROM public."StudentProgress" pr JOIN public."ScheduledWork" s ON s.id = pr."scheduledWorkId" WHERE s."contentId" = c."contentId"),
  'studentSessionCount', (SELECT count(*) FROM public."StudentSession" ses JOIN public."ScheduledWork" s ON s.id = ses."lessonId" WHERE s."contentId" = c."contentId"),
  'teacherVersionReferences', COALESCE((SELECT jsonb_agg(jsonb_build_object('versionId', lv.id,
    'bodySha256', encode(sha256(convert_to(lv."bodyHtml", 'UTF8')), 'hex')) ORDER BY lv.id)
    FROM public."LessonVersion" lv WHERE lv."lessonId" = c.id), '[]'::jsonb),
  'learningEventCount', (SELECT count(*) FROM public."LearningEvent" e WHERE e."contentId" IN (c.id, c."contentId") OR e."lessonId" IN (c.id, c."contentId")),
  'learningHistoryReferences', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'referenceDigest', encode(sha256(convert_to(:'reference_salt' || ':' || e.id, 'UTF8')), 'hex'),
    'eventType', e."eventType", 'curriculumVersion', e."curriculumVersion", 'assessmentVersion', e."assessmentVersion") ORDER BY e.id)
    FROM public."LearningEvent" e WHERE e."contentId" IN (c.id, c."contentId") OR e."lessonId" IN (c.id, c."contentId")), '[]'::jsonb)
)
FROM public."CurriculumContent" c
LEFT JOIN public."CurriculumProvenance" p ON p."curriculumContentId" = c.id
WHERE upper(c."contentType") = 'LESSON'
ORDER BY c.id;

SELECT jsonb_build_object('kind', 'complete', 'lessonCount',
  (SELECT count(*) FROM public."CurriculumContent" WHERE upper("contentType") = 'LESSON'),
  'transactionReadOnly', current_setting('transaction_read_only'));
ROLLBACK;
