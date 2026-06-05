-- Wave 3D: add districtRank to LeagueSnapshot + create LeagueWeekSnapshot

ALTER TABLE "LeagueSnapshot" ADD COLUMN "districtRank" INTEGER;

CREATE TABLE "LeagueWeekSnapshot" (
    "id" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "pointsTotal" DOUBLE PRECISION NOT NULL,
    "enrollmentCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeagueWeekSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeagueWeekSnapshot_district_weekStart_schoolId_key"
    ON "LeagueWeekSnapshot"("district", "weekStart", "schoolId");

CREATE INDEX "LeagueWeekSnapshot_district_weekStart_idx"
    ON "LeagueWeekSnapshot"("district", "weekStart");

CREATE INDEX "LeagueWeekSnapshot_schoolId_weekStart_idx"
    ON "LeagueWeekSnapshot"("schoolId", "weekStart");
