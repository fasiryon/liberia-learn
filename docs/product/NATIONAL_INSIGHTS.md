# National Insights (Block 20)

## Overview
National Insights combines county-level geo aggregates with national curriculum signals to highlight
system-wide patterns. The response includes only aggregates and county names (no identifiers).

## Endpoint
`GET /api/admin/national/insights`

### Auth
Platform admin only (`requirePlatformAdmin`).

### Feature Flag
`ENABLE_NATIONAL_INSIGHTS=true` (default OFF). When OFF, the endpoint returns `404`.

### Query Params
- `from=YYYY-MM` (required)
- `to=YYYY-MM` (required)

### Response Shape
```json
{
  "scope": "national",
  "generatedAt": "2025-02-01T00:00:00.000Z",
  "period": { "from": "ISO", "to": "ISO" },
  "hasData": true,
  "topImprovingCounties": [
    {
      "county": "Bong",
      "hasData": true,
      "metrics": {
        "masteryAvg": 0.8,
        "growthAvg": 0.2,
        "atRiskPct": 0.2,
        "attendanceProxyAvg": 0.9
      }
    }
  ],
  "topDecliningCounties": [
    {
      "county": "Bomi",
      "hasData": true,
      "metrics": {
        "masteryAvg": 0.5,
        "growthAvg": -0.05,
        "atRiskPct": 0.4,
        "attendanceProxyAvg": 0.6
      }
    }
  ],
  "benchmarks": {
    "masteryAvg": { "avg": 0.66, "median": 0.7, "p25": 0.5, "p75": 0.7, "sampleSize": 12 },
    "growthAvg": { "avg": 0.09, "median": 0.12, "p25": -0.05, "p75": 0.12, "sampleSize": 12 },
    "atRiskPct": { "avg": 0.3, "median": 0.3, "p25": 0.2, "p75": 0.3, "sampleSize": 12 },
    "attendanceProxyAvg": { "avg": 0.76, "median": 0.8, "p25": 0.6, "p75": 0.8, "sampleSize": 12 }
  },
  "insights": [
    {
      "id": "low_attendance_low_growth",
      "title": "Low attendance and low growth",
      "severity": "warning",
      "summary": "4 counties sit below the 25th percentile for both attendance and growth.",
      "value": 4,
      "unit": "count",
      "hasData": true
    }
  ],
  "sources": {
    "geoCountiesWithData": 12,
    "curriculumEligibleStrands": 18
  }
}
```

## Privacy Guarantees
- County aggregates only; no school, teacher, or student identifiers are returned.
- Only county names and aggregate metrics are included.
- Missing data returns `hasData: false` and `null` benchmark values.

## Notes
- Top improving/declining counties are ranked by growth average (delta from baseline).
- Benchmarks use national county aggregates and include average, median, and 25th/75th percentiles.
- Insight cards are deterministic rules-based summaries (no generative output).
