-- Disposable PostgreSQL negative-path fixture only.
ALTER TABLE public."CurriculumGovernanceEvent"
  ALTER COLUMN "riskReasons" SET NOT NULL;
