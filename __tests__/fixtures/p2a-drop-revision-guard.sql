-- Disposable PostgreSQL negative-path fixture only.
DROP TRIGGER curriculum_content_revision_no_update_or_delete
  ON public."CurriculumContentRevision";
