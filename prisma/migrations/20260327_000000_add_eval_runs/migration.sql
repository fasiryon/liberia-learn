CREATE TABLE "EvalRun" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datasetSize" INTEGER NOT NULL,
    "avgRecallAt5" DOUBLE PRECISION NOT NULL,
    "avgPrecisionAt5" DOUBLE PRECISION NOT NULL,
    "avgGrounding" DOUBLE PRECISION NOT NULL,
    "fallbackRate" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "resultJson" JSONB NOT NULL,

    CONSTRAINT "EvalRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvalRun_runAt_idx" ON "EvalRun"("runAt");
CREATE INDEX "EvalRun_passed_runAt_idx" ON "EvalRun"("passed", "runAt");
