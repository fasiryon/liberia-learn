ALTER TABLE "SchoolStorageQuota"
  ALTER COLUMN "usedBytes" TYPE BIGINT USING "usedBytes"::BIGINT,
  ALTER COLUMN "limitBytes" TYPE BIGINT USING "limitBytes"::BIGINT;
