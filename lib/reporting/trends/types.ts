export type TrendBucket = {
  period: string;
  value: number | null;
};

export type TrendSeries = {
  period: "monthly" | "quarterly";
  masteryTrend: TrendBucket[];
  evidenceVelocityTrend: TrendBucket[];
};
